// vibeupme.com tanıtım sitesi ekran görüntüleri (masaüstü + telefon, TR + EN). Önce: python site/build.py ve site klasöründe python -m http.server 8090
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const SITE = process.env.SITE_URL ?? 'http://localhost:8090';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, vp, path] of [['desktop', { width: 1440, height: 900 }, '/'], ['mobile', { width: 390, height: 844 }, '/'], ['desktop-en', { width: 1440, height: 900 }, '/en/']]) {
  const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: name === 'mobile' ? 2 : 1 })).newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  page.on('requestfailed', (r) => console.log('İSTEK HATASI:', r.url()));
  await page.goto(SITE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200); // telefon demosu "İlgi" kademesinde
  await page.screenshot({ path: `${out}site-${name}-top.png` });
  await page.screenshot({ path: `${out}site-${name}-full.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(name, 'yatay taşma:', overflow);
}
await browser.close();
