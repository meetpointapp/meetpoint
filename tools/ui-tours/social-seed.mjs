// Faz 22 demo verisi: birkaç mavi tikli hesaba gönderi, yorum, beğeni, takip ve hikaye ekler.
// Önce `node --env-file=.env scripts/verify-demo.mjs` benzeri bir adımla deniz5/mert6 doğrulanmış olmalı
// (bu betik sadece API kullanır; doğrulanmamış hesaplar için gönderi adımını atlar).
import { call } from './lib.mjs';

const login = async (mail) => (await call(null, 'POST', '/auth/login', { email: `${mail}@meetpoint.dev`, password: 'password123' })).token;
const users = Object.fromEntries(await Promise.all(['aye0', 'elif2', 'test', 'deniz5', 'mert6', 'can7'].map(async (m) => [m, await login(m)])));
const ids = Object.fromEntries(await Promise.all(Object.entries(users).map(async ([m, t]) => [m, (await call(t, 'GET', '/me')).id])));

const posts = [
  ['aye0', 'Moda sahilinde kahve ve kitap... Hafta sonu için planı olan var mı? ☕📚', 'coffee'],
  ['elif2', 'Bu hafta sürekli indie listeleri dinliyorum. Önerisi olan?', 'music'],
  ['test', 'Pazar günü Belgrad Ormanı\'nda yürüyüşe çıkıyorum. Katılmak isteyen yazsın!', 'hiking'],
  ['deniz5', 'Konser sezonu başlıyor! En çok hangi festivali bekliyorsunuz?', 'concerts'],
  ['mert6', 'Yeni bir oyun keşfettim, saatler su gibi geçti 🎮', 'gaming'],
  ['aye0', 'Bugün yeni bir kafe buldum, kruvasanı efsane. Adresini DM\'den veririm.', 'foodie'],
];
const created = [];
for (const [who, body, interest] of posts) {
  const r = await call(users[who], 'POST', '/posts', { body, interest });
  console.log(who, r.status, r.error ?? 'ok');
  if (r.id) created.push({ id: r.id, who });
}

// Yorumlar ve beğeniler
const comments = ['Bence harika bir fikir!', 'Ben de katılırım 🙌', 'Bunu çok sevdim', 'Hangi saatte buluşuyoruz?'];
let i = 0;
for (const p of created) {
  for (const who of ['aye0', 'elif2', 'test', 'deniz5', 'mert6']) {
    if (who === p.who) continue;
    await call(users[who], 'PUT', `/posts/${p.id}/like`);
    if (i % 2 === 0) await call(users[who], 'POST', `/posts/${p.id}/comments`, { body: comments[i % comments.length] });
    i++;
  }
  await call(users.can7, 'PUT', `/posts/${p.id}/like`);
}

// Takip ilişkileri (mert6 çoğunu takip eder; aye0 ile takipleşir)
const follows = [['mert6', 'aye0'], ['mert6', 'elif2'], ['mert6', 'test'], ['aye0', 'mert6'], ['deniz5', 'aye0'], ['can7', 'aye0'], ['can7', 'elif2'], ['elif2', 'aye0'], ['test', 'aye0']];
for (const [a, b] of follows) await call(users[a], 'PUT', `/users/${ids[b]}/follow`);

// Hikayeler
const stories = [['aye0', 'Hafta sonu planı: kitap + kahve ☕', 'sunset'], ['elif2', 'Bugün ruh halim: müzik 🎧', 'grape'], ['deniz5', 'Konsere 3 gün kaldı!', 'night'], ['test', 'Yürüyüş rotası hazır 🌲', 'forest']];
for (const [who, text, bg] of stories) {
  const r = await call(users[who], 'POST', '/stories', { kind: 'text', text, bg });
  console.log('hikaye', who, r.status);
}
console.log('tamam');
