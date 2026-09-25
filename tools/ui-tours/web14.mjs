// Faz 14 web sayfaları: yardım merkezi, hesap silme, ön bilgilendirme (mobil genişlik)
import { chromium } from 'playwright-core';
import { B } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const [name, url] of [['156-web-help', '/help?lang=tr&q=arama'], ['157-web-delete', '/account/delete?lang=tr'], ['158-web-preinfo', '/legal/preinfo?lang=tr']]) {
  await page.goto(B + url);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
}
await browser.close();
