// Faz 16: "İlgi alanı bazlı keşif". Salt kaydırma yerine ortak ilgiye göre vitrinler/gruplar
// (/discover/groups, /discover/groups/:interestId) — /discover ile aynı uygunluk kurallarını
// paylaşır (kaydırılmamış, engelsiz, yaş/mesafe/cinsiyet filtresine uyan).
import { describe, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

describe('İlgi alanı bazlı keşif (Faz 16)', () => {
  it('ortak ilgiye göre gruplar listelenir ve üyeleri doğru filtrelenir', async () => {
    const a = await makeUser('Group1a', 'male', 'female');
    await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Group1a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female',
      interests: ['coffee', 'travel'],
    });
    const b = await makeUser('Group1b', 'female', 'male');
    await call(b.t, 'PUT', '/me/profile', {
      displayName: 'Group1b', birthDate: '1997-03-10', gender: 'female', interestedIn: 'male',
      interests: ['coffee'],
    });
    const c = await makeUser('Group1c', 'female', 'male');
    await call(c.t, 'PUT', '/me/profile', {
      displayName: 'Group1c', birthDate: '1998-03-10', gender: 'female', interestedIn: 'male',
      interests: ['travel'],
    });
    const d = await makeUser('Group1d', 'female', 'male');
    await call(d.t, 'PUT', '/me/profile', {
      displayName: 'Group1d', birthDate: '1999-03-10', gender: 'female', interestedIn: 'male',
      interests: ['gaming'],
    });

    const groups = (await call(a.t, 'GET', '/discover/groups'))._arr;
    check('grup listesi dizi döner', Array.isArray(groups));
    const coffeeGroup = groups.find((g: { interestId: string }) => g.interestId === 'coffee');
    const travelGroup = groups.find((g: { interestId: string }) => g.interestId === 'travel');
    check('kahve grubu var ve b içeriyor', coffeeGroup && coffeeGroup.previewUserIds.includes(b.id));
    check('gezi grubu var ve c içeriyor', travelGroup && travelGroup.previewUserIds.includes(c.id));

    const coffeeMembers = (await call(a.t, 'GET', '/discover/groups/coffee'))._arr;
    const coffeeIds = coffeeMembers.map((m: { id: string }) => m.id);
    check('kahve grubu üyelerinde b var', coffeeIds.includes(b.id));
    check('kahve grubu üyelerinde c yok (farklı ilgi)', !coffeeIds.includes(c.id));
    check('kahve grubu üyelerinde d yok (farklı ilgi)', !coffeeIds.includes(d.id));

    const invalid = await call(a.t, 'GET', '/discover/groups/not_a_real_interest');
    check('geçersiz ilgi alanı 404 döner', invalid.http === 404);
  });

  it('kaydırılmış (geç/beğen) kullanıcı grup üyeliğinden düşer', async () => {
    const a = await makeUser('Group2a', 'male', 'female');
    await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Group2a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female', interests: ['music'],
    });
    const b = await makeUser('Group2b', 'female', 'male');
    await call(b.t, 'PUT', '/me/profile', {
      displayName: 'Group2b', birthDate: '1997-03-10', gender: 'female', interestedIn: 'male', interests: ['music'],
    });

    const before = (await call(a.t, 'GET', '/discover/groups/music'))._arr;
    check('kaydırmadan önce b listede', before.map((m: { id: string }) => m.id).includes(b.id));

    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'pass' });
    const after = (await call(a.t, 'GET', '/discover/groups/music'))._arr;
    check('geçildikten sonra b listede değil', !after.map((m: { id: string }) => m.id).includes(b.id));
  });
});
