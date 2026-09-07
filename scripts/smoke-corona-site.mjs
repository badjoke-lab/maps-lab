import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('dist/corona-price-map');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root)){res.writeHead(403);res.end('forbidden');return;}
  fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404);res.end('not found');return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(buf)});
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));

const browser=await chromium.launch({headless:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('console',m=>{if(m.type()==='error') errors.push(`console: ${m.text()}`)});
  page.on('pageerror',e=>errors.push(`page: ${e.message}`));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#ranking tr').length>=50,{timeout:30000});
  const rows=await page.locator('#ranking tr').count();
  const paths=await page.locator('#map svg path').count();
  const gate=(await page.locator('#gate').innerText()).trim();
  if(rows<50) throw new Error(`ranking rows ${rows}<50`);
  if(paths<150) throw new Error(`map paths ${paths}<150`);
  if(gate!=='PASS') throw new Error(`gate=${gate}`);
  const usd=await page.locator('#ranking tr').first().locator('td').nth(2).innerText();
  await page.selectOption('#currency','JPY');
  await page.waitForTimeout(250);
  const jpy=await page.locator('#ranking tr').first().locator('td').nth(2).innerText();
  if(usd===jpy) throw new Error('currency switch did not change ranking price');
  await page.locator('#ranking tr').first().click();
  const title=(await page.locator('#country-title').innerText()).trim();
  if(!title||title==='Select a country') throw new Error('country detail did not open');
  await fs.promises.mkdir('smoke-artifacts',{recursive:true});
  await page.screenshot({path:'smoke-artifacts/desktop.png',fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#ranking tr').length>=50,{timeout:30000});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>2) throw new Error(`mobile horizontal overflow ${overflow}px`);
  await page.screenshot({path:'smoke-artifacts/mobile.png',fullPage:true});
  if(errors.length) throw new Error(errors.join('\n'));
  console.log(`UI SMOKE PASS rows=${rows} mapPaths=${paths} detail=${title} mobileOverflow=${overflow}`);
} finally {
  await browser.close();
  await new Promise(r=>server.close(r));
}
