import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { REPO } from './lib.mjs';

const shots = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${shots}${f}.png`).toString('base64')}`;
const phones = [
  ['e2-call-confirm', 'Dakika başı ücret onayı'],
  ['e4-incoming', 'Gelen arama'],
  ['e5-callee-blurred', 'Görüntü bulanık başlar'],
  ['e9-gift-received', 'Arama içi hediye'],
  ['e8-gift-sheet', 'Hediye seçimi'],
  ['e12-caller-rated', 'Arama sonrası puan'],
  ['e14-callee-report', 'Sorun bildirme'],
  ['e15-history', 'Arama geçmişi'],
];
const fig = ([f, l]) => `<figure><img src="${img(f)}"><figcaption>${l}</figcaption></figure>`;
const html = `<html><head><style>
  body{margin:0;background:#fff6f4;font-family:Segoe UI,sans-serif}
  h1{margin:28px 32px 4px;font-size:30px;background:linear-gradient(90deg,#FF4D6D,#FF8A5B);-webkit-background-clip:text;color:transparent}
  p{margin:0 32px 18px;color:#6b5b5e;font-size:16px}
  .row{display:grid;gap:22px;padding:0 32px 24px}
  .phones{grid-template-columns:repeat(4,300px)}
  .admin{grid-template-columns:repeat(2,489px)}
  figure{margin:0} img{width:100%;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.14);display:block}
  figcaption{text-align:center;margin-top:8px;font-size:15px;font-weight:600;color:#3a2e30}
</style></head><body>
<h1>MeetPoint · Faz 6 önizleme</h1>
<p>Dakika başı ücretli sesli/görüntülü arama: bulanık başlangıç, hediyeler, puanlama, geçmiş</p>
<div class="row phones">${phones.map(fig).join('')}</div>
</body></html>`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1344, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: `${REPO}/docs/faz6-onizleme.png`, fullPage: true });
console.log('ok');
await browser.close();
