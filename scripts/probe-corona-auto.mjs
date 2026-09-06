import fs from 'node:fs/promises';
import process from 'node:process';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const sources = JSON.parse(await fs.readFile('data/probes/corona-auto-sources.json', 'utf8'));
const outPath = process.env.PROBE_OUT || 'corona-auto-probe-results.json';
const useBrowser = process.env.PW_FALLBACK !== '0';
const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS || 20000);

const currencyPattern = /(?:US\$|CA\$|C\$|A\$|AU\$|NZ\$|HK\$|NT\$|MXN\$|MX\$|R\$|S\/|RM|AED|JD|GEL|NOK|SEK|DKK|ISK|PLN|CZK|HUF|RON|RSD|BAM|KM|BGN|EUR|GBP|USD|CAD|AUD|NZD|JPY|KRW|TWD|THB|PHP|VND|INR|ILS|ZAR|MUR|COP|CLP|PEN|PYG|CRC|DOP|GTQ|₩|₱|฿|₪|₡|₲|₹|₫|¥|£|€|\$)\s*[0-9][0-9\s.,']{0,12}|[0-9][0-9\s.,']{0,12}\s*(?:EUR|GBP|USD|CAD|AUD|NZD|JPY|KRW|TWD|THB|PHP|VND|INR|ILS|ZAR|MUR|COP|CLP|PEN|PYG|CRC|DOP|GTQ|NOK|SEK|DKK|ISK|PLN|CZK|HUF|RON|RSD|BAM|KM|BGN|lei|zł|Ft|Kč|лв|RSD|Rs|JD|GEL)\b/i;
const volumePattern = /(?:\b\d{1,2}\s*[x×]\s*)?\b\d{1,4}(?:[.,]\d+)?\s*(?:ml|cl|l|litre|liter|oz|fl\.?\s*oz|cc)\b/i;
const brandPattern = /(?:corona|korona)[\s\S]{0,35}?extra|extra[\s\S]{0,35}?(?:corona|korona)/i;
const challengePattern = /captcha|access denied|verify (?:that )?you are human|unusual traffic|request blocked|cloudflare ray id|bot detection/i;

function compact(text) {
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function inspectText(raw) {
  const text = compact(raw);
  const matches = [...text.matchAll(new RegExp(brandPattern.source, 'ig'))];
  for (const match of matches) {
    const start = Math.max(0, match.index - 1200);
    const end = Math.min(text.length, match.index + match[0].length + 1800);
    const window = text.slice(start, end);
    const volume = window.match(volumePattern)?.[0] || null;
    const price = window.match(currencyPattern)?.[0] || null;
    if (volume && price) {
      return {
        ok: true,
        brand: match[0].replace(/\s+/g, ' ').slice(0, 80),
        volume,
        price,
        sample: window.slice(0, 500),
        challenge: challengePattern.test(text),
      };
    }
  }
  return {
    ok: false,
    brand: matches[0]?.[0]?.replace(/\s+/g, ' ').slice(0, 80) || null,
    volume: text.match(volumePattern)?.[0] || null,
    price: text.match(currencyPattern)?.[0] || null,
    sample: text.slice(0, 500),
    challenge: challengePattern.test(text),
  };
}

async function httpGet(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': UA,
        'accept-language': 'en-US,en;q=0.9',
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
    });
    const text = await res.text();
    return { status: res.status, finalUrl: res.url, text };
  } finally {
    clearTimeout(timer);
  }
}

let browser = null;
async function browserGet(url) {
  if (!useBrowser) throw new Error('browser fallback disabled');
  if (!browser) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
  }
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
  let browserAttempt = null;
  let firstInspect = null;
  try {
    http = await httpGet(source.url);
    firstInspect = inspectText(http.text);
    if (http.status >= 200 && http.status < 400 && firstInspect.ok && !firstInspect.challenge) {
      return { ...source, ok: true, mode: 'http', status: http.status, finalUrl: http.finalUrl, ...firstInspect, ms: Date.now() - started };
    }
  } catch (error) {
    http = { error: String(error) };
  }

  try {
    browserAttempt = await browserGet(source.url);
    const inspected = inspectText(browserAttempt.text);
    const ok = (browserAttempt.status == null || (browserAttempt.status >= 200 && browserAttempt.status < 400)) && inspected.ok && !inspected.challenge;
    return {
      ...source,
      ok,
      mode: 'browser',
      status: browserAttempt.status,
      finalUrl: browserAttempt.finalUrl,
      ...inspected,
      httpStatus: http?.status ?? null,
      httpError: http?.error ?? null,
      ms: Date.now() - started,
      reason: ok ? null : inspected.challenge ? 'challenge' : 'missing-brand-price-volume',
    };
  } catch (error) {
    return {
      ...source,
      ok: false,
      mode: 'failed',
      status: http?.status ?? null,
      finalUrl: http?.finalUrl ?? source.url,
      brand: firstInspect?.brand ?? null,
      volume: firstInspect?.volume ?? null,
      price: firstInspect?.price ?? null,
      challenge: firstInspect?.challenge ?? false,
      httpError: http?.error ?? null,
      browserError: String(error),
      ms: Date.now() - started,
      reason: firstInspect?.challenge ? 'challenge' : 'fetch-or-parse-failed',
    };
  }
}

const results = [];
for (let i = 0; i < sources.length; i += 1) {
  const source = sources[i];
  const result = await probe(source);
  results.push(result);
  console.log(`${String(i + 1).padStart(2, '0')}/${sources.length} ${source.code} ${result.ok ? 'PASS' : 'FAIL'} ${result.mode} ${result.status ?? '-'} ${result.price ?? '-'} ${result.volume ?? '-'}`);
}

if (browser) await browser.close();
const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);
const payload = {
  generatedAt: new Date().toISOString(),
  runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
  total: results.length,
  passed: passed.length,
  failed: failed.length,
  threshold: 50,
  thresholdMet: passed.length >= 50,
  results,
};
await fs.writeFile(outPath, JSON.stringify(payload, null, 2) + '\n');

const summary = [
  '# Corona Extra free-auto source probe',
  '',
  `- runner: ${payload.runner}`,
  `- passed: ${passed.length}/${results.length}`,
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
