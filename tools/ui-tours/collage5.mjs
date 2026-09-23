import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { REPO } from './lib.mjs';

const shots = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${shots}${f}.png`).toString('base64')}`;
const phones = [
  ['d1-wallet-bonus', 'Hediye jeton + ilk alım bonusu'],
  ['d2-after-purchase', 'Satın alma sonrası'],
  ['d3-live-webhook', 'Mağaza onayı: canlı bakiye'],
];
const admin = [
  ['d4-admin-stats', 'Yönetim: satış ve gelir'],
  ['d5-admin-sales', 'Yönetim: satışlar'],
];
const fig = ([f, l]) => `<figure><img src="${img(f)}"><figcaption>${l}</figcaption></figure>`;
const html = `<html><head><style>
  body{margin:0;background:#fff6f4;font-family:Segoe UI,sans-serif}
  h1{margin:28px 32px 4px;font-size:30px;background:linear-gradient(90deg,#FF4D6D,#FF8A5B);-webkit-background-clip:text;color:transparent}
  p{margin:0 32px 18px;color:#6b5b5e;font-size:16px}
  .row{display:grid;gap:22px;padding:0 32px 24px}
  .phones{grid-template-columns:repeat(3,300px)}
  .admin{grid-template-columns:repeat(2,489px)}
  figure{margin:0} img{width:100%;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.14);display:block}
  figcaption{text-align:center;margin-top:8px;font-size:15px;font-weight:600;color:#3a2e30}
</style></head><body>
<h1>MeetPoint · Faz 5 önizleme</h1>
<p>Gerçek ödeme altyapısı: RevenueCat webhook ve senkronizasyon, bonuslar, iade, yerel fiyatlar, satış raporu</p>
<div class="row phones">${phones.map(fig).join('')}</div>
<div class="row admin">${admin.map(fig).join('')}</div>
</body></html>`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1064, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: `${REPO}/docs/faz5-onizleme.png`, fullPage: true });
console.log('ok');
await browser.close();
