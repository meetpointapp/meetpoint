// Faz 24: keşfette "geri al" — son kaydırma, günlük hak, iade, eşleşmeye dönüşen kaydırma.
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

describe('Geri al (Faz 24)', () => {
  it('sadece son kaydırma geri alınır, hak azalır, beğeni hakkı iade edilir', async () => {
    const me = await makeUser('Und0a', 'male', 'female');
    const a = await makeUser('Und1a', 'female', 'male');
    const b = await makeUser('Und2a', 'female', 'male');

    const s0 = await call(me.t, 'GET', '/discover/undo-status');
    check('günlük 3 hak', s0.limit === 3 && s0.remaining === 3);

    await call(me.t, 'POST', '/swipes', { toId: a.id, direction: 'pass' });
    await call(me.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const wrong = await call(me.t, 'POST', '/swipes/undo', { toId: a.id });
    check('son olmayan kaydırma geri alınmaz', wrong.http === 409 && wrong.error === 'undo_unavailable');

    const used = (await call(me.t, 'GET', '/discover/like-status')).used;
    const ok = await call(me.t, 'POST', '/swipes/undo', { toId: b.id });
    check('son kaydırma geri alınır', ok.http === 200 && ok.undone?.toId === b.id && ok.undo.remaining === 2);
    const after = (await call(me.t, 'GET', '/discover/like-status')).used;
    check('beğeni hakkı iade olur', after === used - 1);

    const again = await call(me.t, 'POST', '/swipes/undo', { toId: b.id });
    check('aynı kaydırma iki kez geri alınmaz', again.http === 409);
  });

  it('karşılıklı beğeniyle eşleşen kaydırma geri alınamaz', async () => {
    const me = await makeUser('Und0b', 'male', 'female');
    const t = await makeUser('Und1b', 'female', 'male');
    await call(t.t, 'POST', '/swipes', { toId: me.id, direction: 'like' });
    const m = await call(me.t, 'POST', '/swipes', { toId: t.id, direction: 'like' });
    check('eşleşme oluştu', m.http === 200 && m.match === true);
    const r = await call(me.t, 'POST', '/swipes/undo', { toId: t.id });
    check('eşleşme geri alınamaz', r.http === 409 && r.error === 'undo_matched');
  });
});
