// Faz 20 canlı sunucu kontrolü (API testleri bu makinede çalışmadığı için): beğeni hakkı + sıfırlama,
// mesaj isteği emaneti (3 anlamlı cevap → jeton alıcıya geçer), ilk mesajı yazanın sohbet teması.
import { call, check, latestCode, summary, upload } from './lib.mjs';

const PASSWORD = 'Meet-Point-Tour-2026!';
const tag = Date.now();
// Sunucu CALL_FREE_SECONDS ile çalışıyorsa aynı değeri ver (varsayılan 30). Soket bağlı olmayan test kullanıcıları
// için sunucuyu CALL_DISCONNECT_GRACE_SECONDS=120 ile başlat (yoksa arama kopma süresinde biter).
const FREE = Number(process.env.FREE ?? 30);

async function makeUser(name, gender, interestedIn) {
  const email = `${name.toLowerCase()}${tag}@test.com`;
  const r = await call(null, 'POST', '/auth/register', { email, password: PASSWORD, acceptTerms: true, consents: { overseas: true } });
  if (r.status !== 201) throw new Error(`register ${r.status} ${JSON.stringify(r)}`);
  await call(r.token, 'POST', '/auth/verify-email', { code: await latestCode(email) });
  await call(r.token, 'PUT', '/me/consents', { kind: 'special_category', granted: true, source: 'onboarding' });
  await call(r.token, 'POST', '/wallet/sales-terms', { accept: true });
  await call(r.token, 'PUT', '/me/profile', { displayName: name, birthDate: '1996-04-12', gender, interestedIn, city: 'İstanbul', interests: ['coffee'] });
  await upload(r.token, '/me/photos', 'photo');
  return { t: r.token, id: r.userId };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const bal = async (u) => (await call(u.t, 'GET', '/wallet')).balance;

// ---------- beğeni hakkı
const me = await makeUser('Lima', 'male', 'female');
const t1 = await makeUser('Limb', 'female', 'male');
const st0 = await call(me.t, 'GET', '/discover/like-status');
check('başlangıçta 25 hak', st0.limit === 25 && st0.remaining === 25, JSON.stringify(st0));
const noop = await call(me.t, 'POST', '/discover/like-reset');
check('kullanılmamış hakta sıfırlama ücretsiz', noop.status === 200 && noop.used === 0);
const l1 = await call(me.t, 'POST', '/swipes', { toId: t1.id, direction: 'like' });
check('beğeni yanıtı kalan hakkı taşır', l1.likes?.used === 1 && l1.likes?.remaining === 24, JSON.stringify(l1.likes));
await call(me.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
const b0 = await bal(me);
const reset = await call(me.t, 'POST', '/discover/like-reset');
check('sıfırlama sayacı başa alır', reset.status === 200 && reset.used === 0 && reset.remaining === 25, JSON.stringify(reset));
check('sıfırlama 50 jeton alır', b0 - (await bal(me)) === 50);

// ---------- hak dolunca engel
const filler = [];
for (let i = 0; i < 24; i++) filler.push(await makeUser(`Lf${i}x`, 'female', 'male'));
for (const f of filler) await call(me.t, 'POST', '/swipes', { toId: f.id, direction: 'like' });
const st1 = await call(me.t, 'GET', '/discover/like-status');
check('25. beğeniye kadar hak sayıldı (24 + 1)', st1.used === 24, JSON.stringify(st1));
const last = await makeUser('Limc', 'female', 'male');
const ok25 = await call(me.t, 'POST', '/swipes', { toId: last.id, direction: 'like' });
check('25. beğeni geçer', ok25.status === 200 && ok25.likes?.remaining === 0, JSON.stringify(ok25.likes));
const extra = await makeUser('Limd', 'female', 'male');
const blocked = await call(me.t, 'POST', '/swipes', { toId: extra.id, direction: 'like' });
check('26. beğeni 403 like_limit_reached', blocked.status === 403 && blocked.error === 'like_limit_reached', JSON.stringify(blocked));
const pass = await call(me.t, 'POST', '/swipes', { toId: extra.id, direction: 'pass' });
check('geçmek serbest', pass.status === 200);

// ---------- mesaj isteği emaneti
const payer = await makeUser('Esca', 'male', 'female');
const earner = await makeUser('Escb', 'female', 'male');
await call(payer.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
const req = await call(payer.t, 'POST', '/requests', { toId: earner.id, kind: 'MESSAGE', note: 'Merhaba nasılsın' });
check('istek oluştu', req.status === 201);
const e0 = await bal(earner);
const p0 = await bal(payer);
await call(earner.t, 'POST', `/requests/${req.id}/accept`);
check('kabulde alıcının bakiyesi değişmez', (await bal(earner)) === e0);
const convs = (await call(earner.t, 'GET', '/conversations'))._arr;
const cid = convs[0].id;
check('sohbette emanet bilgisi (alıcı)', convs[0].escrow?.role === 'earner' && convs[0].escrow?.needed === 3, JSON.stringify(convs[0].escrow));
const payerConv = (await call(payer.t, 'GET', '/conversations'))._arr[0];
check('sohbette emanet bilgisi (gönderen)', payerConv.escrow?.role === 'payer');
await call(earner.t, 'POST', `/conversations/${cid}/messages`, { body: 'tamam' });
await call(earner.t, 'POST', `/conversations/${cid}/messages`, { body: 'evet sana da selam' });
await wait(500);
check('kısa cevaplar jeton kazandırmaz', (await bal(earner)) === e0);
for (let i = 0; i < 3; i++) await call(earner.t, 'POST', `/conversations/${cid}/messages`, { body: `Merhaba ben iyiyim sen nasılsın ${i}` });
await wait(1000);
check('3 anlamlı cevaptan sonra 50 jeton geçer', (await bal(earner)) === e0 + 50, `${e0}→${await bal(earner)}`);
check('gönderenin jetonu hâlâ düşülmüş', (await bal(payer)) === p0);

// ---------- sohbet teması: ilk mesajı yazanın
const ta = await makeUser('Thma', 'male', 'female');
const tb = await makeUser('Thmb', 'female', 'male');
// Mağazadan balon + arka plan al, uygula
await call(ta.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
await call(ta.t, 'POST', '/store/purchase', { itemId: 'bubble_ocean' });
await call(ta.t, 'POST', '/store/purchase', { itemId: 'chatbg_hearts' });
const prof = (await call(ta.t, 'GET', '/me')).profile;
await call(ta.t, 'PUT', '/me/profile', { ...prof, chatBubbleThemeId: 'bubble_ocean', chatBackgroundThemeId: 'chatbg_hearts', birthDate: '1996-04-12' });
await call(ta.t, 'POST', '/swipes', { toId: tb.id, direction: 'like' });
const m = await call(tb.t, 'POST', '/swipes', { toId: ta.id, direction: 'like' });
const none = (await call(tb.t, 'GET', '/conversations'))._arr[0];
check('ilk mesaj yokken tema yok', none.theme === null);
await call(ta.t, 'POST', `/conversations/${m.conversationId}/messages`, { body: 'selam' });
const asB = (await call(tb.t, 'GET', '/conversations'))._arr[0];
check('karşı taraf başlatanın temasını görür', asB.theme?.chatBubbleThemeId === 'bubble_ocean' && asB.theme?.chatBackgroundThemeId === 'chatbg_hearts', JSON.stringify(asB.theme));

// ---------- aramada ilk 30 saniye ücretsiz (sunucu CALL_FREE_SECONDS=30 ile çalışıyor olmalı)
const caller = await makeUser('Cala', 'male', 'female');
const callee = await makeUser('Calb', 'female', 'male');
await call(caller.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
const cb0 = await bal(caller);
const c1 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
const acc1 = await call(callee.t, 'POST', `/calls/${c1.id}/accept`);
check('kabulde ücret alınmaz ve ücretsiz süre bilgisi var', (await bal(caller)) === cb0 && acc1.totalCoins === 0 && acc1.freeSeconds === FREE, `free=${acc1.freeSeconds} total=${acc1.totalCoins}`);
await wait(3000);
const end1 = await call(callee.t, 'POST', `/calls/${c1.id}/hangup`);
check('ücretsiz sürede kapatınca hiç ücret yok', end1.endReason === 'hangup' && (await bal(caller)) === cb0 && end1.totalCoins === 0, `bal ${cb0}→${await bal(caller)}`);

const c2 = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
await call(callee.t, 'POST', `/calls/${c2.id}/accept`);
// Agora ayarlıyken iki taraf da kanala katıldığını bildirmeli (yoksa 20 sn'de bağlantı kurulamadı sayılır)
await call(caller.t, 'POST', `/calls/${c2.id}/joined`);
await call(callee.t, 'POST', `/calls/${c2.id}/joined`);
await wait((FREE + 6) * 1000);
const mid = await call(caller.t, 'GET', `/calls/${c2.id}`);
check('30 sn sonra ilk dakika (15 jeton) alındı', (await bal(caller)) === cb0 - 15 && mid.billedMinutes === 1, `bal ${cb0}→${await bal(caller)} billed=${mid.billedMinutes}`);
await call(callee.t, 'POST', `/calls/${c2.id}/hangup`);

// ---------- günlük giriş ödülü
const d = await makeUser('Dayl', 'male', 'female');
await call(d.t, 'GET', '/me'); // seri bugün işlenir
const dr0 = await call(d.t, 'GET', '/me/daily-reward');
check('ödül alınabilir ve ilk gün 3 jeton', dr0.claimable === true && dr0.streak === 1 && dr0.todayCoins === 3 && dr0.cycle.length === 7, JSON.stringify({ c: dr0.claimable, s: dr0.streak, t: dr0.todayCoins }));
const bd0 = await bal(d);
const cl = await call(d.t, 'POST', '/me/daily-reward/claim');
check('ödül alındı (+3 jeton, promo kovası)', cl.status === 200 && cl.coins === 3 && (await bal(d)) === bd0 + 3, JSON.stringify({ s: cl.status, coins: cl.coins }));
const cl2 = await call(d.t, 'POST', '/me/daily-reward/claim');
check('aynı gün ikinci alım reddedilir', cl2.status === 409 && cl2.error === 'daily_already_claimed', JSON.stringify({ s: cl2.status, e: cl2.error }));
const dr1 = await call(d.t, 'GET', '/me/daily-reward');
check('takvimde bugün işaretli, alınamaz', dr1.claimedToday === true && dr1.claimable === false && dr1.claimedDays.length === 1 && dr1.monthCoins === 3);
check('sıradaki seri bonusu 7. günde +10', dr1.nextBonus?.streak === 7 && dr1.nextBonus?.coins === 10, JSON.stringify(dr1.nextBonus));

// ---------- süper beğeni: günlük 3 ücretsiz + paketler
const sm = await makeUser('Sprm', 'male', 'female');
const tg = [];
for (let i = 0; i < 5; i++) tg.push(await makeUser(`Spt${i}x`, 'female', 'male'));
const ss0 = await call(sm.t, 'GET', '/superlikes/status');
check('süper beğeni: günde 3 ücretsiz, 4 paket', ss0.daily === 3 && ss0.freeRemaining === 3 && ss0.packs.length === 4, JSON.stringify({ d: ss0.daily, f: ss0.freeRemaining }));
check('paket büyüdükçe adet fiyatı düşer', ss0.packs[0].unitPrice > ss0.packs[1].unitPrice && ss0.packs[2].unitPrice > ss0.packs[3].unitPrice);
const wb0 = await bal(sm);
for (let i = 0; i < 3; i++) {
  const r = await call(sm.t, 'POST', '/swipes', { toId: tg[i].id, direction: 'superlike' });
  check(`süper beğeni ${i + 1}/3 ücretsiz`, r.status === 200 && r.superLikes?.freeRemaining === 2 - i, JSON.stringify(r.superLikes));
}
check('ücretsiz süper beğeniler jeton harcamadı', (await bal(sm)) === wb0);
const blockedSl = await call(sm.t, 'POST', '/swipes', { toId: tg[3].id, direction: 'superlike' });
check('4. süper beğeni 403 + paketler', blockedSl.status === 403 && blockedSl.error === 'superlike_limit_reached' && blockedSl.superLikes?.packs?.length === 4, JSON.stringify({ s: blockedSl.status, e: blockedSl.error }));
await call(sm.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
const bb = await bal(sm);
const buy = await call(sm.t, 'POST', '/superlikes/buy', { packId: 'sl_10' });
check('10 adetlik paket 200 jeton, +10 hak', buy.status === 200 && buy.credits === 10 && bb - (await bal(sm)) === 200, JSON.stringify({ s: buy.status, c: buy.credits }));
const viaPack = await call(sm.t, 'POST', '/swipes', { toId: tg[3].id, direction: 'superlike' });
check('satın alınan hak kullanıldı ve ücretsiz sayımı etkilemedi', viaPack.status === 200 && viaPack.superLikes?.credits === 9 && viaPack.superLikes?.used === 3, JSON.stringify(viaPack.superLikes));
const dupe = await call(sm.t, 'POST', '/swipes', { toId: tg[3].id, direction: 'superlike' });
check('aynı kişiye tekrar süper beğeni hak harcamaz', dupe.status === 200 && dupe.superLikes?.credits === 9);
const badPack = await call(sm.t, 'POST', '/superlikes/buy', { packId: 'sl_999' });
check('geçersiz paket reddedilir', badPack.status === 400);

summary();
