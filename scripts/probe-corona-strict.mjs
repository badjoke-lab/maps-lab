import fs from 'node:fs/promises';

const base = JSON.parse(await fs.readFile('data/probes/corona-auto-sources.json', 'utf8'));
const alt = JSON.parse(await fs.readFile('data/probes/corona-auto-sources-alt.json', 'utf8'));
const sources = [...base, ...alt];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS || 20000);
const concurrency = Number(process.env.PROBE_CONCURRENCY || 8);
const maxDistance = Number(process.env.PROBE_MAX_DISTANCE || 2200);

const brandRe = /\b(?:corona|korona)\s+(?:extra|extra\s+beer|beer\s+extra)\b|\bextra\s+(?:corona|korona)\b/ig;
const volumeRe = /(?:\b\d{1,2}\s*[x×*]\s*)?\b\d{1,4}(?:[.,]\d+)?\s*(?:ml|cl|l|lt|litre|liter|oz|fl\.?\s*oz|cc)\b/ig;
const challengeRe = /captcha|access denied|verify (?:that )?you are human|performing security verification|protect against malicious bots|press\s*&\s*hold|press and hold|not a bot|no eres un robot|unusual traffic|request blocked|cloudflare ray id|security verification/i;

const pricePatterns = {
  CA: [/(?:C\$|CAD\s*\$?|\$)\s*\d[\d.,]*/ig], BR: [/R\$\s*\d[\d.,]*/ig], PE: [/S\/\s*\d[\d.,\s]*/ig],
  CR: [/₡\s*\d[\d.,]*/ig], PA: [/\$\s*\d[\d.,]*/ig], DO: [/(?:RD\$|\$)\s*\d[\d.,]*/ig], PY: [/Gs\.?\s*\d[\d.,]*/ig],
  CL: [/(?:CLP\s*)?\$\s*\d[\d.,]*/ig], FR: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], AT: [/\d[\d.,\s]*\s*€|€\s*\d[\d.,\s]*/ig],
  FI: [/\d[\d.,\s]*\s*€|€\s*\d[\d.,\s]*/ig], SE: [/\b\d{1,4}:\d{2}\b|\b\d[\d.,]*\s*(?:kr|SEK)\b/ig],
  DK: [/\b\d[\d.,]*\s*(?:kr|DKK)\b|\bDKK\s*\d[\d.,]*/ig], IS: [/\b\d[\d.,]*\s*(?:kr|ISK)\b|\b\d[\d.,]*\s+Price per liter\b/ig],
  PL: [/\b\d[\d.,]*\s*zł\b|\bPLN\s*\d[\d.,]*|\bCena\s+\d[\d.,]*/ig], CZ: [/\bCZK\s*\d[\d.,]*|\b\d[\d.,]*\s*Kč\b/ig],
  IT: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], HR: [/\d[\d.,\s]*\s*€|€\s*\d[\d.,\s]*/ig], GR: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig],
  PT: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], SI: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], RS: [/\b\d[\d.,]*\s*RSD\b|\bRSD\s*\d[\d.,]*/ig],
  LV: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], EE: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], JP: [/¥\s*\d[\d,]*/ig],
  KR: [/\b\d[\d,]*\s*원\b|₩\s*\d[\d,]*/ig], TW: [/(?:NT\$|TWD\s*)\s*\d[\d,]*|\b\d[\d,]*\s*TWD\b/ig], MY: [/RM\s*\d[\d.,]*/ig],
  IL: [/₪\s*\d[\d.,]*/ig], JO: [/\b\d[\d.,]*\s*JD\b|\bJD\s*\d[\d.,]*/ig], MU: [/\bRs\s*\d[\d.,]*\b/ig], GE: [/(?:GEL|USD)\s*\d[\d.,]*/ig],
  AE: [/AED\s*\d[\d.,]*/ig], IE: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], NL: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], SG: [/(?:S\$|SGD\s*|\$)\s*\d[\d.,]*/ig],
  TH: [/฿\s*\d[\d.,]*|\b\d[\d.,]*\s*฿/ig], VN: [/\b\d[\d.]*\s*₫/ig], EC: [/\$\s*\d[\d.,]*/ig], KE: [/KSh\s*\d[\d.,]*/ig],
  NI: [/C\$\s*\d[\d.,]*/ig], JM: [/\$\s*\d[\d.,]*/ig], LB: [/(?:USD\s*|\$\s*)\d[\d.,]*/ig], LK: [/LKR\s*\d[\d.,]*|Rs\.?\s*\d[\d.,]*/ig],
  NP: [/₨\s*\d[\d.,]*|NPR\s*\d[\d.,]*|US\$\s*\d[\d.,]*/ig], MD: [/\b\d[\d.,]*\s*(?:mdl|lei)\b|\bMDL\s*\d[\d.,]*/ig],
  KZ: [/\b\d[\d\s.,]*\s*₸/ig], ID: [/Rp\s*\d[\d.,]*/ig], RW: [/RWF\s*\d[\d.,]*/ig], UG: [/\b\d[\d.,]*\s*(?:USh|UGX)\b|\b(?:USh|UGX)\s*\d[\d.,]*/ig],
  GB: [/£\s*\d[\d.,]*/ig], BE: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], DE: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], CH: [/CHF\s*\d[\d.,]*/ig],
  NO: [/\b\d[\d.,]*\s*(?:kr|NOK)\b|\bNOK\s*\d[\d.,]*/ig], HU: [/\b\d[\d\s.,]*\s*Ft\b|HUF\s*\d[\d.,]*/ig], RO: [/\b\d[\d.,]*\s*(?:lei|RON)\b|RON\s*\d[\d.,]*/ig],
  ES: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], BG: [/\b\d[\d.,]*\s*(?:лв|BGN)\b|BGN\s*\d[\d.,]*/ig], BA: [/\b\d[\d.,]*\s*(?:KM|BAM)\b|BAM\s*\d[\d.,]*/ig],
  LU: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], CY: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], MT: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], AU: [/(?:A\$|AUD\s*|\$)\s*\d[\d.,]*/ig],
  NZ: [/(?:NZ\$|NZD\s*|\$)\s*\d[\d.,]*/ig], HK: [/(?:HK\$|HKD\s*|\$)\s*\d[\d.,]*/ig], PH: [/₱\s*\d[\d.,]*/ig], ZA: [/R\s*\d[\d.,]*/ig],
  GT: [/Q\s*\d[\d.,]*/ig], MX: [/\$\s*\d[\d.,]*/ig], CO: [/\$\s*\d[\d.,]*/ig], GH: [/GH₵\s*\d[\d.,]*/ig], TT: [/\$\s*\d[\d.,]*/ig],
  SK: [/\d[\d.,]*\s*€|€\s*\d[\d.,]*/ig], AM: [/\b\d[\d.,]*\s*դր\.?/ig], ZM: [/K\s*\d[\d.,]*/ig], BH: [/BHD\s*\d[\d.,]*/ig], UY: [/\$\s*\d[\d.,]*/ig],
};

function compact(raw) {
  return String(raw || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&euro;/gi, '€')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
}

function collect(re, text) {
  re.lastIndex = 0;
  const out = [];
  for (const m of text.matchAll(re)) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

function numericValue(raw) {
  let s = raw.replace(/[^0-9.,:]/g, '').replace(/:/g, '.').trim();
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if ((s.match(/,/g) || []).length === 1) {
    const [a,b] = s.split(',');
    s = b.length <= 2 ? `${a}.${b}` : `${a}${b}`;
  } else if ((s.match(/\./g) || []).length === 1) {
    const [a,b] = s.split('.');
    if (b.length === 3 && a.length <= 3) s = `${a}${b}`;
  } else if ((s.match(/[.,]/g) || []).length > 1) s = s.replace(/[.,]/g, '');
  return Number(s);
}

function inspect(raw, source) {
  const text = compact(raw);
  const challenge = challengeRe.test(text);
  if (challenge) return { ok:false, reason:'challenge', sample:text.slice(0,700) };
  const brands = collect(brandRe, text);
  if (!brands.length) return { ok:false, reason:'missing-brand', sample:text.slice(0,700) };
  const volumes = collect(volumeRe, text);
  const patterns = pricePatterns[source.code] || [];
  const prices = patterns.flatMap((re) => collect(re, text)).filter((p) => {
    const v = numericValue(p.text);
    return Number.isFinite(v) && v > 0;
  });
  if (!prices.length) return { ok:false, reason:'missing-price', brand:brands[0].text, sample:text.slice(Math.max(0,brands[0].start-250), brands[0].end+1000) };
  if (!volumes.length) return { ok:false, reason:'missing-volume', brand:brands[0].text, sample:text.slice(Math.max(0,brands[0].start-250), brands[0].end+1000) };

  let best = null;
  for (const b of brands) for (const v of volumes) for (const p of prices) {
    const bd = (b.start+b.end)/2, vd=(v.start+v.end)/2, pd=(p.start+p.end)/2;
    const dBrandVolume=Math.abs(vd-bd), dBrandPrice=Math.abs(pd-bd), dPriceVolume=Math.abs(pd-vd);
    if (dBrandVolume > maxDistance || dBrandPrice > maxDistance) continue;
    const score=dBrandVolume+dBrandPrice+0.5*dPriceVolume;
    if (!best || score < best.score) best={b,v,p,score,dBrandVolume,dBrandPrice,dPriceVolume};
  }
  if (!best) return { ok:false, reason:'unlinked-price-volume', brand:brands[0].text, sample:text.slice(Math.max(0,brands[0].start-250),brands[0].end+1000) };
  const lo=Math.max(0,Math.min(best.b.start,best.v.start,best.p.start)-220);
  const hi=Math.min(text.length,Math.max(best.b.end,best.v.end,best.p.end)+350);
  return { ok:true, brand:best.b.text, volume:best.v.text, price:best.p.text, numericPrice:numericValue(best.p.text), score:Math.round(best.score), sample:text.slice(lo,hi) };
}

async function httpGet(url) {
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeoutMs);
  try { const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'user-agent':UA,'accept-language':'en-US,en;q=0.9',accept:'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'}}); return {status:r.status,finalUrl:r.url,text:await r.text()}; }
  finally { clearTimeout(t); }
}
let browserPromise;
async function browserGet(url) {
  browserPromise ||= import('playwright').then(({chromium})=>chromium.launch({headless:true}));
  const b=await browserPromise; const p=await b.newPage({userAgent:UA,locale:'en-US'});
  try { const r=await p.goto(url,{waitUntil:'domcontentloaded',timeout:timeoutMs}); await p.waitForTimeout(1800); return {status:r?.status()??null,finalUrl:p.url(),text:await p.locator('body').innerText({timeout:5000}).catch(()=> '')}; }
  finally { await p.close(); }
}
async function probe(source) {
  const started=Date.now(); let h=null, hi=null;
  try { h=await httpGet(source.url); hi=inspect(h.text,source); if(h.status>=200&&h.status<400&&hi.ok) return {...source,...hi,ok:true,mode:'http',status:h.status,finalUrl:h.finalUrl,ms:Date.now()-started}; }
  catch(e){ h={error:String(e)}; }
  try { const b=await browserGet(source.url); const bi=inspect(b.text,source); const ok=(b.status==null||(b.status>=200&&b.status<400))&&bi.ok; return {...source,...bi,ok,mode:'browser',status:b.status,finalUrl:b.finalUrl,httpStatus:h?.status??null,httpReason:hi?.reason??null,ms:Date.now()-started}; }
  catch(e){ return {...source,ok:false,mode:'failed',status:h?.status??null,reason:hi?.reason||'fetch-failed',httpError:h?.error??null,browserError:String(e),sample:hi?.sample||'',ms:Date.now()-started}; }
}

const results=[];
for(let i=0;i<sources.length;i+=concurrency){const batch=await Promise.all(sources.slice(i,i+concurrency).map(probe));for(const r of batch){results.push(r);console.log(`${r.code} ${r.ok?'PASS':'FAIL'} ${r.mode} ${r.status??'-'} ${r.price??'-'} ${r.volume??'-'} ${r.reason??''}`);}}
if(browserPromise) await (await browserPromise).close();
const passedCodes=[...new Set(results.filter(r=>r.ok).map(r=>r.code))];
const allCodes=[...new Set(results.map(r=>r.code))];
const failedCodes=allCodes.filter(c=>!passedCodes.includes(c));
const payload={generatedAt:new Date().toISOString(),runner:process.env.GITHUB_ACTIONS?'github-actions':'local',totalCountries:allCodes.length,passedCountries:passedCodes.length,passedCodes,failedCountries:failedCodes.length,failedCodes,threshold:50,thresholdMet:passedCodes.length>=50,results};
await fs.writeFile('corona-strict-probe-results.json',JSON.stringify(payload,null,2)+'\n');
const summary=`# Corona Extra strict auto probe\n\n- runner: ${payload.runner}\n- passed: ${payload.passedCountries}/${payload.totalCountries}\n- threshold: 50 countries\n- threshold met: ${payload.thresholdMet?'YES':'NO'}\n- failed: ${failedCodes.join(', ')}\n`;
console.log('\n'+summary); if(process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
process.exitCode=payload.thresholdMet?0:2;
