// Faz 11: KVKK — rızalar, yeniden onay, veri indirme, başvurular, saklama/imha, ihlal kaydı
import fs from 'node:fs';
import yauzl from 'yauzl';
import { describe, it } from 'vitest';
import {
  B,
  call,
  check,
  makeAdmin,
  makeUser,
  mailsFor,
  PRIVATE_DIR,
  registerVerified,
  TEST_PASSWORD,
  testDb,
  upload,
  uniqueTag,
  waitFor,
} from '../helpers';

// ZIP içeriğini oku (dosya adı → içerik)
function unzip(buf: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err);
      const files = new Map<string, Buffer>();
      zip.on('entry', (entry: yauzl.Entry) => {
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return reject(e);
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            files.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => resolve(files));
      zip.readEntry();
    });
  });
}

const profile = (name: string, gender: string, interestedIn: string) => ({ displayName: name, birthDate: '1994-05-05', gender, interestedIn });

describe('KVKK (Faz 11)', () => {
  it('eşleştirme rızası: olmadan profil ve keşfet yok; geri alınınca keşfetten kalkar', async () => {
    const tag = uniqueTag();
    const u = await registerVerified(`ozel${tag}@test.com`, TEST_PASSWORD, { consents: false });
    const blocked = await call(u.t, 'PUT', '/me/profile', profile('Ozel', 'female', 'male'));
    check('profile blocked without consent', blocked.http === 403 && blocked.kind === 'special_category');
    const me0 = await call(u.t, 'GET', '/me');
    check('/me reports consents', me0.consents?.special_category === false && me0.consents?.overseas_transfer === false);

    await call(u.t, 'PUT', '/me/consents', { kind: 'special_category', granted: true, source: 'onboarding' });
    await call(u.t, 'PUT', '/me/profile', profile('Ozel', 'female', 'male'));
    await upload(u.t, '/me/photos', 'photo');
    // İzole bir yer (Antarktika): diğer testlerin kullanıcıları karışmasın
    const SPOT = { latitude: -77.84, longitude: 166.67 };
    await call(u.t, 'PUT', '/me/location', SPOT);
    const viewer = await makeUser('Izleyici', 'male', 'female');
    await call(viewer.t, 'PUT', '/me/location', SPOT);
    await call(viewer.t, 'PUT', '/me/filters', { minAge: 18, maxAge: 99, maxKm: 5 });
    const deck1 = await call(viewer.t, 'GET', '/discover');
    check('visible with consent', deck1._arr?.some((p) => p.id === u.id));

    const revoke = await call(u.t, 'PUT', '/me/consents', { kind: 'special_category', granted: false });
    check('consent withdrawn', revoke.http === 200 && revoke.special_category === false);
    const deck2 = await call(viewer.t, 'GET', '/discover');
    check('hidden from discover after withdrawal', deck2._arr && !deck2._arr.some((p) => p.id === u.id));
    check('own discover blocked', (await call(u.t, 'GET', '/discover')).error === 'consent_required');
    check('swipes blocked', (await call(u.t, 'POST', '/swipes', { toId: viewer.id, direction: 'like' })).error === 'consent_required');

    const hist = await call(u.t, 'GET', '/me/consents');
    const kinds = hist.history?.map((h) => `${h.kind}:${h.granted}`) ?? [];
    check('consent history kept as evidence', kinds.includes('special_category:true') && kinds.includes('special_category:false') && kinds.includes('terms:true') && kinds.includes('privacy:true'));
  });

  it('yurt dışı aktarım rızası: yoksa arama yapılamaz ve alınamaz', async () => {
    const tag = uniqueTag();
    const caller = await makeUser('Arayan', 'male', 'female');
    await call(caller.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const callee = await registerVerified(`aranan${tag}@test.com`, TEST_PASSWORD, { consents: false });
    await call(callee.t, 'PUT', '/me/consents', { kind: 'special_category', granted: true });
    await call(callee.t, 'PUT', '/me/profile', profile('Aranan', 'female', 'male'));

    const toNoConsent = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    check('cannot call someone without consent', toNoConsent.http === 409 && toNoConsent.error === 'peer_calls_disabled');
    const fromNoConsent = await call(callee.t, 'POST', '/calls', { toId: caller.id, kind: 'VOICE' });
    check('cannot call without own consent', fromNoConsent.http === 403 && fromNoConsent.kind === 'overseas_transfer');

    await call(callee.t, 'PUT', '/me/consents', { kind: 'overseas_transfer', granted: true, source: 'call' });
    const ok = await call(caller.t, 'POST', '/calls', { toId: callee.id, kind: 'VOICE' });
    check('call works after consent', ok.http === 201, ok.error);
    if (ok.id) await call(caller.t, 'POST', `/calls/${ok.id}/hangup`);
  });

  it('yasal metin değişince yeniden onay: onaylanana kadar sadece hesap ve veri hakları açık', async () => {
    const u = await makeUser('Onay', 'female', 'male');
    const db = await testDb();
    await db.user.update({ where: { id: u.id }, data: { termsVersion: '2020-01-01' } });

    const gated = await call(u.t, 'GET', '/discover');
    check('app gated', gated.http === 403 && gated.error === 'reconsent_required');
    const me = await call(u.t, 'GET', '/me');
    check('/me still works and lists changed docs', me.http === 200 && JSON.stringify(me.legalUpdates) === '["terms"]');
    check('data rights stay open', (await call(u.t, 'GET', '/me/data-export')).http === 200);
    check('sessions stay open', (await call(u.t, 'GET', '/me/sessions')).http === 200);

    const accept = await call(u.t, 'POST', '/me/consents/accept-legal');
    check('accept new version', accept.http === 200);
    check('app open again', (await call(u.t, 'GET', '/discover')).http === 200);
    const hist = await call(u.t, 'GET', '/me/consents');
    check('reconsent recorded', hist.history?.some((h) => h.kind === 'terms' && h.source === 'reconsent'));
  });

  it('verilerimi indir: e-postayla tek kullanımlık bağlantı, ayda bir', async () => {
    const u = await makeUser('Indir', 'female', 'male');
    const peer = await makeUser('Karsi', 'male', 'female');
    await call(u.t, 'POST', '/swipes', { toId: peer.id, direction: 'like' });
    const match = await call(peer.t, 'POST', '/swipes', { toId: u.id, direction: 'like' });
    await call(u.t, 'POST', `/conversations/${match.conversationId}/messages`, { body: 'benim mesajım' });
    await call(peer.t, 'POST', `/conversations/${match.conversationId}/messages`, { body: 'karşı tarafın mesajı' });

    const before = mailsFor(u.email).length;
    const req = await call(u.t, 'POST', '/me/data-export');
    check('export requested', req.http === 202);
    const again = await call(u.t, 'POST', '/me/data-export');
    check('once a month', again.http === 429 && again.error === 'export_cooldown' && !!again.nextAt);

    const mails = await waitFor(() => mailsFor(u.email), (m) => m.length > before && m.at(-1)!.includes('/data-export/'), 15_000, 250);
    const link = mails.at(-1)?.match(/https?:\/\/\S+\/data-export\/([A-Za-z0-9_-]+)/);
    check('mail with link', !!link);
    const status = await call(u.t, 'GET', '/me/data-export');
    check('status READY', status.latest?.status === 'READY');

    const res = await fetch(`${B}/data-export/${link![1]}`);
    check('download ok', res.status === 200 && res.headers.get('content-type')?.includes('zip'));
    const files = await unzip(Buffer.from(await res.arrayBuffer()));
    const data = JSON.parse(files.get('veriler.json')?.toString('utf8') ?? '{}');
    check('readme + json + photo', files.has('BENİOKU.txt') && files.has('photos/1.webp'), [...files.keys()].join(','));
    check('account data', data.account?.email === u.email && data.profile?.displayName === 'Indir');
    check('own messages included', data.messagesSent?.some((m) => m.body === 'benim mesajım'));
    check("other person's messages excluded", !JSON.stringify(data).includes('karşı tarafın mesajı'));
    check('consents and likes included', data.consents?.length >= 3 && data.likesAndPasses?.some((s) => s.toId === peer.id));
    check('no password hash', !JSON.stringify(data).includes('argon2'));

    const second = await fetch(`${B}/data-export/${link![1]}`);
    check('link is single-use', second.status === 404);
    check('bad token 404', (await fetch(`${B}/data-export/yanlis-anahtar-yanlis-anahtar`)).status === 404);
  });

  it('KVKK başvurusu: 30 gün süreli, yönetimden yanıt e-postayla gider', async () => {
    const u = await registerVerified(`basvuru${uniqueTag()}@test.com`);
    const short = await call(u.t, 'POST', '/me/kvkk-requests', { kind: 'info', message: 'kısa' });
    check('message too short', short.http === 400);
    const r = await call(u.t, 'POST', '/me/kvkk-requests', { kind: 'info', message: 'Hangi verilerimi kimlerle paylaşıyorsunuz?' });
    const days = (new Date(r.dueAt).getTime() - Date.now()) / 86_400_000;
    check('request created with 30-day deadline', r.http === 201 && days > 29.9 && days < 30.1);

    const mod = await makeAdmin('moderator');
    check('only super admin handles requests', (await call(mod.t, 'GET', '/admin/api/privacy/dsr')).http === 403);
    const sup = await makeAdmin('super');
    const open = await call(sup.t, 'GET', '/admin/api/privacy/dsr');
    check('visible in queue', open._arr?.some((x) => x.id === r.id && x.overdue === false));
    const stats = await call(sup.t, 'GET', '/admin/api/stats');
    check('stats count open requests', stats.openDsr >= 1);

    const before = mailsFor(u.email).length;
    const ans = await call(sup.t, 'POST', `/admin/api/privacy/dsr/${r.id}/answer`, { status: 'ANSWERED', answer: 'Verilerin yalnızca aydınlatma metnindeki alıcılarla paylaşılır.' });
    check('answered', ans.http === 200);
    check('answer mailed', (await waitFor(() => mailsFor(u.email), (m) => m.length > before, 3000)).at(-1)?.includes('aydınlatma metnindeki'));
    const mine = await call(u.t, 'GET', '/me/kvkk-requests');
    check('user sees answer', mine._arr?.[0]?.status === 'ANSWERED' && mine._arr[0].answer.includes('alıcılarla'));
    const twice = await call(sup.t, 'POST', `/admin/api/privacy/dsr/${r.id}/answer`, { status: 'REJECTED', answer: 'ikinci kez yanıt verilemez' });
    check('cannot answer twice', twice.http === 409);
  });

  it('hesap silme: 30 gün bekleme, sonra kalıcı silme; satış kaydı ve imha kaydı kalır', async () => {
    const u = await makeUser('Silinen', 'female', 'male');
    await call(u.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const del = await call(u.t, 'DELETE', '/me', { password: TEST_PASSWORD });
    const days = (new Date(del.deleteAfter).getTime() - Date.now()) / 86_400_000;
    check('deletion scheduled in 30 days', del.http === 200 && days > 29.9 && days < 30.1);
    check('deletion mail', mailsFor(u.email).at(-1)?.includes('kalıcı olarak silinecek'));

    const db = await testDb();
    await db.user.update({ where: { id: u.id }, data: { deleteAfter: new Date(Date.now() - 1000) } });
    const sup = await makeAdmin('super');
    const run = await call(sup.t, 'POST', '/admin/api/privacy/retention/run');
    check('retention ran', run.http === 200 && run.deletionRequests >= 1, JSON.stringify(run));
    check('user gone', (await db.user.findUnique({ where: { id: u.id } })) === null);
    const sale = await db.purchase.findFirst({ where: { email: u.email } });
    check('sales record kept for accounting', !!sale && sale.userId === null);

    const log = await call(sup.t, 'GET', '/admin/api/privacy/destruction-log');
    const row = log._arr?.find((x) => x.kind === 'account_deleted' && x.details?.reason === 'user_request');
    check('destruction logged', !!row);
    const tryUpdate = await db.destructionLog.update({ where: { id: row.id }, data: { count: 0 } }).then(() => 'ok', (e) => String(e));
    check('destruction log is append-only', tryUpdate !== 'ok');
  });

  it('2 yıl hareketsiz hesap: önce uyarı, girişte sayaç sıfırlanır, sonra silinir', async () => {
    const u = await registerVerified(`uyuyan${uniqueTag()}@test.com`);
    const db = await testDb();
    const sup = await makeAdmin('super');
    await db.user.update({ where: { id: u.id }, data: { lastActiveAt: new Date(Date.now() - 720 * 86_400_000) } });
    await call(sup.t, 'POST', '/admin/api/privacy/retention/run');
    const warned = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    check('warning sent', warned.inactivityWarnedAt !== null && mailsFor(u.email).at(-1)?.includes('uzun süredir'));

    // Giriş yapınca uyarı ve sayaç sıfırlanır
    await call(null, 'POST', '/auth/login', { email: u.email, password: TEST_PASSWORD });
    const active = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    check('login resets inactivity', active.inactivityWarnedAt === null && Date.now() - active.lastActiveAt.getTime() < 60_000);

    // Uyarıdan sonra 30 gün giriş yok: silinir
    await db.user.update({
      where: { id: u.id },
      data: { lastActiveAt: new Date(Date.now() - 800 * 86_400_000), inactivityWarnedAt: new Date(Date.now() - 31 * 86_400_000) },
    });
    const run = await call(sup.t, 'POST', '/admin/api/privacy/retention/run');
    check('inactive account deleted', run.inactiveAccounts >= 1 && (await db.user.findUnique({ where: { id: u.id } })) === null, JSON.stringify(run));
  });

  it('selfie rızası geri alınınca selfie silinir, bekleyen başvuru düşer', async () => {
    const u = await makeUser('Selfie', 'female', 'male');
    await call(u.t, 'PUT', '/me/consents', { kind: 'selfie', granted: true, source: 'verification' });
    await call(u.t, 'POST', '/me/verification/start');
    const sent = await upload(u.t, '/me/verification', 'selfie');
    check('selfie uploaded', sent.http === 201);
    const db = await testDb();
    const v = await db.verificationRequest.findFirstOrThrow({ where: { userId: u.id } });
    const file = `${PRIVATE_DIR}/${v.selfiePath}`;
    check('file exists', fs.existsSync(file));

    await call(u.t, 'PUT', '/me/consents', { kind: 'selfie', granted: false });
    check('selfie file deleted', !fs.existsSync(file));
    const after = await db.verificationRequest.findFirstOrThrow({ where: { id: v.id } });
    check('pending request withdrawn', after.status === 'REJECTED' && after.selfiePath === '');
    check('status reset', (await call(u.t, 'GET', '/me')).verificationStatus === 'none');
  });

  it('veri ihlali kayıt defteri: kayıt, Kurul bildirimi işareti, etkilenenlere e-posta', async () => {
    const sup = await makeAdmin('super');
    const victim = await registerVerified(`ihlal${uniqueTag()}@test.com`);
    const b = await call(sup.t, 'POST', '/admin/api/privacy/breaches', {
      title: 'Test ihlali',
      description: 'Yedek dosyasına yetkisiz erişim şüphesi (test).',
      dataCategories: ['e-posta'],
      detectedAt: new Date().toISOString(),
      affectedCount: 1,
    });
    check('breach recorded', b.http === 201 && b.createdBy === sup.email);
    const upd = await call(sup.t, 'PATCH', `/admin/api/privacy/breaches/${b.id}`, { authorityNotified: true, measures: 'Anahtarlar yenilendi.' });
    check('authority notification marked', upd.http === 200 && !!upd.authorityNotifiedAt);

    const body = { scope: 'ids', ids: [victim.id], subject: 'MeetPoint: güvenlik bildirimi', message: 'Hesabınla ilgili bir güvenlik olayı yaşandı; şifreni değiştirmeni öneriyoruz.' };
    const dry = await call(sup.t, 'POST', `/admin/api/privacy/breaches/${b.id}/notify`, body);
    check('dry run counts only', dry.recipients === 1 && dry.sent === undefined);
    const sent = await call(sup.t, 'POST', `/admin/api/privacy/breaches/${b.id}/notify`, { ...body, dryRun: false });
    check('users notified', sent.sent === 1 && mailsFor(victim.email).at(-1)?.includes('güvenlik olayı'));
    const list = await call(sup.t, 'GET', '/admin/api/privacy/breaches');
    check('notified count stored', list._arr?.find((x) => x.id === b.id)?.usersNotifiedCount === 1);
    const fin = await makeAdmin('finance');
    check('finance cannot see breaches', (await call(fin.t, 'GET', '/admin/api/privacy/breaches')).http === 403);
  });

  it('yasal metinler: açık rıza metinleri ve koddan üretilen saklama politikası', async () => {
    for (const doc of ['consent-special', 'consent-overseas', 'consent-selfie', 'consent-marketing', 'retention']) {
      for (const lang of ['tr', 'en']) {
        const r = await fetch(`${B}/legal/${doc}?lang=${lang}`);
        check(`${doc}.${lang}`, r.status === 200);
      }
    }
    const retention = await (await fetch(`${B}/legal/retention`)).text();
    check('retention page shows grace period and categories', retention.includes('30 gün') && retention.includes('Cinsel yönelim'));
    check('unknown doc 404', (await fetch(`${B}/legal/yok`)).status === 404);
  });
});
