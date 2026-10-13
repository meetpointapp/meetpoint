// Faz 23 canlı API kontrolü: Doğruluk mu Cesaret mi (10 tur, rastgele soru, cevaplar iki taraf da yanıtlayınca açılır).
// Çalıştırma:  node --env-file=../../server/.env truthdare-api.mjs   (geliştirme sunucusu açık olmalı)
import { createRequire } from 'node:module';
import { call, check, summary } from './lib.mjs';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const login = async (m) => (await call(null, 'POST', '/auth/login', { email: `${m}@meetpoint.dev`, password: 'password123' })).token;
const can = await login('can7');
const aye = await login('aye0');
const ayeId = (await call(aye, 'GET', '/me')).id;
const canId = (await call(can, 'GET', '/me')).id;

// Temiz başlangıç: bu iki kişi arasındaki eski oyunlar silinir
await db.truthDareGame.deleteMany({ where: { OR: [{ userAId: canId, userBId: ayeId }, { userAId: ayeId, userBId: canId }] } });

const g = await call(can, 'POST', '/games/truth-dare', { toId: ayeId });
check('oyun başlar', g.status === 201 && g.id && g.round === 1 && g.totalRounds === 10 && g.myTurn === true, `${g.status} ${g.error ?? ''}`);
const again = await call(can, 'POST', '/games/truth-dare', { toId: ayeId });
check('aynı çift için açık oyun tekrar oluşmaz', again.id === g.id);

// Davet edilen taraf listede görür, sırası var
const list = await call(aye, 'GET', '/games/truth-dare');
check('davet edilen listede görür', list.games?.some((x) => x.id === g.id && x.myTurn === true && x.initiatedByMe === false));

const noChoice = await call(can, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: 'Selam' });
check('önce seçim yapılmalı', noChoice.status === 409 && noChoice.error === 'choose_first', `${noChoice.status} ${noChoice.error}`);

const used = new Set();
let game = g;
for (let round = 1; round <= 10; round++) {
  // İki taraf da seçer; sırayla doğruluk ve cesaret
  const c1 = await call(can, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: round % 2 ? 'truth' : 'dare' });
  const c2 = await call(aye, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: round % 2 ? 'dare' : 'truth' });
  if (round === 1) {
    check('sunucu soru verir (kendi dilimde)', c1.current?.mine?.prompt?.text?.length > 5 && c1.current.mine.prompt.kind === 'truth', JSON.stringify(c1.current?.mine?.prompt));
    check('karşı tarafın sorusu gizli', c1.current.theirs.prompt === null && c1.current.theirs.answer === '');
    const dupChoose = await call(can, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: 'dare' });
    check('aynı tur ikinci kez seçilemez', dupChoose.status === 409);
    const phone = await call(can, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: 'Beni ara 0532 123 45 67' });
    check('iletişim bilgisi içeren cevap reddedilir', phone.status === 400 && phone.error === 'contact_info_not_allowed');
  }
  used.add(c1.current.mine.prompt.id);
  used.add(c2.current.mine.prompt.id);

  const a1 = await call(can, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: `Cevabım ${round} (can)` });
  if (round === 1) {
    check('ilk cevap sonrası bekleniyor, tur ilerlemez', a1.round === 1 && a1.current.mine.answered === true && a1.current.theirs.answered === false && a1.history.length === 0);
    const peek = await call(aye, 'GET', `/games/truth-dare/${g.id}`);
    check('diğer taraf cevabı görmez ama cevapladığını bilir', peek.current.theirs.answered === true && peek.current.theirs.answer === '' && peek.myTurn === true);
  }
  game = await call(aye, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: `Cevabım ${round} (aye)` });
  if (round === 1) {
    check('ikisi de cevaplayınca açılır ve sonraki tura geçilir', game.round === 2 && game.history.length === 1 && game.history[0].theirs.answer === 'Cevabım 1 (can)' && game.history[0].mine.answer === 'Cevabım 1 (aye)', JSON.stringify(game.history?.[0]));
  }
}
check('10 tur sonunda oyun biter', game.state === 'FINISHED' && game.history.length === 10, `${game.state} ${game.history?.length}`);
check('hiçbir soru tekrar edilmedi (20 farklı soru)', used.size === 20, `${used.size}`);
const late = await call(can, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: 'truth' });
check('biten oyunda işlem yapılamaz', late.status === 409 && late.error === 'game_not_active');

// Yeni oyun, reddetme
const g2 = await call(can, 'POST', '/games/truth-dare', { toId: ayeId });
check('bittikten sonra yeni oyun başlatılabilir', g2.status === 201 && g2.id !== g.id);
const dec = await call(aye, 'POST', `/games/truth-dare/${g2.id}/end`);
check('davet edilen reddedebilir', dec.state === 'DECLINED', dec.state);

// Engelleme
const g3 = await call(can, 'POST', '/games/truth-dare', { toId: ayeId });
await call(aye, 'POST', '/blocks', { toId: canId });
const blockedGame = await call(can, 'GET', `/games/truth-dare/${g3.id}`);
check('engellenince açık oyun kapanır', blockedGame.state === 'ENDED', blockedGame.state);
const blockedStart = await call(can, 'POST', '/games/truth-dare', { toId: ayeId });
check('engellenen yeni oyun başlatamaz', blockedStart.status === 404);
await call(aye, 'DELETE', `/blocks/${canId}`);

await db.truthDareGame.deleteMany({ where: { OR: [{ userAId: canId, userBId: ayeId }, { userAId: ayeId, userBId: canId }] } });
await db.$disconnect();
summary();
