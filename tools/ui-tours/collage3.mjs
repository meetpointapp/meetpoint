import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { REPO } from './lib.mjs';

const shots = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const img = (f) => `data:image/png;base64,${fs.readFileSync(`${shots}${f}.png`).toString('base64')}`;
const phones = [
  ['a2-register-consent', 'Kayıt: koşul onayı'],
  ['a3-verify-email', 'E-posta kodu'],
  ['a7-verify-pose', 'Mavi tik: poz'],
  ['b1-discover-verified', 'Mavi tikli profil'],
  ['a11-me-verified', 'Profilim: doğrulandı'],
  ['a12-delete-dialog', 'Hesap silme'],
  ['a13-banned', 'Askıya alınan hesap'],
  ['a14-reset-code', 'Şifremi unuttum'],
];
const admin = [
  ['91-admin-reports', 'Yönetim: şikayetler (XSS denemesi zararsız)'],
  ['92-admin-verifications', 'Yönetim: mavi tik onayı'],
];
const fig = ([f, label], cls) => `<figure class="${cls}"><img src="${img(f)}"><figcaption>${label}</figcaption></figure>`;
const html = `<html><head><style>
  body{margin:0;background:#fff6f4;font-family:Segoe UI,sans-serif}
  h1{margin:28px 32px 4px;font-size:30px;background:linear-gradient(90deg,#FF4D6D,#FF8A5B);-webkit-background-clip:text;color:transparent}
  p{margin:0 32px 18px;color:#6b5b5e;font-size:16px}
  .grid{display:grid;grid-template-columns:repeat(4,260px);gap:22px;padding:0 32px 22px}
  .wide{display:grid;grid-template-columns:repeat(2,531px);gap:22px;padding:0 32px 32px}
  figure{margin:0} img{width:100%;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.14);display:block}
  figcaption{text-align:center;margin-top:8px;font-size:15px;font-weight:600;color:#3a2e30}
</style></head><body>
<h1>MeetPoint · Faz 3 önizleme</h1>
<p>Güven ve güvenlik: e-posta doğrulama, şifre sıfırlama, koşul onayı, mavi tik, hesap silme, yasaklama, yönetim paneli</p>
<div class="grid">${phones.map((p) => fig(p, 'phone')).join('')}</div>
<div class="wide">${admin.map((p) => fig(p, 'admin')).join('')}</div>
</body></html>`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: `${REPO}/docs/faz3-onizleme.png`, fullPage: true });
console.log('ok');
await browser.close();
