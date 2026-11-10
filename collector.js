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
  D.polyMovers=ms.filter(m=>KW.test(m.question)&&!NOISE.test(m.question)&&(+m.volume24hr||0)>=20000&&(Math.abs(+m.oneDayPriceChange||0)>=0.05||Math.abs(+m.oneWeekPriceChange||0)>=0.12))
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
 // 8. So với nền (14 lần chạy gần nhất): |z|≥2.5 → bất thường
 const hist=H.slice(-14);for(const[k,v]of Object.entries(M)){if(typeof v!="number")continue;const xs=hist.map(h=>h.m?.[k]).filter(x=>typeof x=="number");if(xs.length<5)continue;
  const mu=xs.reduce((a,b)=>a+b)/xs.length,sd=Math.sqrt(xs.reduce((a,b)=>a+(b-mu)**2,0)/xs.length)||1e-9,z=(v-mu)/sd;if(Math.abs(z)>=2.5)alert("w","Nền 14 lần",`${k}=${v} lệch ${z.toFixed(1)}σ so với trung bình ${r2(mu)}`,"")}
 return {ts:new Date().toISOString(),metrics:M,alerts:A,detail:D,errors:E,histN:H.length};
}
