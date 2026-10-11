// Faz 22 (ek): gönderi öne çıkarma, profile sabitleme ve reklam alanı için canlı API kontrolü.
// Çalıştırma:  node --env-file=../../server/.env social-extras-api.mjs   (geliştirme sunucusu açık olmalı)
import { createRequire } from 'node:module';
import { call, check, summary } from './lib.mjs';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const login = async (mail) => (await call(null, 'POST', '/auth/login', { email: `${mail}@meetpoint.dev`, password: 'password123' })).token;
const aye = await login('aye0'); // mavi tikli, premium değil
const mert = await login('mert6'); // premium (reklam görmez)
const can = await login('can7'); // mavi tiksiz, premium değil
const ayeId = (await call(aye, 'GET', '/me')).id;
const stamp = Date.now().toString(36);
const balance = async (t) => (await call(t, 'GET', '/wallet')).balance;
const cleanup = [];

// --- Öne çıkarma
await call(aye, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
const post = await call(aye, 'POST', '/posts', { body: `Öne çıkarma denemesi ${stamp}` });
cleanup.push(() => call(aye, 'DELETE', `/posts/${post.id}`));
const before = await balance(aye);
const b1 = await call(aye, 'POST', `/posts/${post.id}/boost`);
check('gönderi öne çıkarılır', b1.status === 200 && b1.boosted === true && !!b1.boostedUntil, `${b1.status} ${b1.error ?? ''}`);
check('60 jeton düşer', before - (await balance(aye)) === 60);
const feed = await call(can, 'GET', '/feed?tab=all');
check('herkes akışında ilk sırada', feed.posts?.[0]?.id === post.id && feed.posts[0].boosted === true, feed.posts?.[0]?.id);
check('öne çıkarılan sayfalar arasında tekrar etmez', feed.posts.filter((p) => p.id === post.id).length === 1);
const foreign = await call(can, 'POST', `/posts/${post.id}/boost`);
check('başkasının gönderisi öne çıkarılamaz', foreign.status === 404);
// 6s x4 = 24s sınır; beşincisi reddedilir
for (let i = 0; i < 3; i++) await call(aye, 'POST', `/posts/${post.id}/boost`);
const capped = await call(aye, 'POST', `/posts/${post.id}/boost`);
check('uzatma sınırı (24 saat)', capped.status === 409 && capped.error === 'post_boost_max_reached', `${capped.status} ${capped.error}`);

// --- Sabitleme
const p2 = await call(aye, 'POST', '/posts', { body: `Sabitlenecek ${stamp}` });
if (p2.id) cleanup.push(() => call(aye, 'DELETE', `/posts/${p2.id}`));
check('sabitle', (await call(aye, 'PUT', `/posts/${p2.id}/pin`)).pinned === true);
let list = await call(can, 'GET', `/users/${ayeId}/posts`);
check('sabitlenen profilde ilk sırada', list.posts?.[0]?.id === p2.id && list.posts[0].pinned === true);
check('yenisi öncekini kaldırır', (await call(aye, 'PUT', `/posts/${post.id}/pin`)).pinned === true);
list = await call(can, 'GET', `/users/${ayeId}/posts`);
check('tek sabit gönderi', list.posts.filter((p) => p.pinned).length === 1 && list.posts[0].id === post.id);
await call(aye, 'DELETE', `/posts/${post.id}/pin`);

// --- Reklam alanı
const ad = await db.ad.create({ data: { advertiser: 'Test Kafe', title: `Reklam ${stamp}`, body: 'Deneme', ctaLabel: 'Göz at', url: 'https://example.com', accent: 'ocean' } });
cleanup.push(() => db.ad.delete({ where: { id: ad.id } }).catch(() => {}));
const f2 = await call(can, 'GET', '/feed?tab=all');
check('reklam akışa gelir', f2.ad?.id === ad.id && f2.ad.advertiser === 'Test Kafe', JSON.stringify(f2.ad));
const f3 = await call(mert, 'GET', '/feed?tab=all');
check('VibeUpMe+ üyeye reklam gösterilmez', f3.ad === null, JSON.stringify(f3.ad));
const f4 = await call(can, 'GET', '/feed?tab=following');
check('takip sekmesinde reklam yok', f4.ad === null);
await call(can, 'POST', `/ads/${ad.id}/impression`);
await call(can, 'POST', `/ads/${ad.id}/click`);
const row = await db.ad.findUnique({ where: { id: ad.id } });
check('gösterim ve tıklama sayılır', row.impressions === 1 && row.clicks === 1, `${row.impressions}/${row.clicks}`);
await db.ad.update({ where: { id: ad.id }, data: { active: false } });
check('durdurulan reklam gelmez', (await call(can, 'GET', '/feed?tab=all')).ad === null);

for (const fn of cleanup) await fn();
await db.$disconnect();
summary();
