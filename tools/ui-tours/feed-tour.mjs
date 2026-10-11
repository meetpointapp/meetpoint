// Faz 22 UI turu: akış, gönderi detayı, hikaye görüntüleyici/oluşturucu, profil takip alanı, takipçi listesi.
// Giriş: TOUR_EMAIL (varsayılan mert6@meetpoint.dev; mavi tikli). Çıktı: shots/feed-*.png
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { WEB, call } from './lib.mjs';

const out = new URL('./shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
fs.mkdirSync(out, { recursive: true });
const email = process.env.TOUR_EMAIL ?? 'mert6@meetpoint.dev';
const password = process.env.TOUR_PASSWORD ?? 'password123';

const token = (await call(null, 'POST', '/auth/login', { email, password })).token;
const feed = await call(token, 'GET', '/feed?tab=all');
const post = feed.posts?.find((p) => p.commentCount > 0) ?? feed.posts?.[0];
const author = post?.author?.id;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 200)));
const shot = async (name, wait = 1400) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}feed-${name}.png` });
  console.log('shot', name);
};
const go = async (hash, wait) => {
  await page.goto(`${WEB}/#${hash}`);
  await page.waitForTimeout(wait ?? 2200);
};

await page.goto(WEB);
await page.waitForSelector('flt-semantics-placeholder', { state: 'attached', timeout: 30000 });
await page.locator('flt-semantics-placeholder').dispatchEvent('click');
await page.waitForTimeout(3000);
await page.getByRole('textbox', { name: 'E-posta' }).fill(email);
await page.getByRole('textbox', { name: 'Şifre' }).click();
await page.keyboard.type(password, { delay: 30 });
await page.getByRole('button', { name: 'Giriş yap' }).click();
await page.waitForTimeout(4500);
await page.getByRole('button', { name: 'Atla' }).click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1200);

const steps = (process.env.STEPS ?? 'feed,detail,story,profile').split(',');
if (steps.includes('feed')) {
  await go('/feed');
  await shot('01-feed');
  await page.getByRole('tab', { name: 'Takip', exact: true }).or(page.getByRole('button', { name: 'Takip', exact: true })).first().click({ timeout: 4000 }).catch(() => {});
  await shot('02-feed-following', 1800);
}
if (steps.includes('detail') && post) {
  await go(`/post/${post.id}`);
  await shot('03-detail');
}
if (steps.includes('story') && author) {
  await go(`/stories/user/${author}`);
  await shot('04-story', 1500);
  await go('/story/new');
  await shot('05-story-composer', 1200);
}
if (steps.includes('profile') && author) {
  await go(`/user/${author}`);
  await shot('06-profile');
  await go('/me');
  await shot('07-me');
  await go(`/user/${author}/followers`);
  await shot('08-followers');
}
await browser.close();
