const state = { snapshot:null, fx:null, target:'USD', byCode:new Map(), world:null };

const numericToAlpha2 = new Map(Object.entries({
'036':'AU','040':'AT','048':'BH','051':'AM','056':'BE','070':'BA','076':'BR','100':'BG','124':'CA','144':'LK','152':'CL','158':'TW','170':'CO','188':'CR','191':'HR','196':'CY','203':'CZ','208':'DK','214':'DO','218':'EC','233':'EE','246':'FI','250':'FR','268':'GE','276':'DE','288':'GH','300':'GR','320':'GT','344':'HK','348':'HU','352':'IS','360':'ID','372':'IE','376':'IL','380':'IT','388':'JM','392':'JP','398':'KZ','400':'JO','404':'KE','410':'KR','422':'LB','428':'LV','442':'LU','458':'MY','470':'MT','480':'MU','484':'MX','498':'MD','524':'NP','528':'NL','554':'NZ','558':'NI','578':'NO','591':'PA','600':'PY','604':'PE','608':'PH','616':'PL','620':'PT','642':'RO','646':'RW','688':'RS','702':'SG','703':'SK','705':'SI','710':'ZA','724':'ES','752':'SE','756':'CH','764':'TH','780':'TT','784':'AE','800':'UG','826':'GB','840':'US','858':'UY','704':'VN','894':'ZM'
}));

const fmt = new Intl.NumberFormat(undefined,{maximumFractionDigits:2});
const currencySymbols = {USD:'$',JPY:'¥',EUR:'€',GBP:'£'};

async function loadJSON(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }

function convert(value, from, to){
  if(from===to) return value;
  const rates=state.fx?.rates||{};
  const fromRate=from==='USD'?1:Number(rates[from]);
  const toRate=to==='USD'?1:Number(rates[to]);
  if(!Number.isFinite(fromRate)||!Number.isFinite(toRate)||fromRate<=0||toRate<=0) return null;
  return (value/fromRate)*toRate;
}
function displayPrice(record){ return convert(record.pricePer330Ml,record.currency,state.target); }
function money(v,c=state.target){ if(v==null) return 'FX unavailable'; const sym=currencySymbols[c]||`${c} `; return `${sym}${fmt.format(v)}`; }

function paintSummary(records){
  document.querySelector('#fresh-count').textContent=state.snapshot.freshCountryCount;
  document.querySelector('#gate').textContent=state.snapshot.productionGate.toUpperCase();
  const ranked=records.map(r=>[r,displayPrice(r)]).filter(([,v])=>v!=null).sort((a,b)=>a[1]-b[1]);
  document.querySelector('#cheapest').textContent=ranked.length?`${ranked[0][0].country} · ${money(ranked[0][1])}`:'—';
  document.querySelector('#expensive').textContent=ranked.length?`${ranked.at(-1)[0].country} · ${money(ranked.at(-1)[1])}`:'—';
  const d=new Date(state.snapshot.generatedAt); document.querySelector('#updated').textContent=`Updated ${d.toLocaleString()}`;
}

function paintRanking(records){
  const body=document.querySelector('#ranking'); body.textContent='';
  const ranked=records.map(r=>[r,displayPrice(r)]).filter(([,v])=>v!=null).sort((a,b)=>a[1]-b[1]);
  ranked.forEach(([r,v],i)=>{
    const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${r.country}</td><td>${money(v)}</td><td><a class="source-link" href="${r.sourceUrl}" target="_blank" rel="noopener">source ↗</a></td>`;
    tr.addEventListener('click',e=>{ if(e.target.closest('a')) return; showCountry(r); }); body.append(tr);
  });
}

function showCountry(r){
  document.querySelector('#country-title').textContent=r.country;
  const converted=displayPrice(r);
  const status=r.stale?'stale':'fresh';
  document.querySelector('#country-detail').innerHTML=`<dl>
    <dt>Status</dt><dd><span class="badge ${status}">${status.toUpperCase()}</span></dd>
    <dt>Shelf price</dt><dd>${r.currency} ${fmt.format(r.shelfPrice)}</dd>
    <dt>Package</dt><dd>${fmt.format(r.packageVolumeMl)} ml</dd>
    <dt>330 ml equivalent</dt><dd>${r.currency} ${fmt.format(r.pricePer330Ml)}</dd>
    <dt>${state.target} equivalent</dt><dd>${money(converted)}</dd>
    <dt>Collection mode</dt><dd>${r.sourceMode} · HTTP ${r.httpStatus}</dd>
    <dt>Observed price text</dt><dd>${escapeHtml(r.observedPriceText||'—')}</dd>
    <dt>Observed volume text</dt><dd>${escapeHtml(r.observedVolumeText||'—')}</dd>
    <dt>Last fresh</dt><dd>${new Date(r.lastFreshAt).toLocaleString()}</dd>
    <dt>Source</dt><dd><a href="${r.sourceUrl}" target="_blank" rel="noopener">Open retailer ↗</a></dd>
  </dl>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function colorScale(records){
  const vals=records.map(displayPrice).filter(v=>v!=null).sort((a,b)=>a-b);
  const lo=d3.quantile(vals,.08)??0, mid=d3.quantile(vals,.5)??1, hi=d3.quantile(vals,.92)??2;
  const scale=d3.scaleLinear().domain([lo,mid,hi]).range(['#4fd1a1','#f2c94c','#ff7a7a']).clamp(true);
  const legend=document.querySelector('#legend'); legend.innerHTML=`<span>${money(lo)}</span><span class="legend-bar"></span><span>${money(hi)}</span>`;
  return scale;
}

async function paintMap(records){
  if(!state.world) state.world=await loadJSON('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  const host=document.querySelector('#map'); host.textContent='';
  const width=1200,height=600;
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('preserveAspectRatio','xMidYMid meet');
  const projection=d3.geoNaturalEarth1().fitSize([width,height],topojson.feature(state.world,state.world.objects.countries));
  const path=d3.geoPath(projection); const scale=colorScale(records); const tooltip=document.querySelector('#tooltip');
  const features=topojson.feature(state.world,state.world.objects.countries).features;
  svg.selectAll('path').data(features).join('path').attr('d',path).attr('class',d=>{
    const code=numericToAlpha2.get(String(d.id).padStart(3,'0')); return state.byCode.has(code)?'country has-data':'country no-data';
  }).attr('fill',d=>{
    const code=numericToAlpha2.get(String(d.id).padStart(3,'0')); const r=state.byCode.get(code); const v=r?displayPrice(r):null; return v==null?'#1c2a3b':scale(v);
  }).on('mousemove',(event,d)=>{
    const code=numericToAlpha2.get(String(d.id).padStart(3,'0')); const r=state.byCode.get(code); if(!r){tooltip.hidden=true;return;} const v=displayPrice(r); tooltip.hidden=false; tooltip.style.left=`${event.clientX+14}px`; tooltip.style.top=`${event.clientY+14}px`; tooltip.innerHTML=`<strong>${r.country}</strong>${money(v)} / 330 ml`;
  }).on('mouseleave',()=>{tooltip.hidden=true}).on('click',(_,d)=>{ const code=numericToAlpha2.get(String(d.id).padStart(3,'0')); const r=state.byCode.get(code); if(r) showCountry(r); });
}

async function render(){
  const records=state.snapshot.records.filter(r=>!r.stale); state.byCode=new Map(records.map(r=>[r.code,r]));
  paintSummary(records); paintRanking(records); await paintMap(records);
}

async function init(){
  try{
    [state.snapshot,state.fx]=await Promise.all([loadJSON('./data/current.json'),loadJSON('./data/fx.json')]);
    document.querySelector('#currency').value=state.target;
    document.querySelector('#currency').addEventListener('change',async e=>{state.target=e.target.value; await render();});
    await render();
  }catch(err){
    console.error(err); document.querySelector('#map').innerHTML=`<p style="padding:24px;color:#ff9d9d">Could not load production data.</p>`;
    document.querySelector('#updated').textContent='Data unavailable';
  }
}
init();
