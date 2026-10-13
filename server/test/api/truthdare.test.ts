// Faz 23: Doğruluk mu Cesaret mi — başlat, seç, cevapla, aç, 10 tur, reddet, engelle
import { describe, it } from 'vitest';
import { call, check, registerVerified, uniqueTag } from '../helpers';

describe('Doğruluk mu Cesaret mi (Faz 23)', () => {
  it('senaryo', async () => {
    const tag = uniqueTag();
    const mk = async (name: string) => {
      const u = await registerVerified(`${name.toLowerCase()}${tag}@test.com`);
      await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1995-01-01', gender: 'female', interestedIn: 'everyone' });
      return u;
    };
    const a = await mk('Aye');
    const b = await mk('Can');
    const c = await mk('Deniz');

    const g = await call(a.t, 'POST', '/games/truth-dare', { toId: b.id });
    check('game starts', g.http === 201 && g.round === 1 && g.totalRounds === 10 && g.myTurn === true);
    check('no duplicate open game', (await call(a.t, 'POST', '/games/truth-dare', { toId: b.id })).id === g.id);
    check('cannot start with self', (await call(a.t, 'POST', '/games/truth-dare', { toId: a.id })).http === 400);
    check('answer before choosing rejected', (await call(a.t, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: 'Selam' })).error === 'choose_first');

    const used = new Set<string>();
    let game = g;
    for (let round = 1; round <= 10; round++) {
      const ca = await call(a.t, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: round % 2 ? 'truth' : 'dare' });
      const cb = await call(b.t, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: round % 2 ? 'dare' : 'truth' });
      used.add(ca.current.mine.prompt.id);
      used.add(cb.current.mine.prompt.id);
      if (round === 1) {
        check('prompt text provided', ca.current.mine.prompt.text.length > 5);
        check('other side prompt hidden until reveal', ca.current.theirs.prompt === null);
        check('double choose rejected', (await call(a.t, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: 'dare' })).error === 'already_chosen');
        check('contact info rejected', (await call(a.t, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: 'ara 0532 123 45 67' })).error === 'contact_info_not_allowed');
      }
      const first = await call(a.t, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: `A${round}` });
      if (round === 1) check('waits for other side', first.round === 1 && first.history.length === 0 && first.current.theirs.answered === false);
      game = await call(b.t, 'POST', `/games/truth-dare/${g.id}/answer`, { answer: `B${round}` });
      if (round === 1) check('reveals and advances', game.round === 2 && game.history.length === 1 && game.history[0].theirs.answer === 'A1');
    }
    check('finished after 10 rounds', game.state === 'FINISHED' && game.history.length === 10);
    check('20 unique prompts', used.size === 20);
    check('finished game rejects actions', (await call(a.t, 'POST', `/games/truth-dare/${g.id}/choose`, { choice: 'truth' })).error === 'game_not_active');

    // Reddet ve engelle
    const g2 = await call(a.t, 'POST', '/games/truth-dare', { toId: b.id });
    check('invitee can decline', (await call(b.t, 'POST', `/games/truth-dare/${g2.id}/end`)).state === 'DECLINED');
    const g3 = await call(a.t, 'POST', '/games/truth-dare', { toId: c.id });
    await call(c.t, 'POST', '/blocks', { toId: a.id });
    check('block ends open game', (await call(a.t, 'GET', `/games/truth-dare/${g3.id}`)).state === 'ENDED');
    check('blocked cannot start', (await call(a.t, 'POST', '/games/truth-dare', { toId: c.id })).http === 404);
    check('stranger cannot read game', (await call(c.t, 'GET', `/games/truth-dare/${g.id}`)).http === 404);
  });
});
