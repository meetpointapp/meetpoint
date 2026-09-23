import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { REPO } from './lib.mjs';

const shots = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${shots}${f}.png`).toString('base64')}`;
const items = [
  ['c1-discover-superliked', 'Mesafe + süper beğeni rozeti'],
  ['c2-filters', 'Yaş ve mesafe filtresi'],
  ['c4-boost-sheet', 'Öne çıkar (150 jeton)'],
  ['c5-boost-active', 'Öne çıkarma aktif'],
  ['c7-likes-locked', 'Seni beğenenler (kilitli)'],
  ['c8-likes-unlocked', 'Seni beğenenler (açık)'],
  ['c9-typing', '"yazıyor..." göstergesi'],
  ['c12-view-once-received', 'Okundu tiki + tek seferlik foto'],
  ['c14-inapp-banner', 'Uygulama içi bildirim'],
  ['c15-chats-unread', 'Okunmamış sayacı'],
];
const html = `<html><head><style>
  body{margin:0;background:#fff6f4;font-family:Segoe UI,sans-serif}
  h1{margin:28px 32px 4px;font-size:30px;background:linear-gradient(90deg,#FF4D6D,#FF8A5B);-webkit-background-clip:text;color:transparent}
  p{margin:0 32px 18px;color:#6b5b5e;font-size:16px}
  .grid{display:grid;grid-template-columns:repeat(5,240px);gap:20px;padding:0 32px 32px}
  figure{margin:0} img{width:100%;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.14);display:block}
  figcaption{text-align:center;margin-top:8px;font-size:14px;font-weight:600;color:#3a2e30}
</style></head><body>
<h1>MeetPoint · Faz 4 önizleme</h1>
<p>Etkileşim: konum ve mesafe, filtreler, süper beğeni, öne çıkarma, seni beğenenler, okundu, yazıyor, tek seferlik fotoğraf, bildirimler</p>
<div class="grid">${items.map(([f, l]) => `<figure><img src="${img(f)}"><figcaption>${l}</figcaption></figure>`).join('')}</div>
</body></html>`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1344, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: `${REPO}/docs/faz4-onizleme.png`, fullPage: true });
console.log('ok');
await browser.close();
