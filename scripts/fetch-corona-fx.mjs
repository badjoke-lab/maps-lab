import fs from 'node:fs/promises';

const urls = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json'
];

let data=null,lastError=null;
for (const url of urls) {
  try {
    const r=await fetch(url,{headers:{'user-agent':'badjoke-lab-corona-price-map/1.0'}});
    if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    data=await r.json();
    if(data?.usd) break;
  } catch (e) { lastError=e; }
}
if(!data?.usd) throw lastError||new Error('FX unavailable');

const rates={USD:1};
for(const [code,value] of Object.entries(data.usd)) {
  const n=Number(value); if(Number.isFinite(n)&&n>0) rates[code.toUpperCase()]=n;
}
for(const required of ['EUR','JPY','GBP','CAD','AUD','BRL']) {
  if(!rates[required]) throw new Error(`missing required FX rate: ${required}`);
}
const out={schemaVersion:1,base:'USD',date:data.date||new Date().toISOString().slice(0,10),fetchedAt:new Date().toISOString(),rates};
await fs.mkdir('data/corona',{recursive:true});
await fs.writeFile('data/corona/fx.json',JSON.stringify(out,null,2)+'\n');
console.log(`FX PASS ${Object.keys(rates).length} currencies date=${out.date}`);
