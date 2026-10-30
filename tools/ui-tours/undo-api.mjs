// Faz 24 canlı API kontrolü: keşfette "geri al" (son kaydırma, günlük hak, iade, profil tamamlama sırası).
// Çalıştırma:  node undo-api.mjs   (geliştirme sunucusu açık olmalı)
import { call, check, summary } from './lib.mjs';

const login = async (m) => (await call(null, 'POST', '/auth/login', { email: `${m}@meetpoint.dev`, password: 'password123' })).token;
const t = await login('can7');

const status0 = await call(t, 'GET', '/discover/undo-status');
check('geri al durumu okunur', status0.limit >= 3 && status0.remaining <= status0.limit, JSON.stringify(status0));

const deck = (await call(t, 'GET', '/discover'))._arr ?? [];
check('destede kişi var', deck.length >= 2);
const [a, b] = deck;

// Geçmek (pass) ve geri almak
const s1 = await call(t, 'POST', '/swipes', { toId: a.id, direction: 'pass' });
check('kaydırma kabul edilir', s1.status === 200);
const wrong = await call(t, 'POST', '/swipes/undo', { toId: b.id });
check('son kaydırma dışındaki geri alınamaz', wrong.status === 409 && wrong.error === 'undo_unavailable', `${wrong.status} ${wrong.error}`);
const u1 = await call(t, 'POST', '/swipes/undo', { toId: a.id });
check('son kaydırma geri alınır', u1.status === 200 && u1.undone?.toId === a.id && u1.undo.remaining === status0.remaining - 1, JSON.stringify(u1.undo));
const again = await call(t, 'POST', '/swipes/undo', { toId: a.id });
check('aynı kaydırma iki kez geri alınamaz', again.status === 409);
const deck2 = (await call(t, 'GET', '/discover'))._arr ?? [];
check('geri alınan kişi yeniden destede', deck2.some((p) => p.id === a.id));

// Beğeni geri alınınca hak geri gelir
const l0 = (await call(t, 'GET', '/discover/like-status')).used;
await call(t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
const l1 = (await call(t, 'GET', '/discover/like-status')).used;
const u2 = await call(t, 'POST', '/swipes/undo', { toId: a.id });
const l2 = (await call(t, 'GET', '/discover/like-status')).used;
check('beğeni hakkı geri alınınca iade olur', l1 === l0 + 1 && l2 === l0 && u2.status === 200, `${l0} ${l1} ${l2}`);

// Temizlik: geri alma hakkı denemelerinden kalan durum zararsız (günlük pencere)
summary();
