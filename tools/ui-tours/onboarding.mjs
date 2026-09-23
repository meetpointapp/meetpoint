import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, REPO, latestCode } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const uploads = `${REPO}/server/uploads`;
const samplePhoto = `${uploads}/${fs.readdirSync(uploads).find((f) => f.endsWith('-0.png'))}`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('page error:', e.message));

const shot = async (name) => {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}${name}.png` });
  console.log('shot', name);
};
const next = async () => {
  await page.getByRole('button', { name: /Devam et|Profilimi oluştur/ }).click();
  await page.waitForTimeout(700);
};

// Otomatik odaklı alanlar (web + erişilebilirlik modu): önce odağı al, sonra alana tıkla
const typeInto = async (name, text, blurAt = [195, 600]) => {
  if (typeof blurAt === 'string') await page.getByText(blurAt).last().click();
  else await page.mouse.click(...blurAt);
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name }).click();
  await page.waitForTimeout(300);
  await page.keyboard.type(text, { delay: 15 });
  await page.waitForTimeout(300);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(1500);
await shot('30-auth');

await page.getByRole('button', { name: 'Hesabın yok mu? Kayıt ol' }).click();
await page.waitForTimeout(800);
const regEmail = `yeni${Date.now()}@test.com`;
await page.getByRole('textbox', { name: 'E-posta' }).fill(regEmail);
await page.getByRole('textbox', { name: 'Şifre' }).fill('password123');
await page.getByRole('checkbox').first().click();
await page.getByRole('button', { name: 'Kayıt ol' }).click();
await page.waitForTimeout(2500);
// E-posta kodu
await typeInto('000000', await latestCode(regEmail), [195, 120]);
await page.waitForTimeout(2500);

// 1 isim
await typeInto('Görünen ad', 'Deniz');
await shot('31-ob-name');
await next();
// 2 doğum tarihi: yıl çarkını çevir
await shot('32-ob-birth-empty');
await page.mouse.move(280, 265); await page.mouse.wheel(0, -150); await page.waitForTimeout(600); await page.mouse.wheel(0, -150);
await page.waitForTimeout(800);
await shot('32-ob-birth');
await next();
// 3 cinsiyet
await page.getByText('Erkek', { exact: true }).click();
await shot('33-ob-gender');
await next();
// 4 ilgilendiğin
await page.getByText('Kadınlar', { exact: true }).click();
await next();
// 5 fotoğraf
await shot('34-ob-photos-empty');
const [chooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 10000 }),
  page.mouse.click(70, 330),
]);
await chooser.setFiles(samplePhoto);
await page.waitForTimeout(2500);
await shot('35-ob-photos');
await next();
// 6 ilgi alanları
for (const name of ['Kahve', 'Seyahat', 'Müzik', 'Teknoloji']) {
  await page.getByRole('checkbox', { name: new RegExp(name + '$') }).first().click();
  await page.waitForTimeout(150);
}
await shot('36-ob-interests');
await next();
// 7 ne arıyorsun
await page.getByText(/Ciddi ilişki/).first().click();
await shot('37-ob-looking');
await next();
// 8 sorular
await page.getByRole('button', { name: 'Soru ekle' }).click();
await page.waitForTimeout(600);
await shot('38-prompt-picker');
await page.waitForTimeout(800);
await page.getByText('Mükemmel bir pazar günüm...', { exact: true }).click();
await page.waitForTimeout(800);
await shot('38a-prompt-sheet');
await typeInto('Cevabın', 'Uzun bir kahvaltı ve sahilde yürüyüş.', [195, 650]);
await page.getByRole('button', { name: 'Tamam' }).click();
await page.waitForTimeout(800);
await shot('38-ob-prompts');
await next();
// 9 temel bilgiler
await shot('39-ob-basics');
await next();
await page.waitForTimeout(3000);
await shot('40-after-onboarding');
await browser.close();
