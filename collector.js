// Personal Intel – collector chạy trong trình duyệt (origin votuanphong1983.github.io)
// Dùng: const m=await import('https://votuanphong1983.github.io/News/collector.js?'+Date.now()); await m.run()
// Trả về {ts, metrics, alerts, detail, errors}. alerts đã so với nền (data/history.json).
const KW=/iran|israel|hormuz|gulf|houthi|saudi|fed |fed's|interest rate|rate hike|rate cut|ukraine|russia|putin|china|taiwan|xi |tariff|recession|war|strike|attack|nuclear|oil|crude|bitcoin|btc|binance|tether|hack|exploit|anthropic|openai|nvidia|layoff|vietnam|ceasefire|sanction|shutdown|default|missile|invade|blockade|treasury|inflation|cpi|unemployment/i;
const NOISE=/ vs\.? |game \d|lol:|nba|nfl|nhl|mlb|ufc|tweets|tiktok|marathon|gta|cricket|league|esports|o\/u|spread|winner/i;
const WATCH=["hormuz","iran","fed december","ukraine ceasefire","china tariff","taiwan","recession","anthropic ipo","bitcoin"];
const now=Date.now(),day=86400e3;
async function J(u,txt){const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw new Error(r.status+" "+u);return txt?r.text():r.json()}
const pct=(a,b)=>b?((a-b)/b*100):0, r2=x=>Math.round(x*100)/100;
export async function run(){
 const M={},A=[],D={},E={};
 const step=async(n,f)=>{try{await f()}catch(e){E[n]=String(e.message||e).slice(0,120)}};
 const alert=(sev,src,msg,url)=>A.push({sev,src,msg,url});
 let H=[];try{H=await J("./data/history.json?"+now)}catch(e){}
 await Promise.all([
 // 1. Polymarket: watchlist + "smart money" movers
 step("poly",async()=>{
  const ms=await J("https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=500");
  const today=new Date().toISOString().slice(0,10);
  D.polyMovers=ms.filter(m=>(m.endDate||"9").slice(0,10)>=today&&KW.test(m.question)&&!NOISE.test(m.question)&&(+m.volume24hr||0)>=20000&&(Math.abs(+m.oneDayPriceChange||0)>=0.05||Math.abs(+m.oneWeekPriceChange||0)>=0.12))
   .map(m=>({q:m.question,yes:r2(JSON.parse(m.outcomePrices||"[0]")[0]*100),d1:r2((+m.oneDayPriceChange||0)*100),d7:r2((+m.oneWeekPriceChange||0)*100),v24:Math.round(+m.volume24hr),end:(m.endDate||"").slice(0,10),slug:m.slug}))
   .sort((a,b)=>Math.abs(b.d1)-Math.abs(a.d1)).slice(0,20);
  D.polyMovers.filter(m=>Math.abs(m.d1)>=8).forEach(m=>alert(Math.abs(m.d1)>=15?"b":"w","Polymarket",`${m.q}: ${m.yes}% (${m.d1>0?"+":""}${m.d1} điểm/24h, ${m.v24.toLocaleString()}$)`,"https://polymarket.com/market/"+m.slug));
  D.polyWatch={};
  await Promise.all(WATCH.map(async q=>{const s=await J("https://gamma-api.polymarket.com/public-search?q="+encodeURIComponent(q)+"&events_status=active&limit_per_type=3");
   D.polyWatch[q]=(s.events||[]).flatMap(e=>(e.markets||[]).filter(m=>!m.closed).map(m=>({q:m.question,yes:r2(JSON.parse(m.outcomePrices||"[0]")[0]*100),d1:r2((+m.oneDayPriceChange||0)*100),vol:Math.round(+m.volume||0),end:(m.endDate||"").slice(0,10)}))).filter(m=>m.vol>20000).slice(0,6)}));
 }),
 // 2. Hack / sàn bị rút tiền
 step("hacks",async()=>{const h=await J("https://api.llama.fi/hacks");
  D.hacks=h.filter(x=>x.date*1000>now-7*day).sort((a,b)=>b.date-a.date).map(x=>({d:new Date(x.date*1000).toISOString().slice(0,10),n:x.name,usd:x.amount,t:x.technique}));
  D.hacks.filter(x=>x.usd>=5e6&&x.d>=new Date(now-3*day).toISOString().slice(0,10)).forEach(x=>alert(x.usd>=1e8?"b":"w","DefiLlama hacks",`Bị hack: ${x.n} ${(x.usd/1e6).toFixed(1)} triệu $ (${x.t}, ${x.d})`,"https://defillama.com/hacks"));
  M.hacks7d_musd=r2(D.hacks.reduce((s,x)=>s+(x.usd||0),0)/1e6);}),
 step("cex",async()=>{const c=(await J("https://api.llama.fi/cexs")).cexs.filter(x=>x.currentTvl>1e9).sort((a,b)=>b.currentTvl-a.currentTvl).slice(0,15);
  D.cex=c.map(x=>({n:x.name,tvl_b:r2(x.currentTvl/1e9),out24_pct:r2(x.inflows_24h/x.currentTvl*100),in1w_m:Math.round(x.inflows_1w/1e6),in1m_m:Math.round(x.inflows_1m/1e6)}));
  D.cex.filter(x=>x.out24_pct<=-3).forEach(x=>alert(x.out24_pct<=-6?"b":"w","DefiLlama CEX",`Tiền rút bất thường khỏi ${x.n}: ${x.out24_pct}% tài sản trong 24h (TVL ${x.tvl_b} tỷ $) – dấu hiệu hack/rút ồ ạt`,"https://defillama.com/cexs"));
  M.binance_tvl_b=D.cex.find(x=>x.n=="Binance")?.tvl_b;}),
 // 3. Stablecoin: nguồn cung + mất neo
 step("stable",async()=>{const s=(await J("https://stablecoins.llama.fi/stablecoins?includePrices=true")).peggedAssets;
  const g=k=>s.find(x=>x.symbol==k);let tot=0,pd=0,pm=0;["USDT","USDC"].forEach(k=>{const x=g(k);tot+=x.circulating.peggedUSD;pd+=x.circulatingPrevDay.peggedUSD;pm+=x.circulatingPrevMonth.peggedUSD;
   if(x.price&&Math.abs(x.price-1)>0.004)alert("b","Stablecoin",`${k} mất neo: ${x.price}$`,"https://defillama.com/stablecoins")});
  M.stable_b=r2(tot/1e9);M.stable_d1_pct=r2(pct(tot,pd));M.stable_m1_pct=r2(pct(tot,pm));
  if(Math.abs(M.stable_d1_pct)>=0.5)alert("w","Stablecoin",`USDT+USDC ${M.stable_d1_pct>0?"tăng":"giảm"} ${M.stable_d1_pct}% trong 24h`,"https://defillama.com/stablecoins");}),
 // 4. Tâm lý thị trường Mỹ
 step("cnn",async()=>{const f=(await J("https://production.dataviz.cnn.io/index/fearandgreed/graphdata")).fear_and_greed;
  M.fng=r2(f.score);M.fng_w=r2(f.previous_1_week);if(f.score<25||f.score>75||Math.abs(f.score-f.previous_1_week)>=15)alert("w","CNN Fear&Greed",`Chỉ số ${M.fng} (${f.rating}); 1 tuần trước ${M.fng_w}`,"https://www.cnn.com/markets/fear-and-greed");}),
 step("ust",async()=>{const t=await J("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/"+new Date().getFullYear()+"/all?type=daily_treasury_yield_curve&field_tdr_date_value="+new Date().getFullYear()+"&page&_format=csv",1);
  const L=t.trim().split("\n"),h=L[0].split(",").map(x=>x.replace(/"/g,"")),i2=h.indexOf("2 Yr"),i10=h.indexOf("10 Yr"),a=L[1].split(","),b=L[2].split(",");
  M.ust_date=a[0];M.ust2y=+a[i2];M.ust10y=+a[i10];const d2=Math.round((+a[i2]-+b[i2])*100);M.ust2y_d1_bp=d2;
  if(Math.abs(d2)>=10)alert("w","US Treasury",`Lợi suất 2 năm Mỹ ${d2>0?"+":""}${d2}bp còn ${a[i2]}% (${a[0]}) – kỳ vọng Fed đổi nhanh`,"https://home.treasury.gov/");}),
 step("ecb",async()=>{const j=await J("https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=6&format=jsondata");
  const o=j.dataSets[0].series["0:0:0:0:0"].observations,ks=Object.keys(o).sort((a,b)=>a-b),dt=j.structure.dimensions.observation[0].values;M.eurusd=o[ks.at(-1)][0];M.eurusd_date=dt[ks.at(-1)].id;M.eurusd_d5_pct=r2(pct(o[ks.at(-1)][0],o[ks[0]][0]));}),
 // 5. Thiên tai / dấu hiệu thử hạt nhân
 step("usgs",async()=>{const q=(await J("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson")).features;
  D.quakes=q.map(f=>({m:f.properties.mag,p:f.properties.place,d:f.geometry.coordinates[2],lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],t:new Date(f.properties.time).toISOString().slice(0,16),u:f.properties.url}));
  D.quakes.forEach(x=>{const asia=x.lat>0&&x.lat<45&&x.lon>95&&x.lon<146,test=(x.lat>24&&x.lat<40&&x.lon>44&&x.lon<64||x.lat>38&&x.lat<43&&x.lon>124&&x.lon<131)&&x.d<=2;
   if(asia&&x.m>=6.3)alert("w","USGS",`Động đất M${x.m} ${x.p} (${x.t}Z) – kiểm tra chuỗi cung ứng chip/điện tử`,x.u);
   if(test)alert("b","USGS",`Chấn động nông ${x.d}km M${x.m} ${x.p} – kiểm tra khả năng thử nghiệm/nổ lớn`,x.u)});}),
 step("gdacs",async()=>{const g=await J("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL&fromdate="+new Date(now-5*day).toISOString().slice(0,10));
  D.gdacs=(g.features||[]).map(f=>({n:f.properties.name,lvl:f.properties.alertlevel,c:f.properties.country,from:(f.properties.fromdate||"").slice(0,10),u:f.properties.url?.report}));
  D.gdacs.filter(x=>/viet/i.test(x.c||"")&&x.lvl!="Green").forEach(x=>alert(x.lvl=="Red"?"b":"w","GDACS",`${x.n} (${x.lvl}) ảnh hưởng ${x.c}`,x.u||"https://www.gdacs.org"));}),
 // 6. Crypto on-chain
 step("btc",async()=>{M.btc=Math.round((await J("https://www.deribit.com/api/v2/public/get_index_price?index_name=btc_usd")).result.index_price);
  const f=await J("https://mempool.space/api/v1/fees/recommended");M.btc_fee=f.fastestFee;if(f.fastestFee>=60)alert("w","mempool",`Phí BTC vọt ${f.fastestFee} sat/vB – rút/chuyển coin ồ ạt`,"https://mempool.space");}),
 // 7. Công nghệ: tin lan nhanh trong giới kỹ sư + lỗ hổng nghiêm trọng
 step("hn",async()=>{const h=await J("https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>"+Math.floor((now-day)/1000)+",points>150&hitsPerPage=40");
  D.hn=h.hits.map(x=>({t:x.title,p:x.points,c:x.num_comments,u:x.url||"https://news.ycombinator.com/item?id="+x.objectID})).sort((a,b)=>b.p-a.p).slice(0,15);
  D.hn.filter(x=>/layoff|laid off|outage|breach|hacked|leak|down |zero-day|0-day|exploit|ransomware|shutdown|bankrupt/i.test(x.t)&&x.p>=300).forEach(x=>alert("w","Hacker News",`${x.t} (${x.p} điểm)`,x.u));}),
 step("ghsa",async()=>{const g=await J("https://api.github.com/advisories?per_page=30&severity=critical&sort=published");
  D.ghsa=g.filter(x=>new Date(x.published_at)>now-2*day).map(x=>({id:x.ghsa_id,s:x.summary,pk:(x.vulnerabilities||[]).map(v=>v.package?.ecosystem+":"+v.package?.name).slice(0,3).join(", ")}));M.ghsa_crit_48h=D.ghsa.length;
  D.ghsa.filter(x=>/npm|pypi|nuget|maven/i.test(x.pk)).slice(0,3).forEach(x=>alert("w","GitHub Advisory",`Lỗ hổng nghiêm trọng ${x.pk}: ${x.s}`,"https://github.com/advisories/"+x.id));})
 ]);
 // 7b. Thời tiết – thiên tai
 await step("weather",async()=>{const w=await weather();D.weather=w.weather;A.push(...w.alerts);Object.assign(E,w.errors);const h=w.weather.storms.map(x=>x.dVN_min);M.storm_min_km_vn=h.length?Math.min(...h):9999;});
 // 8. So với nền (14 lần chạy gần nhất): |z|≥2.5 → bất thường
 const hist=H.slice(-14);for(const[k,v]of Object.entries(M)){if(typeof v!="number")continue;const xs=hist.map(h=>h.m?.[k]).filter(x=>typeof x=="number");if(xs.length<5)continue;
  const mu=xs.reduce((a,b)=>a+b)/xs.length,sd=Math.sqrt(xs.reduce((a,b)=>a+(b-mu)**2,0)/xs.length)||1e-9,z=(v-mu)/sd;if(Math.abs(z)>=2.5)alert("w","Nền 14 lần",`${k}=${v} lệch ${z.toFixed(1)}σ so với trung bình ${r2(mu)}`,"")}
 return {ts:new Date().toISOString(),metrics:M,alerts:A,detail:D,errors:E,histN:H.length};
}

// Thời tiết – thiên tai (JMA bão, GDACS, Open-Meteo dự báo + không khí + lũ sông)
const CITIES=[["Hà Nội",21.03,105.85],["TP HCM",10.82,106.63],["Đà Nẵng",16.05,108.2],["Huế",16.46,107.59]];
const km=(a,b,c,d)=>{const R=6371,t=x=>x*Math.PI/180,dl=t(c-a),dn=t(d-b);return 2*R*Math.asin(Math.sqrt(Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dn/2)**2))};
const VN=[[21,106],[16,108],[11,107],[13,109.3],[9.5,105.5]];const dVN=(la,lo)=>Math.min(...VN.map(p=>km(la,lo,p[0],p[1])));
export async function weather(){
 const W={storms:[],gdacs:[],cities:[],air:[],rivers:[]},A=[],E={};const alert=(sev,src,msg,url)=>A.push({sev,src,msg,url});
 const step=async(n,f)=>{try{await f()}catch(e){E[n]=String(e.message||e).slice(0,120)}};
 await Promise.all([
 step("jma",async()=>{const t=await J("https://www.jma.go.jp/bosai/typhoon/data/targetTc.json");
  for(const x of t){const s=await J(`https://www.jma.go.jp/bosai/typhoon/data/${x.tropicalCyclone}/specifications.json`),f=await J(`https://www.jma.go.jp/bosai/typhoon/data/${x.tropicalCyclone}/forecast.json`);
   const now0=s.find(p=>p.advancedHours===0)||s[1],nm=s[0].name?.en||x.typhoonNumber,pos=now0.position.deg;
   const fc=f.filter(p=>p.center).map(p=>({h:p.advancedHours,c:p.center,d:Math.round(dVN(p.center[0],p.center[1]))}));const near=fc.reduce((a,b)=>b.d<a.d?b:a,fc[0]);
   const o={name:nm,cat:s[0].category?.en,lat:pos[0],lon:pos[1],wind_ms:+now0.maximumWind?.sustained?.["m/s"],gust_ms:+now0.maximumWind?.gust?.["m/s"],hpa:+now0.pressure,course:now0.course,kmh:+now0.speed?.["km/h"],dVN_now:Math.round(dVN(pos[0],pos[1])),dVN_min:near.d,dVN_min_h:near.h};W.storms.push(o);
   if(o.dVN_min<=600)alert("b","JMA bão",`Bão ${nm} (gió ${o.wind_ms}m/s, ${o.hpa}hPa) dự báo cách bờ Việt Nam ~${o.dVN_min}km sau ${o.dVN_min_h}h`,"https://www.jma.go.jp/bosai/map.html#contents=typhoon");
   else if(o.dVN_min<=1500||(o.lon<125&&o.lat<25))alert("w","JMA bão",`Bão ${nm} vào Biển Đông/gần VN: hiện cách ${o.dVN_now}km, gần nhất ${o.dVN_min}km sau ${o.dVN_min_h}h`,"https://www.jma.go.jp/bosai/map.html#contents=typhoon");}}),
 step("gdacs",async()=>{const from=new Date(Date.now()-7*day).toISOString().slice(0,10);
  for(const ty of ["TC","FL","EQ","VO","DR","WF"]){let g;try{g=await J(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=${ty}&fromdate=${from}`)}catch(e){continue}
   (g.features||[]).forEach(ft=>{const p=ft.properties,[lo,la]=ft.geometry.coordinates;const o={t:ty,n:p.name,lvl:p.alertlevel,c:p.country,from:(p.fromdate||"").slice(0,10),to:(p.todate||"").slice(0,10),dVN:Math.round(dVN(la,lo)),u:p.url?.report};
    if(o.lvl!="Green"||o.dVN<1500||/viet/i.test(o.c||""))W.gdacs.push(o);
    if((/viet/i.test(o.c||"")||o.dVN<400)&&o.lvl!="Green")alert(o.lvl=="Red"?"b":"w","GDACS",`${o.n} (${o.lvl}) – ${o.c||""}`,o.u||"https://www.gdacs.org");
    else if(o.lvl=="Red"&&o.to>=new Date(Date.now()-3*day).toISOString().slice(0,10))alert("w","GDACS",`Thảm hoạ cấp ĐỎ: ${o.n} – ${o.c||""}`,o.u||"https://www.gdacs.org")})}}),
 step("meteo",async()=>{const q=CITIES.map(c=>c[1]).join(",")+"&longitude="+CITIES.map(c=>c[2]).join(",");
  const r=await J("https://api.open-meteo.com/v1/forecast?latitude="+q+"&daily=precipitation_sum,wind_gusts_10m_max,temperature_2m_max,temperature_2m_min,weather_code&forecast_days=7&timezone=Asia%2FBangkok");
  r.forEach((x,i)=>{const d=x.daily,c=CITIES[i][0];const mx=Math.max(...d.precipitation_sum),gi=Math.max(...d.wind_gusts_10m_max),tx=Math.max(...d.temperature_2m_max),tn=Math.min(...d.temperature_2m_min);
   const o={city:c,rain7_mm:Math.round(d.precipitation_sum.reduce((a,b)=>a+b,0)),rainmax_mm:Math.round(mx),rainmax_day:d.time[d.precipitation_sum.indexOf(mx)],gust_max_kmh:Math.round(gi),tmax:tx,tmin:tn,today:{rain:d.precipitation_sum[0],tmax:d.temperature_2m_max[0],tmin:d.temperature_2m_min[0]}};W.cities.push(o);
   if(mx>=100)alert(mx>=200?"b":"w","Open-Meteo",`${c}: mưa lớn ${o.rainmax_mm}mm ngày ${o.rainmax_day} (7 ngày ${o.rain7_mm}mm)`,"https://open-meteo.com");
   if(gi>=70)alert("w","Open-Meteo",`${c}: gió giật ${o.gust_max_kmh}km/h trong 7 ngày`,"https://open-meteo.com");
   if(tx>=38)alert("w","Open-Meteo",`${c}: nắng nóng ${tx}°C`,"https://open-meteo.com");if(tn<=10)alert("w","Open-Meteo",`${c}: rét ${tn}°C`,"https://open-meteo.com");})}),
 step("air",async()=>{const r=await J("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=21.03,10.82&longitude=105.85,106.63&current=pm2_5,us_aqi&hourly=us_aqi&forecast_days=2");
  r.forEach((x,i)=>{const c=["Hà Nội","TP HCM"][i],mx=Math.max(...x.hourly.us_aqi.filter(v=>v!=null));W.air.push({city:c,aqi:x.current.us_aqi,pm25:x.current.pm2_5,aqi_max48h:mx});if(mx>=150)alert(mx>=200?"b":"w","Open-Meteo AQ",`${c}: AQI tới ${mx} trong 48h (hiện ${x.current.us_aqi}) – hạn chế ra ngoài, đeo khẩu trang N95`,"https://open-meteo.com")})}),
 step("flood",async()=>{const R=[["Thu Bồn (Quảng Nam)",15.88,108.33],["Hương (Huế)",16.47,107.58],["Hồng (Hà Nội)",21.05,105.86],["Mekong (Cần Thơ)",10.03,105.78]];
  const r=await J("https://flood-api.open-meteo.com/v1/flood?latitude="+R.map(x=>x[1]).join(",")+"&longitude="+R.map(x=>x[2]).join(",")+"&daily=river_discharge,river_discharge_max&past_days=7&forecast_days=7");
  r.forEach((x,i)=>{const q=x.daily.river_discharge,med=[...q.slice(0,7)].sort((a,b)=>a-b)[3]||1,fmax=Math.max(...q.slice(7));const o={river:R[i][0],now:Math.round(q[7]),fmax:Math.round(fmax),ratio:Math.round(fmax/med*10)/10};W.rivers.push(o);
   if(o.ratio>=3&&o.fmax>=300)alert(o.ratio>=6?"b":"w","GloFAS",`Lũ: ${o.river} lưu lượng dự báo gấp ${o.ratio} lần mức tuần qua (${o.fmax} m³/s)`,"https://open-meteo.com/en/docs/flood-api")})})
 ]);
 return {weather:W,alerts:A,errors:E};}

// Máy bay quân sự (ADS-B công khai). Gọi khi tab đang mở https://api.adsb.lol/v2/mil
export function flights(){
 const j=JSON.parse(document.body.innerText),ac=j.ac||[];
 const T=/^(K35R|K35E|KC46|KC10|KC30|A332|A3ST|MRTT)$/,I=/^(E3TF|E3CF|E3|E6|E7|R135|RC35|P8|P8A|U2|GLEX|RQ4|MQ9|Q4|E8|EP3|C30J)$/,B=/^(B52|B1|B2|B1B)$/,L=/^(C17|C5|C5M|A400|C130|IL76)$/;
 const box={ME:[12,40,30,65],EEU:[43,60,20,42],SCS:[0,25,100,125],TWN:[18,30,115,130]};
 const inb=(a,b)=>a.lat>=b[0]&&a.lat<=b[1]&&a.lon>=b[2]&&a.lon<=b[3];
 const out={total:ac.length,ts:new Date((j.now||Date.now())).toISOString()};
 for(const[k,b]of Object.entries(box)){const x=ac.filter(a=>a.lat!=null&&inb(a,b));out[k]={n:x.length,tanker:x.filter(a=>T.test(a.t||"")).length,isr:x.filter(a=>I.test(a.t||"")).length,bomber:x.filter(a=>B.test(a.t||"")).length,airlift:x.filter(a=>L.test(a.t||"")).length,list:x.filter(a=>T.test(a.t||"")||I.test(a.t||"")||B.test(a.t||"")).map(a=>(a.flight||"").trim()+"/"+a.t+"@"+a.lat.toFixed(1)+","+a.lon.toFixed(1)).slice(0,12)}}
 return out;}
