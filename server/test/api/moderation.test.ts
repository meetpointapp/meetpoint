// Faz 12: moderasyon, kademeli yaptırım, itiraz, otomatik işaretler, resmi talepler, 5651 trafik kaydı
import sharp from 'sharp';
import { describe, it } from 'vitest';
import {
  B,
  call,
  check,
  makeAdmin,
  makeUser,
  TEST_PASSWORD,
  testDb,
  waitFor,
  type TestUser,
} from '../helpers';

async function match(a: TestUser, b: TestUser) {
  await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
  const m = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });
  return m.conversationId as string;
}

async function uploadImage(token: string, image: Buffer) {
  const fd = new FormData();
  fd.append('photo', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'p.png');
  const res = await fetch(`${B}/me/photos`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
  return { ...(await res.json()), http: res.status };
}

const queue = async (token: string) => (await call(token, 'GET', '/admin/api/moderation/queue')) as { items: any[]; stats: any };

describe('Moderasyon (Faz 12)', () => {
  it('sohbette iletişim bilgisi: mesaj gider, uyarı + işaret; tekrarında kuyruk', async () => {
    const a = await makeUser('Numara', 'male', 'female');
    const b = await makeUser('Alici', 'female', 'male');
    const conv = await match(a, b);
    const m = await call(a.t, 'POST', `/conversations/${conv}/messages`, { body: 'whatsapptan yaz 0532 123 45 67' });
    check('message delivered with warning', m.http === 201 && m.warning === 'contact_info' && m.flag === 'contact');
    const seen = await call(b.t, 'GET', `/conversations/${conv}/messages`);
    check('recipient sees safety flag', seen._arr?.some((x) => x.id === m.id && x.flag === 'contact'));
    const plain = await call(a.t, 'POST', `/conversations/${conv}/messages`, { body: 'nasılsın?' });
    check('normal message not flagged', plain.flag === '' && !plain.warning);

    for (const body of ['insta @numara.k', 'IBAN TR33 0006 1005 1978 6457 8413 26']) await call(a.t, 'POST', `/conversations/${conv}/messages`, { body });
    const mod = await makeAdmin('moderator');
    const q = await waitFor(() => queue(mod.t), (v) => v.items?.some((i) => i.kind === 'contact_repeat' && i.user.id === a.id), 3000);
    const item = q.items.find((i) => i.kind === 'contact_repeat' && i.user.id === a.id);
    check('repeat sharing queued with evidence message', !!item && !!item.message?.body);
  });

  it('toplu mesaj: aynı metin 5 farklı sohbete → spam işareti', async () => {
    const s = await makeUser('Toplu', 'male', 'female');
    for (let i = 0; i < 5; i++) {
      const r = await makeUser(`Hedef${i}`, 'female', 'male');
      const conv = await match(s, r);
      await call(s.t, 'POST', `/conversations/${conv}/messages`, { body: 'Selam, profilime bakar mısın? Çok güzel bir teklifim var' });
    }
    const mod = await makeAdmin('moderator');
    const q = await waitFor(() => queue(mod.t), (v) => v.items?.some((i) => i.kind === 'spam' && i.user.id === s.id), 3000);
    check('spam flagged', q.items.some((i) => i.kind === 'spam' && i.user.id === s.id));
  });

  it('şüpheli fotoğraf: gizlenir, sahibi "incelemede" görür; onaylanınca yayında', async () => {
    const u = await makeUser('Foto', 'female', 'male');
    const viewer = await makeUser('Bakan', 'male', 'female');
    const skin = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 224, g: 172, b: 140 } } }).png().toBuffer();
    const up = await uploadImage(u.t, skin);
    check('upload ok, under review', up.http === 201 && up.underReview === true);
    const others = await call(viewer.t, 'GET', `/users/${u.id}`);
    check('hidden from others', others.photos?.length === 1 && !others.photos.some((p) => p.id === up.id));
    const mine = await call(u.t, 'GET', '/me');
    check('owner sees it marked', mine.profile?.photos?.some((p) => p.id === up.id && p.underReview === true));

    const mod = await makeAdmin('moderator');
    const q = await queue(mod.t);
    const flag = q.items.find((i) => i.kind === 'photo_suspicious' && i.photo?.id === up.id);
    check('queued as urgent with photo', flag?.priority === 1 && flag.photo.hidden === true);
    const ok = await call(mod.t, 'POST', `/admin/api/moderation/flags/${flag.id}/resolve`, { action: 'approve_photo' });
    check('approved', ok.http === 200 && ok.resolution === 'photo_approved');
    check('visible after approval', (await call(viewer.t, 'GET', `/users/${u.id}`)).photos?.some((p) => p.id === up.id));
    const twice = await call(mod.t, 'POST', `/admin/api/moderation/flags/${flag.id}/resolve`, { action: 'dismiss' });
    check('cannot resolve twice', twice.http === 409);
  });

  it('kademeli yaptırım: uyarı → 24 saat → 7 gün → yasak; kısıtlıyken içerik yok; itiraz kabulü kısıtı kaldırır', async () => {
    const u = await makeUser('Kural', 'male', 'female');
    const peer = await makeUser('Esi', 'female', 'male');
    const conv = await match(u, peer);
    const mod = await makeAdmin('moderator');
    const sanction = () => call(mod.t, 'POST', `/admin/api/moderation/users/${u.id}/sanction`, { reason: 'harassment', note: 'Kaba mesajlar' });

    const s1 = await sanction();
    check('first = warning', s1.level === 'warning');
    const me1 = await call(u.t, 'GET', '/me');
    check('warning shown once in app', me1.pendingSanction?.id === s1.id && me1.restrictedUntil === null);
    await call(u.t, 'POST', `/me/sanctions/${s1.id}/seen`);
    check('seen', (await call(u.t, 'GET', '/me')).pendingSanction === null);
    check('warning does not restrict', (await call(u.t, 'POST', `/conversations/${conv}/messages`, { body: 'özür dilerim' })).http === 201);

    const s2 = await sanction();
    check('second = 24h restriction', s2.level === 'restrict_24h');
    const blocked = await call(u.t, 'POST', `/conversations/${conv}/messages`, { body: 'deneme' });
    check('restricted: cannot message', blocked.http === 403 && blocked.error === 'restricted' && !!blocked.until);
    check('restricted: cannot swipe', (await call(u.t, 'POST', '/swipes', { toId: peer.id, direction: 'like' })).error === 'restricted');
    check('restricted: can still read', (await call(u.t, 'GET', `/conversations/${conv}/messages`)).http === 200);

    const appeal = await call(u.t, 'POST', '/me/appeals', { sanctionId: s2.id, message: 'Yanlış anlaşıldım, tekrar olmayacak.' });
    check('appeal filed', appeal.http === 201);
    check('only one appeal', (await call(u.t, 'POST', '/me/appeals', { sanctionId: s2.id, message: 'Bir itiraz daha yapıyorum.' })).http === 409);
    const q = await queue(mod.t);
    const item = q.items.find((i) => i.type === 'appeal' && i.id === appeal.id);
    check('appeal in queue', item?.sanction?.level === 'restrict_24h');
    const decide = await call(mod.t, 'POST', `/admin/api/moderation/appeals/${appeal.id}/decide`, { accept: true, answer: 'İtirazın haklı bulundu.' });
    check('appeal accepted', decide.http === 200);
    check('restriction lifted', (await call(u.t, 'POST', `/conversations/${conv}/messages`, { body: 'teşekkürler' })).http === 201);
    const hist = await call(mod.t, 'GET', `/admin/api/moderation/users/${u.id}/history`);
    check('revoked sanction does not count toward ladder', hist.nextLevel === 'restrict_24h', hist.nextLevel);

    await sanction();
    const s4 = await sanction();
    check('then 7 days', s4.level === 'restrict_7d');
    const s5 = await sanction();
    check('then ban', s5.level === 'ban');
    check('banned session closed', (await call(u.t, 'GET', '/me')).error === 'banned');
  });

  it('yasaklı kullanıcı girişte itiraz anahtarı alır; itirazı kabul edilirse hesabı açılır', async () => {
    const u = await makeUser('Yasakli', 'male', 'female');
    const mod = await makeAdmin('moderator');
    await call(mod.t, 'POST', `/admin/api/moderation/users/${u.id}/sanction`, { level: 'ban', reason: 'scam', note: 'Dolandırıcılık' });
    const login = await call(null, 'POST', '/auth/login', { email: u.email, password: TEST_PASSWORD });
    check('banned login returns appeal token', login.http === 403 && login.error === 'banned' && login.reason === 'scam' && !!login.appealToken);
    const wrongPw = await call(null, 'POST', '/auth/login', { email: u.email, password: 'yanlis-sifre' });
    check('no appeal token without password', !wrongPw.appealToken);
    const ap = await call(null, 'POST', '/appeals', { appealToken: login.appealToken, message: 'Hesabım ele geçirilmişti, ben yapmadım.' });
    check('appeal via token', ap.http === 201);
    const again = await call(null, 'POST', '/auth/login', { email: u.email, password: TEST_PASSWORD });
    check('after appeal: no new token, marked appealed', again.appealed === true && !again.appealToken);
    await call(mod.t, 'POST', `/admin/api/moderation/appeals/${ap.id}/decide`, { accept: true, answer: 'Hesabın geri açıldı; şifreni değiştir.' });
    check('can log in after accepted appeal', (await call(null, 'POST', '/auth/login', { email: u.email, password: TEST_PASSWORD })).http === 200);
  });

  it('tekrarlayan şikayet: 7 günde 3 farklı kişi → otomatik 24 saat kısıt ve acil işaret', async () => {
    const target = await makeUser('Sikayetli', 'female', 'male');
    for (let i = 0; i < 3; i++) {
      const r = await makeUser(`Sikayetci${i}`, 'male', 'female');
      await call(r.t, 'POST', '/reports', { toId: target.id, reason: 'harassment', details: `test ${i}` });
    }
    const me = await call(target.t, 'GET', '/me');
    check('auto restricted', !!me.restrictedUntil && me.pendingSanction?.level === 'restrict_24h');
    const mod = await makeAdmin('moderator');
    const q = await queue(mod.t);
    check('urgent burst flag', q.items.some((i) => i.kind === 'report_burst' && i.user.id === target.id && i.priority === 1));
    check('reports prioritised', q.items.filter((i) => i.type === 'report' && i.user.id === target.id).every((i) => i.priority === 2));
    check('queue stats', typeof q.stats.avgResolutionHours7d === 'number' && q.stats.urgent >= 1);
  });

  it('arama içinden "bildir ve kapat"', async () => {
    const caller = await makeUser('Arayan2', 'male', 'female');
    const callee = await makeUser('Aranan2', 'female', 'male');
    await call(caller.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const c = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VIDEO' });
    const r = await call(callee.t, 'POST', `/calls/${c.id}/report`, { reason: 'inappropriate_content' });
    check('call ended', r.http === 200 && r.status !== 'RINGING' && r.status !== 'ACTIVE', r.status);
    const db = await testDb();
    const rep = await db.report.findFirst({ where: { fromId: callee.id, toId: caller.id } });
    check('urgent report from call', rep?.priority === 1 && rep.details.includes(c.id));
  });

  it('resmi talepler ve 5651 trafik kaydı (sadece süper yönetici)', async () => {
    const u = await makeUser('Trafik', 'female', 'male');
    await call(u.t, 'PUT', '/me/filters', { minAge: 20, maxAge: 40, maxKm: 50 });
    const mod = await makeAdmin('moderator');
    const sup = await makeAdmin('super');
    check('moderator cannot export traffic', (await call(mod.t, 'GET', '/admin/api/moderation/legal-requests')).http === 403);

    const lr = await call(sup.t, 'POST', '/admin/api/moderation/legal-requests', {
      kind: 'information',
      authority: 'İstanbul Cumhuriyet Başsavcılığı',
      referenceNo: '2026/123',
      description: 'Kullanıcının IP kayıtları istendi.',
      subjectUsers: [u.id],
    });
    const hours = (new Date(lr.dueAt).getTime() - new Date(lr.receivedAt).getTime()) / 3_600_000;
    check('information request due in 72h', lr.http === 201 && hours === 72);

    const from = new Date(Date.now() - 3_600_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const csv = await waitFor(
      () => fetch(`${B}/admin/api/moderation/traffic?userId=${u.id}&from=${from}&to=${to}&legalRequestId=${lr.id}`, { headers: { authorization: `Bearer ${sup.t}` } }).then((r) => r.text()),
      (t) => t.includes('/me/filters'),
      5000,
      250,
    );
    const lines = csv.split('\n');
    check('csv header + user rows', lines[0].startsWith('zaman_utc,kullanici,ip,port') && lines.some((l) => l.includes(u.id) && l.includes('PUT') && l.includes('/me/filters')));
    check('login/register attributed to user', lines.some((l) => l.includes(u.id) && l.includes('/auth/register')));
    check('needs user or ip', (await call(sup.t, 'GET', `/admin/api/moderation/traffic?from=${from}&to=${to}`)).http === 400);

    const verify = await call(sup.t, 'GET', '/admin/api/moderation/traffic/verify');
    check('hash chain intact', verify.ok === true && verify.rows > 0, JSON.stringify(verify));
    const db = await testDb();
    const tamper = await db.trafficLog.updateMany({ where: { userId: u.id }, data: { ip: '9.9.9.9' } }).then(() => 'ok', (e) => String(e));
    check('traffic log cannot be altered', tamper !== 'ok');

    const close = await call(sup.t, 'POST', `/admin/api/moderation/legal-requests/${lr.id}/close`, { status: 'DONE', actions: 'Trafik kaydı CSV olarak gönderildi.' });
    check('request closed', close.http === 200);
    const audit = await call(sup.t, 'GET', '/admin/api/audit?action=traffic.export');
    check('export audited with request id', audit._arr?.some((a) => a.details?.legalRequestId === lr.id));
  });
});
