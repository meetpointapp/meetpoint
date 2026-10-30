// Faz 24 canlı kontrol: basılı tutarak yakalanan beğeni gücü (strength) sunucuda saklanır.
import { call, check, summary } from './lib.mjs';
const t = (await call(null, 'POST', '/auth/login', { email: 'can7@meetpoint.dev', password: 'password123' })).token;
const deck = (await call(t, 'GET', '/discover'))._arr ?? [];
check('destede kişi var', deck.length >= 2);
const [a, b] = deck;
const r1 = await call(t, 'POST', '/swipes', { toId: a.id, direction: 'like', strength: 2 });
check('güçlü beğeni kabul edilir', r1.status === 200, JSON.stringify(r1));
const bad = await call(t, 'POST', '/swipes', { toId: b.id, direction: 'like', strength: 5 });
check('geçersiz güç reddedilir', bad.status === 400, String(bad.status));
const r2 = await call(t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
check('gücü verilmeyen beğeni varsayılan', r2.status === 200);
console.log(JSON.stringify({ a: a.id, b: b.id }));
summary();
