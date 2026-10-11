// Faz 22 canlı API kontrolü: gönderi, yorum, beğeni, takip, hikaye, engelleme, şikayet.
// Çalışan geliştirme sunucusuna karşı (seed'li demo hesaplar): aye0 ve elif2 mavi tikli, mert6 ve deniz5 değil.
// Kota (günde 5 gönderi) bilerek test edilmez: veriyi kirletmemek için oluşturulan her şey silinir.
import { B, call, check, summary } from './lib.mjs';

const login = async (mail) => (await call(null, 'POST', '/auth/login', { email: `${mail}@meetpoint.dev`, password: 'password123' })).token;
const aye = await login('aye0'); // doğrulanmış
const elif_ = await login('elif2'); // doğrulanmış
const mert = await login('mert6'); // doğrulanmamış
const deniz = await login('deniz5'); // doğrulanmamış
const idOf = async (t) => (await call(t, 'GET', '/me')).id;
const [ayeId, elifId, mertId, denizId] = await Promise.all([aye, elif_, mert, deniz].map(idOf));

const cleanup = [];
const stamp = Date.now().toString(36);

// --- Yazma yetkisi: sadece mavi tikli
const denied = await call(mert, 'POST', '/posts', { body: `Merhaba ${stamp}` });
check('doğrulanmamış kullanıcı gönderi atamaz', denied.status === 403 && denied.error === 'verification_required', `${denied.status} ${denied.error}`);

const long = await call(aye, 'POST', '/posts', { body: 'a'.repeat(281) });
check('281 karakter reddedilir', long.status === 400, String(long.status));
const phone = await call(aye, 'POST', '/posts', { body: 'Beni ara 0532 123 45 67' });
check('iletişim bilgisi içeren gönderi reddedilir', phone.status === 400 && phone.error === 'contact_info_not_allowed', `${phone.status} ${phone.error}`);

const p1 = await call(aye, 'POST', '/posts', { body: `Bugün kahve içmeye ne dersiniz? ${stamp}`, interest: 'coffee' });
check('mavi tikli gönderi atar', p1.status === 201 && p1.mine === true && p1.interest === 'coffee', `${p1.status} ${p1.error ?? ''}`);
if (p1.id) cleanup.push(() => call(aye, 'DELETE', `/posts/${p1.id}`));
const dup = await call(aye, 'POST', '/posts', { body: `Bugün kahve içmeye ne dersiniz? ${stamp}` });
check('aynı metin ikinci kez atılamaz', dup.status === 409 && dup.error === 'duplicate_post', `${dup.status} ${dup.error}`);

// --- Akış
const feed = await call(mert, 'GET', '/feed?tab=all');
check('herkes akışı okuyabilir (doğrulanmamış dahil)', feed.status === 200 && feed.posts?.some((p) => p.id === p1.id), `${feed.status} n=${feed.posts?.length}`);
const f0 = feed.posts?.find((p) => p.id === p1.id);
check('akış kartı yazar bilgisini taşır', f0?.author?.id === ayeId && f0.likedByMe === false && f0.following === false);
const followingTab = await call(mert, 'GET', '/feed?tab=following');
check('takip sekmesi takip yokken boş', followingTab.status === 200 && !followingTab.posts.some((p) => p.id === p1.id));

// --- Beğeni
const l1 = await call(mert, 'PUT', `/posts/${p1.id}/like`);
const l2 = await call(mert, 'PUT', `/posts/${p1.id}/like`);
check('beğeni tekrarlanınca sayı artmaz', l1.status === 200 && l2.likeCount === 1 && l2.liked === true, `${l1.likeCount} ${l2.likeCount}`);
const un = await call(mert, 'DELETE', `/posts/${p1.id}/like`);
check('beğeni geri alınır', un.likeCount === 0 && un.liked === false);

// --- Yorum: sadece mavi tikli
const c0 = await call(mert, 'POST', `/posts/${p1.id}/comments`, { body: 'Güzel fikir' });
check('doğrulanmamış yorum yapamaz', c0.status === 403 && c0.error === 'verification_required', `${c0.status} ${c0.error}`);
const c1 = await call(elif_, 'POST', `/posts/${p1.id}/comments`, { body: 'Ben de gelirim ☕' });
check('mavi tikli yorum yapar', c1.status === 201 && c1.mine === true && c1.author?.id === elifId, `${c1.status} ${c1.error ?? ''}`);
const cl = await call(mert, 'GET', `/posts/${p1.id}/comments`);
check('yorumlar herkese görünür', cl.comments?.length === 1 && cl.comments[0].canDelete === false);
const afterC = await call(aye, 'GET', `/posts/${p1.id}`);
check('yorum sayısı güncellendi', afterC.commentCount === 1);
const cd = await call(aye, 'DELETE', `/comments/${c1.id}`);
check('gönderi sahibi yorumu silebilir', cd.status === 200);
const afterD = await call(aye, 'GET', `/posts/${p1.id}`);
check('yorum sayısı azaldı', afterD.commentCount === 0);

// --- Takip
const self = await call(aye, 'PUT', `/users/${ayeId}/follow`);
check('kendini takip edemez', self.status === 400);
const fo = await call(mert, 'PUT', `/users/${ayeId}/follow`);
check('takip edilir', fo.status === 200 && fo.isFollowing === true && fo.followers >= 1, JSON.stringify(fo));
const fo2 = await call(mert, 'PUT', `/users/${ayeId}/follow`);
check('takip tekrarlanınca sayı artmaz', fo2.followers === fo.followers);
const feedF = await call(mert, 'GET', '/feed?tab=following');
check('takip sekmesinde takip edilenin gönderisi', feedF.posts?.some((p) => p.id === p1.id));
const prof = await call(mert, 'GET', `/users/${ayeId}`);
check('profil takip bilgisi taşır', prof.social?.isFollowing === true && prof.social.posts >= 1, JSON.stringify(prof.social));
const fl = await call(mert, 'GET', `/users/${ayeId}/followers`);
check('takipçi listesi', fl.users?.some((u) => u.id === mertId));
const back = await call(aye, 'PUT', `/users/${mertId}/follow`);
check('karşılıklı takip (takipleşme)', back.isFollowing === true && back.followsMe === true, JSON.stringify(back));
await call(aye, 'DELETE', `/users/${mertId}/follow`);

// --- Hikaye
const s0 = await call(mert, 'POST', '/stories', { kind: 'text', text: 'Merhaba dünya', bg: 'ocean' });
check('doğrulanmamış hikaye paylaşamaz', s0.status === 403, String(s0.status));
const s1 = await call(aye, 'POST', '/stories', { kind: 'text', text: `Hafta sonu planı ${stamp}`, bg: 'sunset' });
check('mavi tikli metin hikayesi paylaşır', s1.status === 201 && s1.kind === 'text' && s1.mine === true, `${s1.status} ${s1.error ?? ''}`);
if (s1.id) cleanup.push(() => call(aye, 'DELETE', `/stories/${s1.id}`));
const tray = await call(mert, 'GET', '/stories/tray');
const item = tray.items?.find((i) => i.user.id === ayeId);
check('takipçinin tepsisinde hikaye (görülmemiş)', item?.hasUnseen === true && item.stories.length >= 1, JSON.stringify(item?.stories?.length));
await call(mert, 'POST', `/stories/${s1.id}/view`);
const tray2 = await call(mert, 'GET', '/stories/tray');
check('görülünce halka sönükleşir', tray2.items.find((i) => i.user.id === ayeId)?.hasUnseen === false);
const viewers = await call(aye, 'GET', `/stories/${s1.id}/viewers`);
check('hikaye sahibi görenleri listeler', viewers.viewers?.some((v) => v.user.id === mertId));
const noViewers = await call(mert, 'GET', `/stories/${s1.id}/viewers`);
check('başkası görenleri göremez', noViewers.status === 404);

// --- Şikayet
const rep = await call(deniz, 'POST', `/posts/${p1.id}/report`, { reason: 'harassment', details: 'test' });
check('gönderi şikayeti alınır', rep.status === 201, String(rep.status));
const self2 = await call(aye, 'POST', `/posts/${p1.id}/report`, { reason: 'other' });
check('kendi gönderisini şikayet edemez', self2.status === 404);

// --- Engelleme
const blk = await call(deniz, 'POST', '/blocks', { toId: ayeId });
const hidden = await call(deniz, 'GET', `/posts/${p1.id}`);
check('engellenen yazarın gönderisi görünmez', blk.status === 200 && hidden.status === 404, String(hidden.status));
const feedB = await call(deniz, 'GET', '/feed?tab=all');
check('engellenen yazar akışta yok', !feedB.posts?.some((p) => p.id === p1.id));
await call(deniz, 'DELETE', `/blocks/${ayeId}`);

// --- Temizlik
await call(mert, 'DELETE', `/users/${ayeId}/follow`);
for (const fn of cleanup) await fn();
const gone = await call(mert, 'GET', `/posts/${p1.id}`);
check('gönderi silinince erişilemez', gone.status === 404);
summary();
console.log(B);
