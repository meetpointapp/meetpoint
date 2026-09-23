// Faz 4: etkileşim testleri
import { describe, it } from 'vitest';
import fs from 'node:fs';
import { io } from 'socket.io-client';
import { B, call, check, registerVerified, upload, PRIVATE_DIR } from '../helpers';

describe('Etkileşim (Faz 4)', () => {
  it('senaryo', async () => {
    const tag = Date.now();
    const mk = async (name, gender, interestedIn, birthDate, loc) => {
      const u = await registerVerified(`${name.toLowerCase()}${tag}@test.com`);
      await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate, gender, interestedIn });
      await upload(u.t, '/me/photos', 'photo');
      if (loc) await call(u.t, 'PUT', '/me/location', loc);
      return u;
    };

    // İstanbul'da bir erkek, farklı şehirlerde/yaşlarda kadınlar
    const me = await mk('Viewer', 'male', 'female', '1995-01-01', { latitude: 41.0369, longitude: 28.9855 });
    const near = await mk('Near', 'female', 'male', '1996-01-01', { latitude: 41.06, longitude: 29.01 }); // ~3 km
    const far = await mk('Far', 'female', 'male', '1996-01-01', { latitude: 38.42, longitude: 27.14 }); // İzmir ~330 km
    const old = await mk('Old', 'female', 'male', '1970-01-01', { latitude: 41.02, longitude: 28.97 });
    const noloc = await mk('NoLoc', 'female', 'male', '1997-01-01', null);

    // --- 1. Konum ve mesafe
    const meInfo = await call(me.t, 'GET', '/me');
    check('location saved', meInfo.hasLocation === true);
    let deck = await call(me.t, 'GET', '/discover');
    const find = (d, u) => d._arr?.find((p) => p.id === u.id);
    check('distance shown (~3 km)', find(deck, near)?.distanceKm >= 1 && find(deck, near)?.distanceKm <= 6, `km=${find(deck, near)?.distanceKm}`);
    check('exact coords never exposed', !('latitude' in (find(deck, near) ?? {})) && !('longitude' in (find(deck, near) ?? {})));
    check('unknown location -> null distance', find(deck, noloc)?.distanceKm === null);
    const nearIdx = deck._arr.findIndex((p) => p.id === near.id);
    const farIdx = deck._arr.findIndex((p) => p.id === far.id);
    check('closer profiles first', nearIdx >= 0 && farIdx >= 0 && nearIdx < farIdx);

    // --- 2. Filtreler
    const badRange = await call(me.t, 'PUT', '/me/filters', { minAge: 40, maxAge: 30, maxKm: 0 });
    check('invalid age range rejected', badRange.http === 400);
    await call(me.t, 'PUT', '/me/filters', { minAge: 18, maxAge: 40, maxKm: 50 });
    deck = await call(me.t, 'GET', '/discover');
    check('distance filter excludes far', !find(deck, far));
    check('distance filter keeps near', !!find(deck, near));
    check('age filter excludes 56-year-old', !find(deck, old));
    check('unknown-location profiles still shown', !!find(deck, noloc));
    await call(me.t, 'PUT', '/me/filters', { minAge: 18, maxAge: 80, maxKm: 0 });

    // --- 3. Süper beğeni
    // 50 hediye jetonla bir süper beğeni (30) yapılabilir; ikincisine (kalan 20) yetmez
    const sl = await call(me.t, 'POST', '/swipes', { toId: far.id, direction: 'superlike' });
    check('superlike ok with signup gift', sl.http === 200 && sl.match === false);
    await call(me.t, 'POST', '/swipes', { toId: far.id, direction: 'superlike' });
    let w = await call(me.t, 'GET', '/wallet');
    check('superlike charged once (30)', w.balance === 20, `balance=${w.balance}`);
    const poorSuper = await call(me.t, 'POST', '/swipes', { toId: noloc.id, direction: 'superlike' });
    check('superlike needs coins', poorSuper.http === 402);
    await call(me.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' }); // 20 + 1000 + 500 bonus = 1520
    const farDeck = await call(far.t, 'GET', '/discover');
    check('superliker shown first to target', farDeck._arr?.[0]?.id === me.id && farDeck._arr[0].superLikedMe === true);
    const back = await call(far.t, 'POST', '/swipes', { toId: me.id, direction: 'like' });
    check('like back on superlike -> match', back.match === true);

    // --- 4. Öne çıkarma
    const boost = await call(near.t, 'POST', '/boost');
    check('boost needs coins', boost.http === 402);
    await call(near.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const boosted = await call(near.t, 'POST', '/boost');
    check('boost ok', boosted.http === 200 && !!boosted.boostedUntil);
    const again = await call(near.t, 'POST', '/boost');
    check('double boost rejected', again.http === 409);
    w = await call(near.t, 'GET', '/wallet');
    // 50 hediye + 500 + 250 bonus - 150 = 650
    check('boost charged 150', w.balance === 650, `balance=${w.balance}`);
    const viewer2 = await mk('Viewer2', 'male', 'female', '1994-01-01', { latitude: 38.42, longitude: 27.14 }); // İzmir
    const v2deck = await call(viewer2.t, 'GET', '/discover');
    check('boosted profile ranked above closer ones', v2deck._arr?.[0]?.id === near.id, v2deck._arr?.map((p) => p.displayName).join(','));

    // --- 5. Seni beğenenler
    await call(noloc.t, 'POST', '/swipes', { toId: me.id, direction: 'like' });
    await call(old.t, 'POST', '/swipes', { toId: me.id, direction: 'like' });
    let likes = await call(me.t, 'GET', '/likes');
    check('likes locked: count only', likes.unlocked === false && likes.count === 2 && likes.users.length === 0, `count=${likes.count}`);
    const unlock = await call(me.t, 'POST', '/likes/unlock');
    check('unlock ok', unlock.http === 200 && !!unlock.unlockedUntil);
    await call(me.t, 'POST', '/likes/unlock');
    w = await call(me.t, 'GET', '/wallet');
    check('unlock charged once (200)', w.balance === 1320, `balance=${w.balance}`);
    likes = await call(me.t, 'GET', '/likes');
    check('likes unlocked: profiles listed', likes.unlocked === true && likes.users.length === 2);
    await call(me.t, 'POST', '/swipes', { toId: noloc.id, direction: 'pass' });
    likes = await call(me.t, 'GET', '/likes');
    check('answered likes disappear', likes.count === 1);

    // --- 6. Okundu bilgisi + yazıyor
    const convs = await call(me.t, 'GET', '/conversations');
    const conv = convs._arr.find((c) => c.user.id === far.id);
    const sockMe = io(B, { auth: { token: me.t }, transports: ['websocket'] });
    const sockFar = io(B, { auth: { token: far.t }, transports: ['websocket'] });
    await new Promise((r) => setTimeout(r, 800));
    const typingSeen = new Promise((resolve) => {
      sockMe.on('typing', (p) => resolve(p.conversationId === conv.id));
      setTimeout(() => resolve(false), 2000);
    });
    sockFar.emit('typing', { conversationId: conv.id });
    check('typing relayed to other side', await typingSeen);
    // Sohbete dahil olmayan biri yazıyor olayı gönderemez
    const outsider = io(B, { auth: { token: noloc.t }, transports: ['websocket'] });
    await new Promise((r) => setTimeout(r, 500));
    let leaked = false;
    sockMe.on('typing', (p) => { if (p.userId === noloc.id) leaked = true; });
    outsider.emit('typing', { conversationId: conv.id });
    await new Promise((r) => setTimeout(r, 700));
    check('outsider cannot send typing', !leaked);

    const readEvent = new Promise((resolve) => {
      sockFar.on('message:read', (p) => resolve(p.conversationId === conv.id));
      setTimeout(() => resolve(false), 2000);
    });
    await call(far.t, 'POST', `/conversations/${conv.id}/messages`, { body: 'Merhaba!' });
    await call(far.t, 'POST', `/conversations/${conv.id}/messages`, { body: 'Nasılsın?' });
    let myConvs = await call(me.t, 'GET', '/conversations');
    check('unread count = 2', myConvs._arr.find((c) => c.id === conv.id)?.unreadCount === 2);
    await call(me.t, 'POST', `/conversations/${conv.id}/read`);
    check('read event sent to sender', await readEvent);
    myConvs = await call(me.t, 'GET', '/conversations');
    check('unread count reset', myConvs._arr.find((c) => c.id === conv.id)?.unreadCount === 0);
    const msgs = await call(far.t, 'GET', `/conversations/${conv.id}/messages`);
    check('messages have readAt', msgs._arr?.filter((m) => m.senderId === far.id).every((m) => m.readAt));

    // --- 7. Tek seferlik fotoğraf
    const sent = await upload(far.t, `/conversations/${conv.id}/photos`, 'photo');
    check('photo message sent', sent.http === 201 && sent.kind === 'photo');
    check('photo path not exposed', !('photoPath' in sent));
    const senderView = await fetch(`${B}/messages/${sent.id}/photo`, { headers: { authorization: `Bearer ${far.t}` } });
    check('sender cannot open view-once', senderView.status === 403);
    const viewedEvent = new Promise((resolve) => {
      sockFar.on('message:viewed', (p) => resolve(p.id === sent.id));
      setTimeout(() => resolve(false), 2000);
    });
    const first = await fetch(`${B}/messages/${sent.id}/photo`, { headers: { authorization: `Bearer ${me.t}` } });
    check('recipient opens once', first.status === 200 && (await first.arrayBuffer()).byteLength > 0);
    check('sender notified of view', await viewedEvent);
    const second = await fetch(`${B}/messages/${sent.id}/photo`, { headers: { authorization: `Bearer ${me.t}` } });
    check('second open rejected', second.status === 410);
    const outsiderView = await fetch(`${B}/messages/${sent.id}/photo`, { headers: { authorization: `Bearer ${noloc.t}` } });
    check('outsider cannot open', outsiderView.status === 404);
    await new Promise((r) => setTimeout(r, 300));
    const chatDir = `${PRIVATE_DIR}/chat`;
    const leftovers = fs.existsSync(chatDir) ? fs.readdirSync(chatDir) : [];
    check('photo file deleted after view', leftovers.length === 0, `left=${leftovers.length}`);

    // --- 8. Push cihaz kaydı
    const dev = await call(me.t, 'POST', '/me/devices', { token: `test-token-${tag}-abcdef`, platform: 'android' });
    check('device registered', dev.http === 200);
    const devDel = await call(me.t, 'DELETE', '/me/devices', { token: `test-token-${tag}-abcdef` });
    check('device removed', devDel.http === 200);

    sockMe.close();
    sockFar.close();
    outsider.close();
  });
});
