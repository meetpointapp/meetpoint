import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { REPO } from './lib.mjs';

const shots = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const items = [
  ['30-auth', 'Giriş'],
  ['31-ob-name', 'Kayıt · 1/9'],
  ['36-ob-interests', 'İlgi alanları'],
  ['37-ob-looking', 'Ne arıyorsun?'],
  ['50-discover', 'Keşfet'],
  ['80-profile-clean', 'Profil sayfası'],
  ['35-ob-photos', 'Fotoğraf ekleme'],
  ['71-dark-match', 'Eşleşme (karanlık mod)'],
  ['60-me-imgcheck', 'Profilim'],
  ['73-dark-wallet', 'Cüzdan (karanlık mod)'],
];
const cells = items
  .map(([file, label]) => {
    const b64 = fs.readFileSync(`${shots}${file}.png`).toString('base64');
    return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${label}</figcaption></figure>`;
  })
  .join('');
const html = `<html><head><style>
  body{margin:0;background:#fff6f4;font-family:Segoe UI,sans-serif}
  h1{margin:28px 32px 4px;font-size:30px;background:linear-gradient(90deg,#FF4D6D,#FF8A5B);-webkit-background-clip:text;color:transparent}
  p{margin:0 32px 18px;color:#6b5b5e;font-size:16px}
  .grid{display:grid;grid-template-columns:repeat(5,260px);gap:22px;padding:0 32px 32px}
  figure{margin:0}
  img{width:260px;border-radius:22px;box-shadow:0 8px 24px rgba(0,0,0,.14);display:block}
  figcaption{text-align:center;margin-top:8px;font-size:15px;font-weight:600;color:#3a2e30}
</style></head><body><h1>MeetPoint · Faz 2 önizleme</h1><p>Görünüm ve ilk izlenim: marka, adım adım kayıt, zengin profiller, yeni keşfet kartı, karanlık mod</p><div class="grid">${cells}</div></body></html>`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1476, height: 1400 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(500);
const out = `${REPO}/docs/faz2-onizleme.png`;
fs.mkdirSync(`${REPO}/docs`, { recursive: true });
await page.screenshot({ path: out, fullPage: true });
console.log('wrote', out);
await browser.close();
