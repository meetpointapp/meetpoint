// Faz 17 madde 5: sohbet içi iki kişilik XOX (tic-tac-toe). Başlatan her zaman X'tir ve ilk hamleyi
// yapar; sıradaki taraf hamle yapmadan önce API sırayı, boş hücreyi ve oyunun aktif olduğunu denetler.
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

async function matched(nameA: string, nameB: string) {
  const a = await makeUser(nameA, 'male', 'female');
  const b = await makeUser(nameB, 'female', 'male');
  await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
  const r = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
  return { a, b, conversationId: r.conversationId as string };
}

async function move(t: string, conversationId: string, gameId: string, position: number) {
  return call(t, 'POST', `/conversations/${conversationId}/tictactoe/${gameId}/move`, { position });
}

describe('Sohbet içi iki kişilik XOX (Faz 17)', () => {
  it('X üst sırayı tamamlayınca kazanır, sıra doğru sırayla değişir', async () => {
    const { a, b, conversationId } = await matched('Tac1a', 'Tac1b');

    const started = await call(a.t, 'POST', `/conversations/${conversationId}/tictactoe`, {});
    check('oyun oluşturuldu', started.http === 201);
    check('başlatan X', started.starterId === a.id);
    check('sıra başlatanda', started.turnUserId === a.id);
    check('tahta boş', started.board.every((c: unknown) => c === null));

    const seenByB = await call(b.t, 'GET', `/conversations/${conversationId}/tictactoe`);
    check('B listede oyunu görür', seenByB._arr?.length === 1);

    // A(X)->0, B(O)->3, A(X)->1, B(O)->4, A(X)->2 (0,1,2 satırı, X kazanır)
    const m1 = await move(a.t, conversationId, started.id, 0);
    check('A hamlesi kaydedildi', m1.http === 200 && m1.board[0] === 'X');
    check('sıra B ye geçti', m1.turnUserId === b.id);

    const wrongTurn = await move(a.t, conversationId, started.id, 5);
    check('sırası olmayan hamle reddedilir', wrongTurn.http === 400);

    const m2 = await move(b.t, conversationId, started.id, 3);
    check('B hamlesi kaydedildi', m2.board[3] === 'O');

    const occupied = await move(a.t, conversationId, started.id, 0);
    check('dolu hücreye hamle reddedilir', occupied.http === 400);

    const m3 = await move(a.t, conversationId, started.id, 1);
    check('A ikinci hamlesi kaydedildi', m3.board[1] === 'X');
    await move(b.t, conversationId, started.id, 4);
    const win = await move(a.t, conversationId, started.id, 2);
    check('X kazandı', win.status === 'won' && win.winnerId === a.id);

    const afterWin = await move(b.t, conversationId, started.id, 5);
    check('biten oyunda hamle reddedilir', afterWin.http === 400);

    // Oyun bitince aynı sohbette yeni oyun başlatılabilir
    const again = await call(b.t, 'POST', `/conversations/${conversationId}/tictactoe`, {});
    check('yeni oyun başlatılabilir', again.http === 201 && again.starterId === b.id);
  });

  it('tahta dolup kazanan olmayınca berabere biter', async () => {
    const { a, b, conversationId } = await matched('Tac2a', 'Tac2b');
    const started = await call(a.t, 'POST', `/conversations/${conversationId}/tictactoe`, {});

    const sequence: Array<[string, number]> = [
      [a.t, 0], [b.t, 1], [a.t, 2], [b.t, 5], [a.t, 3], [b.t, 6], [a.t, 4], [b.t, 8], [a.t, 7],
    ];
    let last;
    for (const [t, pos] of sequence) {
      last = await move(t, conversationId, started.id, pos);
    }
    check('son hamle başarılı', last!.http === 200);
    check('berabere', last!.status === 'draw');
    check('kazanan yok', last!.winnerId === null);
  });

  it('aktif oyun varken ikinci oyun başlatılamaz', async () => {
    const { a, conversationId } = await matched('Tac3a', 'Tac3b');
    const started = await call(a.t, 'POST', `/conversations/${conversationId}/tictactoe`, {});
    check('ilk oyun oluşturuldu', started.http === 201);
    const second = await call(a.t, 'POST', `/conversations/${conversationId}/tictactoe`, {});
    check('ikinci oyun reddedilir', second.http === 400);
  });

  it('geçersiz hücre reddedilir', async () => {
    const { a, conversationId } = await matched('Tac4a', 'Tac4b');
    const started = await call(a.t, 'POST', `/conversations/${conversationId}/tictactoe`, {});
    const bad = await move(a.t, conversationId, started.id, 9);
    check('geçersiz pozisyon reddedilir', bad.http === 400);
  });
});
