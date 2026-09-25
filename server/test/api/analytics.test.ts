// Faz 16: gizlilik dostu kullanım hunisi (kayıt → eşleşme → ilk mesaj → ilk satın alma).
// Kendi sunucumuzda, sadece "analytics" rızası verilmiş kullanıcılar için; rıza yoksa hiç yazılmaz.
import { describe, it } from 'vitest';
import { call, check, makeAdmin, makeUser, testDb } from '../helpers';

describe('Kullanım analitiği hunisi (Faz 16)', () => {
  it('rıza verilmemişse hiçbir olay yazılmaz', async () => {
    const db = await testDb();
    const a = await makeUser('Anlt1a', 'male', 'female');
    const b = await makeUser('Anlt1b', 'female', 'male');
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    await call(a.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });

    const rows = await db.analyticsEvent.findMany({ where: { userId: { in: [a.id, b.id] } } });
    check('rıza verilmeden hiçbir olay yazılmaz', rows.length === 0, `rows=${rows.length}`);
  });

  it('rızayla geriye dönük ve ileriye dönük kayıt, idempotent, panelde görünür', async () => {
    const db = await testDb();
    const a = await makeUser('Anlt2a', 'male', 'female');
    const b = await makeUser('Anlt2b', 'female', 'male');

    // Rıza kayıttan sonra veriliyor: o ana kadar zaten doğrulanmış hesap "REGISTERED" olarak
    // geriye dönük işaretlenmeli (yeni bir izleme değil, zaten var olan durumun özeti)
    const consentRes = await call(a.t, 'PUT', '/me/consents', { kind: 'analytics', granted: true, source: 'settings' });
    check('rıza kaydedildi', consentRes.analytics === true);
    const afterConsent = await db.analyticsEvent.findMany({ where: { userId: a.id } });
    check('rıza verilince REGISTERED geriye dönük işaretlenir', afterConsent.some((e) => e.kind === 'REGISTERED'), JSON.stringify(afterConsent.map((e) => e.kind)));

    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const m = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
    check('eşleşme oldu', m.match === true);
    await call(a.t, 'POST', `/conversations/${m.conversationId}/messages`, { body: 'merhaba' });
    const topup = await call(a.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    check('satın alma başarılı', topup.coins === 500, JSON.stringify(topup));

    const kinds = (await db.analyticsEvent.findMany({ where: { userId: a.id } })).map((r) => r.kind).sort();
    check(
      'dört aşama da kayıtlı (a için)',
      JSON.stringify(kinds) === JSON.stringify(['FIRST_MESSAGE', 'FIRST_PURCHASE', 'MATCHED', 'REGISTERED']),
      kinds.join(','),
    );

    // Aynı aşama tekrar tetiklenirse ikinci satır oluşmaz (userId+kind benzersiz)
    await call(a.t, 'POST', `/conversations/${m.conversationId}/messages`, { body: 'tekrar' });
    const firstMessageRows = await db.analyticsEvent.findMany({ where: { userId: a.id, kind: 'FIRST_MESSAGE' } });
    check('tekrar mesaj gönderince ikinci FIRST_MESSAGE satırı oluşmaz', firstMessageRows.length === 1, `count=${firstMessageRows.length}`);

    // b hiç rıza vermedi: eşleşmiş olsa da onun için hiçbir satır yok
    const bRows = await db.analyticsEvent.findMany({ where: { userId: b.id } });
    check('rıza vermeyen kullanıcı (b) için kayıt yok', bRows.length === 0, `rows=${bRows.length}`);

    // Panel: finans rolü toplam sayıları görebilir, moderatör göremez
    const fin = await makeAdmin('finance');
    const funnel = await call(fin.t, 'GET', '/admin/api/finance/funnel');
    const registered = funnel.funnel.find((f: { stage: string; count: number }) => f.stage === 'REGISTERED');
    check('panelde en az bir REGISTERED sayılıyor', registered?.count >= 1, JSON.stringify(funnel.funnel));
    check('rıza veren kullanıcı sayısı en az 1', funnel.consented >= 1, `consented=${funnel.consented}`);

    const mod = await makeAdmin('moderator');
    const forbidden = await call(mod.t, 'GET', '/admin/api/finance/funnel');
    check('moderatör kullanım hunisini göremez', forbidden.http === 403);
  });

  it('rıza geri alınınca yeni aşama kaydedilmez', async () => {
    const db = await testDb();
    const a = await makeUser('Anlt3a', 'male', 'female');
    const b = await makeUser('Anlt3b', 'female', 'male');
    await call(a.t, 'PUT', '/me/consents', { kind: 'analytics', granted: true, source: 'settings' });
    await call(a.t, 'PUT', '/me/consents', { kind: 'analytics', granted: false, source: 'settings' });

    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });

    const rows = await db.analyticsEvent.findMany({ where: { userId: a.id, kind: 'MATCHED' } });
    check('rıza geri alınınca yeni aşama kaydedilmez', rows.length === 0, `rows=${rows.length}`);
  });
});
