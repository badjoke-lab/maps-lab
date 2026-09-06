import fs from 'node:fs/promises';
import process from 'node:process';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const sources = JSON.parse(await fs.readFile('data/probes/corona-auto-sources.json', 'utf8'));
const outPath = process.env.PROBE_OUT || 'corona-auto-probe-results.json';
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS || 20000);
const concurrency = Number(process.env.PROBE_CONCURRENCY || 6);

const brandRe = /(?:corona|korona)\s*(?:beer\s*)?extra|extra\s*(?:beer\s*)?(?:corona|korona)/i;
const volumeRe = /(?:\b\d{1,2}\s*[x×]\s*)?\b\d{1,4}(?:[.,]\d+)?\s*(?:ml|cl|l|litre|liter|oz|fl\.?\s*oz|cc)\b/i;
const prefixPriceRe = /(?:US\$|CA\$|C\$|A\$|AU\$|NZ\$|HK\$|NT\$|MXN\$|MX\$|R\$|S\/|RM|AED|JD|GEL|Gs|Q|NOK|SEK|DKK|ISK|PLN|CZK|HUF|RON|RSD|BAM|BGN|EUR|GBP|USD|CAD|AUD|NZD|JPY|KRW|TWD|THB|PHP|VND|INR|ILS|ZAR|MUR|COP|CLP|PEN|PYG|CRC|DOP|GTQ|HKD|SGD|MOP|₩|₱|฿|₪|₡|₲|₹|₫|¥|£|€|\$)\s*[0-9][0-9\s.,:']{0,14}/;
const suffixPriceRe = /[0-9][0-9\s.,:']{0,14}\s*(?:EUR|GBP|USD|CAD|AUD|NZD|JPY|KRW|TWD|THB|PHP|VND|INR|ILS|ZAR|MUR|COP|CLP|PEN|PYG|CRC|DOP|GTQ|HKD|SGD|MOP|NOK|SEK|DKK|ISK|PLN|CZK|HUF|RON|RSD|BAM|BGN|lei|zł|Ft|Kč|лв|RSD|Rs|JD|GEL|Gs|kr|원|₩|₱|฿|₪|₡|₲|₹|₫|¥|£|€|\$)\b?/i;
const labelledPriceRe = /(?:price|preis|pris|cena|cijena|preço|preco|prezzo|precio|prijs|prix|pris|hinta|verð|harga|fiyat|가격|ราคา)\s*(?:per\s+\w+\s*)?[:\-]?\s*([0-9][0-9\s.,:']{0,12})/i;
const challengeRe = /captcha|access denied|verify (?:that )?you are human|performing security verification|protect against malicious bots|press\s*&\s*hold|press and hold|not a bot|no eres un robot|unusual traffic|request blocked|cloudflare ray id|security verification/i;

function compact(raw) {
  return String(raw || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function findPrice(text) {
  const candidates = [
    text.match(prefixPriceRe)?.[0],
    text.match(suffixPriceRe)?.[0],
    text.match(labelledPriceRe)?.[0],
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!/(?:^|\D)0(?:[.,:]00)?(?:\D|$)/.test(candidate.trim())) return candidate.trim();
  }
  return candidates[0]?.trim() || null;
}

function inspectText(raw, url) {
  const text = compact(raw);
  const challenge = challengeRe.test(text);
  const brandMatch = text.match(brandRe);
  const brandIndex = brandMatch?.index ?? -1;
  if (!brandMatch) return { ok: false, brand: null, volume: null, price: null, challenge, sample: text.slice(0, 700) };

  const productLike = /corona|korona/i.test(url);
  const start = productLike ? 0 : Math.max(0, brandIndex - 5000);
  const end = productLike ? text.length : Math.min(text.length, brandIndex + 7000);
  const scope = text.slice(start, end);
  const volume = scope.match(volumeRe)?.[0] || null;
  const price = findPrice(scope);
  return {
    ok: Boolean(volume && price && !challenge),
    brand: brandMatch[0].replace(/\s+/g, ' ').slice(0, 100),
    volume,
    price,
    challenge,
    sample: text.slice(Math.max(0, brandIndex - 250), Math.min(text.length, brandIndex + 950)),
  };
}

async function httpGet(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': UA,
        'accept-language': 'en-US,en;q=0.9',
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
    });
    return { status: response.status, finalUrl: response.url, text: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');
      return chromium.launch({ headless: true });
    })();
  }
  return browserPromise;
}

async function browserGet(url) {
  const browser = await getBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: 'en-US' });
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(2500);
    const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    return { status: response?.status() ?? null, finalUrl: page.url(), text };
  } finally {
    await page.close();
  }
}

async function probe(source) {
  const started = Date.now();
  let http = null;
  let httpInspect = null;
  try {
    http = await httpGet(source.url);
    httpInspect = inspectText(http.text, source.url);
    if (http.status >= 200 && http.status < 400 && httpInspect.ok) {
      return { ...source, ok: true, mode: 'http', status: http.status, finalUrl: http.finalUrl, ...httpInspect, ms: Date.now() - started };
    }
  } catch (error) {
    http = { error: String(error) };
  }

  try {
    const rendered = await browserGet(source.url);
    const inspected = inspectText(rendered.text, source.url);
    const statusOk = rendered.status == null || (rendered.status >= 200 && rendered.status < 400);
    const ok = statusOk && inspected.ok;
    return {
      ...source,
      ok,
      mode: 'browser',
      status: rendered.status,
      finalUrl: rendered.finalUrl,
      ...inspected,
      httpStatus: http?.status ?? null,
      httpError: http?.error ?? null,
      ms: Date.now() - started,
      reason: ok ? null : inspected.challenge ? 'challenge' : inspected.brand ? 'missing-price-or-volume' : 'missing-brand',
    };
  } catch (error) {
    return {
      ...source,
      ok: false,
      mode: 'failed',
      status: http?.status ?? null,
      finalUrl: http?.finalUrl ?? source.url,
      ...(httpInspect || { brand: null, volume: null, price: null, challenge: false, sample: '' }),
      httpError: http?.error ?? null,
      browserError: String(error),
      ms: Date.now() - started,
      reason: httpInspect?.challenge ? 'challenge' : httpInspect?.brand ? 'missing-price-or-volume' : 'fetch-or-brand-failed',
    };
  }
}

const results = [];
for (let i = 0; i < sources.length; i += concurrency) {
  const batch = sources.slice(i, i + concurrency);
  const batchResults = await Promise.all(batch.map(probe));
  for (const result of batchResults) {
    results.push(result);
    console.log(`${result.code} ${result.ok ? 'PASS' : 'FAIL'} ${result.mode} ${result.status ?? '-'} ${result.price ?? '-'} ${result.volume ?? '-'}`);
  }
}

if (browserPromise) (await browserPromise).close();
const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);
const uniquePassed = new Set(passed.map((r) => r.code)).size;
const payload = {
  generatedAt: new Date().toISOString(),
  runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  totalCountries: new Set(results.map((r) => r.code)).size,
  passedCountries: uniquePassed,
  failedCountries: new Set(failed.map((r) => r.code)).size,
  threshold: 50,
  thresholdMet: uniquePassed >= 50,
  results,
};
await fs.writeFile(outPath, JSON.stringify(payload, null, 2) + '\n');

const summary = [
  '# Corona Extra free-auto source probe v2',
  '',
  `- runner: ${payload.runner}`,
  `- passed: ${payload.passedCountries}/${payload.totalCountries}`,
  `- threshold: 50 countries`,
  `- threshold met: ${payload.thresholdMet ? 'YES' : 'NO'}`,
  '',
  '## Failed',
  ...failed.map((r) => `- ${r.code} ${r.country}: ${r.reason || 'failed'} (HTTP ${r.status ?? '-'})`),
  '',
].join('\n');
console.log('\n' + summary);
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
process.exitCode = payload.thresholdMet ? 0 : 2;
