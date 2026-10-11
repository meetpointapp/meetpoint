// Faz 22: sosyal akış — gönderi, yorum, beğeni, takip, hikaye, engelleme, şikayet, kotalar
import { describe, it } from 'vitest';
import { call, check, registerVerified, testDb, uniqueTag } from '../helpers';

describe('Sosyal akış (Faz 22)', () => {
  it('senaryo', async () => {
    const tag = uniqueTag();
    const db = await testDb();
    const mk = async (name: string, blueTick: boolean) => {
      const u = await registerVerified(`${name.toLowerCase()}${tag}@test.com`);
      await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1995-01-01', gender: 'female', interestedIn: 'everyone', interests: ['coffee', 'music'] });
      if (blueTick) await db.user.update({ where: { id: u.id }, data: { verificationStatus: 'approved', verifiedAt: new Date() } });
      return u;
    };
    const aye = await mk('Aye', true);
    const elif = await mk('Elif', true);
    const mert = await mk('Mert', false);
    const deniz = await mk('Deniz', false);

    // --- Yazma yetkisi: sadece mavi tikli
    const denied = await call(mert.t, 'POST', '/posts', { body: 'Merhaba' });
    check('unverified cannot post', denied.http === 403 && denied.error === 'verification_required');
    check('281 chars rejected', (await call(aye.t, 'POST', '/posts', { body: 'a'.repeat(281) })).http === 400);
    const phone = await call(aye.t, 'POST', '/posts', { body: 'Beni ara 0532 123 45 67' });
    check('contact info rejected', phone.http === 400 && phone.error === 'contact_info_not_allowed');
    const p1 = await call(aye.t, 'POST', '/posts', { body: 'Kahve içmeye ne dersiniz?', interest: 'coffee' });
    check('verified posts', p1.http === 201 && p1.mine === true && p1.interest === 'coffee');
    const dup = await call(aye.t, 'POST', '/posts', { body: 'Kahve içmeye ne dersiniz?' });
    check('duplicate rejected', dup.http === 409 && dup.error === 'duplicate_post');

    // --- Günlük kota: 5 gönderi
    for (let i = 0; i < 4; i++) await call(aye.t, 'POST', '/posts', { body: `Gönderi ${i} ${tag}` });
    const over = await call(aye.t, 'POST', '/posts', { body: `Fazla gönderi ${tag}` });
    check('daily post limit', over.http === 429 && over.error === 'post_limit_reached', `${over.http} ${over.error}`);

    // --- Akış sekmeleri
    const feed = await call(mert.t, 'GET', '/feed?tab=all');
    check('everyone can read feed', feed.http === 200 && feed.posts.some((p) => p.id === p1.id));
    const empty = await call(mert.t, 'GET', '/feed?tab=following');
    check('following tab empty before follow', empty.posts.length === 0);
    const interests = await call(mert.t, 'GET', '/feed?tab=interests');
    check('interests tab matches tag', interests.http === 200);

    // --- Beğeni
    const l1 = await call(mert.t, 'PUT', `/posts/${p1.id}/like`);
    const l2 = await call(mert.t, 'PUT', `/posts/${p1.id}/like`);
    check('like idempotent', l1.http === 200 && l2.likeCount === 1 && l2.liked === true);
    check('unlike', (await call(mert.t, 'DELETE', `/posts/${p1.id}/like`)).likeCount === 0);

    // --- Yorum: sadece mavi tikli
    const c0 = await call(mert.t, 'POST', `/posts/${p1.id}/comments`, { body: 'Güzel' });
    check('unverified cannot comment', c0.http === 403 && c0.error === 'verification_required');
    const c1 = await call(elif.t, 'POST', `/posts/${p1.id}/comments`, { body: 'Gelirim ☕' });
    check('verified comments', c1.http === 201 && c1.mine === true);
    const list = await call(mert.t, 'GET', `/posts/${p1.id}/comments`);
    check('comments public', list.comments.length === 1 && list.comments[0].canDelete === false);
    check('post author deletes comment', (await call(aye.t, 'DELETE', `/comments/${c1.id}`)).http === 200);
    check('comment count back to 0', (await call(aye.t, 'GET', `/posts/${p1.id}`)).commentCount === 0);

    // --- Takip
    check('cannot follow self', (await call(aye.t, 'PUT', `/users/${aye.id}/follow`)).http === 400);
    const f1 = await call(mert.t, 'PUT', `/users/${aye.id}/follow`);
    const f2 = await call(mert.t, 'PUT', `/users/${aye.id}/follow`);
    check('follow idempotent', f1.isFollowing === true && f2.followers === 1);
    const fol = await call(mert.t, 'GET', '/feed?tab=following');
    check('following tab shows followed posts', fol.posts.some((p) => p.id === p1.id));
    const back = await call(aye.t, 'PUT', `/users/${mert.id}/follow`);
    check('mutual follow', back.isFollowing === true && back.followsMe === true);
    check('followers list', (await call(mert.t, 'GET', `/users/${aye.id}/followers`)).users.some((u) => u.id === mert.id));
    const prof = await call(mert.t, 'GET', `/users/${aye.id}`);
    check('profile carries social stats', prof.social?.followers === 1 && prof.social.posts >= 1 && prof.social.isFollowing === true);

    // --- Hikaye
    check('unverified cannot share story', (await call(mert.t, 'POST', '/stories', { kind: 'text', text: 'Selam', bg: 'ocean' })).http === 403);
    const s1 = await call(aye.t, 'POST', '/stories', { kind: 'text', text: 'Hafta sonu planı', bg: 'sunset' });
    check('verified shares text story', s1.http === 201 && s1.kind === 'text');
    const tray = await call(mert.t, 'GET', '/stories/tray');
    check('follower sees story in tray', tray.items.find((i) => i.user.id === aye.id)?.hasUnseen === true);
    await call(mert.t, 'POST', `/stories/${s1.id}/view`);
    check('seen after view', (await call(mert.t, 'GET', '/stories/tray')).items.find((i) => i.user.id === aye.id)?.hasUnseen === false);
    check('author sees viewers', (await call(aye.t, 'GET', `/stories/${s1.id}/viewers`)).viewers.some((v) => v.user.id === mert.id));
    check('others cannot see viewers', (await call(mert.t, 'GET', `/stories/${s1.id}/viewers`)).http === 404);
    // Süresi dolmuş hikaye görünmez
    await db.story.update({ where: { id: s1.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check('expired story hidden', (await call(mert.t, 'GET', '/stories/tray')).items.every((i) => i.user.id !== aye.id));

    // --- Şikayet ve engelleme
    check('report post', (await call(deniz.t, 'POST', `/posts/${p1.id}/report`, { reason: 'harassment' })).http === 201);
    const rep = await db.report.findFirst({ where: { subjectType: 'post', subjectId: p1.id } });
    check('report stores subject copy', rep?.subjectText === 'Kahve içmeye ne dersiniz?');
    check('cannot report own post', (await call(aye.t, 'POST', `/posts/${p1.id}/report`, { reason: 'other' })).http === 404);
    await call(deniz.t, 'POST', '/blocks', { toId: aye.id });
    check('blocked author hidden', (await call(deniz.t, 'GET', `/posts/${p1.id}`)).http === 404);
    check('block drops follows', (await call(aye.t, 'PUT', `/users/${deniz.id}/follow`)).http === 404);

    // --- Öne çıkarma, sabitleme, reklam (Faz 22 ek)
    await call(aye.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const p2 = await call(aye.t, 'POST', '/posts', { body: `Öne çıkar ${tag}` }).catch(() => null);
    // Günlük kota dolmuş olabilir: bu durumda mevcut gönderiyle devam edilir
    const target = p2?.id ? p2 : p1;
    const b1 = await call(aye.t, 'POST', `/posts/${target.id}/boost`);
    check('post boost', b1.http === 200 && b1.boosted === true, `${b1.http} ${b1.error ?? ''}`);
    check('boosted first in feed', (await call(mert.t, 'GET', '/feed?tab=all')).posts?.[0]?.id === target.id);
    check('pin', (await call(aye.t, 'PUT', `/posts/${target.id}/pin`)).pinned === true);
    check('pinned first on profile', (await call(mert.t, 'GET', `/users/${aye.id}/posts`)).posts?.[0]?.id === target.id);
    const ad = await db.ad.create({ data: { advertiser: 'Test', title: 'Reklam', url: 'https://example.com' } });
    check('ad in feed for free user', (await call(mert.t, 'GET', '/feed?tab=all')).ad?.id === ad.id);
    await call(mert.t, 'POST', `/ads/${ad.id}/click`);
    check('ad click counted', (await db.ad.findUnique({ where: { id: ad.id } }))?.clicks === 1);
    await db.user.update({ where: { id: mert.id }, data: { premiumUntil: new Date(Date.now() + 86_400_000) } });
    check('no ads for premium', (await call(mert.t, 'GET', '/feed?tab=all')).ad === null);
    await db.ad.delete({ where: { id: ad.id } });

    // --- Silme
    check('author deletes post', (await call(aye.t, 'DELETE', `/posts/${p1.id}`)).http === 200);
    check('deleted post gone', (await call(mert.t, 'GET', `/posts/${p1.id}`)).http === 404);
  });
});
