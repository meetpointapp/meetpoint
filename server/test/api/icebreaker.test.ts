// Faz 17: sohbet içi buz kırıcı mini oyunlar ("bu mu o mu", "2 doğru 1 yalan"). Mesajlardan ayrı
// bir tabloda (IcebreakerGame): "2 doğru 1 yalan"da lieIndex cevaplanana kadar sadece başlatana
// döner — bu yüzden maskeleme davranışını hem başlatan hem cevaplayan taraftan doğruluyoruz.
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

async function matched(nameA: string, nameB: string) {
  const a = await makeUser(nameA, 'male', 'female');
  const b = await makeUser(nameB, 'female', 'male');
  await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
  const r = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
  return { a, b, conversationId: r.conversationId as string };
}

describe('Sohbet içi buz kırıcı mini oyunlar (Faz 17)', () => {
  it('"bu mu o mu": başlatılır, karşı taraf cevaplar, her iki seçim de görünür', async () => {
    const { a, b, conversationId } = await matched('Ice1a', 'Ice1b');

    const started = await call(a.t, 'POST', `/conversations/${conversationId}/icebreaker`, {
      kind: 'this_or_that',
      promptId: 'coffee_or_tea',
      choice: 'a',
    });
    check('oyun oluşturuldu', started.http === 201);
    check('başlatanın seçimi görünür', started.starterChoice === 'a');
    check('cevaplayan henüz yok', started.responderId == null);

    const seenByB = await call(b.t, 'GET', `/conversations/${conversationId}/icebreaker`);
    check('B listede oyunu görür', seenByB._arr?.length === 1);
    check('B başlatanın seçimini görür (bu mu o mu gizli değil)', seenByB._arr[0].starterChoice === 'a');

    const answered = await call(b.t, 'POST', `/conversations/${conversationId}/icebreaker/${started.id}/answer`, { choice: 'b' });
    check('cevap kaydedildi', answered.http === 200);
    check('cevaplayanın seçimi görünür', answered.responderChoice === 'b');

    const meA = await call(a.t, 'GET', '/me');
    const meB = await call(b.t, 'GET', '/me');
    const doneA = meA.achievements.iletisim.milestones.find((m: { id: string }) => m.id === 'first_icebreaker');
    const doneB = meB.achievements.iletisim.milestones.find((m: { id: string }) => m.id === 'first_icebreaker');
    check('A: first_icebreaker açıldı', doneA?.done === true);
    check('B: first_icebreaker açıldı', doneB?.done === true);
  });

  it('"2 doğru 1 yalan": yalan hangisi cevaplanana kadar sadece başlatana görünür', async () => {
    const { a, b, conversationId } = await matched('Ice2a', 'Ice2b');

    const started = await call(a.t, 'POST', `/conversations/${conversationId}/icebreaker`, {
      kind: 'two_truths',
      statements: ['Kediler beslerim', 'Üç dil biliyorum', 'Ayda yürüdüm'],
      lieIndex: 2,
    });
    check('oyun oluşturuldu', started.http === 201);
    check('başlatan yalanı görür', started.lieIndex === 2);

    const seenByB = await call(b.t, 'GET', `/conversations/${conversationId}/icebreaker`);
    check('B henüz yalanı GÖRMEZ (cevaplanmadı)', seenByB._arr[0].lieIndex === null);

    const wrongGuess = await call(b.t, 'POST', `/conversations/${conversationId}/icebreaker/${started.id}/answer`, { choice: '0' });
    check('cevap kaydedildi', wrongGuess.http === 200);
    check('cevaplandıktan sonra B de yalanı görür', wrongGuess.lieIndex === 2);
    check('B in tahmini (yanlış) görünür', wrongGuess.responderChoice === '0');

    // Aynı oyun tekrar cevaplanamaz
    const again = await call(b.t, 'POST', `/conversations/${conversationId}/icebreaker/${started.id}/answer`, { choice: '1' });
    check('ikinci kez cevap reddedilir', again.http === 400);
  });

  it('başlatan kendi oyununu cevaplayamaz', async () => {
    const { a, conversationId } = await matched('Ice3a', 'Ice3b');
    const started = await call(a.t, 'POST', `/conversations/${conversationId}/icebreaker`, {
      kind: 'this_or_that',
      promptId: 'sea_or_mountain',
      choice: 'a',
    });
    const selfAnswer = await call(a.t, 'POST', `/conversations/${conversationId}/icebreaker/${started.id}/answer`, { choice: 'b' });
    check('kendi oyununu cevaplayamaz', selfAnswer.http === 400);
  });

  it('"2 doğru 1 yalan": iletişim bilgisi içeren ifade reddedilir', async () => {
    const { a, conversationId } = await matched('Ice4a', 'Ice4b');
    const started = await call(a.t, 'POST', `/conversations/${conversationId}/icebreaker`, {
      kind: 'two_truths',
      statements: ['Beni 0532 123 45 67 numaralı telefondan ara', 'İkinci ifade', 'Üçüncü ifade'],
      lieIndex: 0,
    });
    check('iletişim bilgisi içeren ifade reddedilir', started.http === 400);
  });

  it('geçersiz "bu mu o mu" cevabı reddedilir', async () => {
    const { a, b, conversationId } = await matched('Ice5a', 'Ice5b');
    const started = await call(a.t, 'POST', `/conversations/${conversationId}/icebreaker`, {
      kind: 'this_or_that',
      promptId: 'book_or_movie',
      choice: 'a',
    });
    const bad = await call(b.t, 'POST', `/conversations/${conversationId}/icebreaker/${started.id}/answer`, { choice: 'c' });
    check('geçersiz seçim reddedilir', bad.http === 400);
  });
});
