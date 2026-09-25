// Faz 14: satın alma öncesi onay, destek talepleri, yardım merkezi, künye, bildirim tercihleri,
// kampanya izinleri ve İYS, web'den hesap silme
import { describe, it } from 'vitest';
import {
  B,
  call,
  check,
  login,
  makeAdmin,
  mailsFor,
  png,
  registerVerified,
  TEST_PASSWORD,
  testDb,
  uniqueTag,
  waitFor,
} from '../helpers';

async function openTicket(t: string, fields: Record<string, string>, withShot = false) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (withShot) fd.append('screenshot', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'ekran.png');
  const res = await fetch(`${B}/support/tickets`, { method: 'POST', headers: { authorization: `Bearer ${t}` }, body: fd });
  return { ...(await res.json().catch(() => ({}))), http: res.status };
}

describe('Faz 14: tüketici ve destek', () => {
  it('satın alma öncesi onay: ilk alımdan önce bir kez, kanıtı ve satın almadaki sürümü saklanır', async () => {
    const u = await registerVerified(`alici${uniqueTag()}@test.com`, TEST_PASSWORD, { consents: false });
    const w = await call(u.t, 'GET', '/wallet');
    check('terms required before first purchase', w.salesTerms?.required === true && w.salesTerms.updated === false);
    const blocked = await call(u.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    check('purchase blocked without terms', blocked.http === 409 && blocked.error === 'sales_terms_required');
    check('accept must be explicit', (await call(u.t, 'POST', '/wallet/sales-terms', { accept: false })).http === 400);
    check('accept ok', (await call(u.t, 'POST', '/wallet/sales-terms', { accept: true })).http === 200);
    check('no longer required', (await call(u.t, 'GET', '/wallet')).salesTerms.required === false);
    check('purchase ok', (await call(u.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' })).http === 200);

    const db = await testDb();
    const purchase = await db.purchase.findFirst({ where: { userId: u.id } });
    const consent = await db.consent.findFirst({ where: { userId: u.id, kind: 'sales_terms' } });
    check('purchase stores accepted version', !!purchase?.salesTermsVersion && purchase.salesTermsVersion === consent?.version);

    // Metin değişince (eski sürüm kabul edilmiş gibi) tekrar sorulur
    await db.user.update({ where: { id: u.id }, data: { salesTermsVersion: '2020-01-01' } });
    const again = await call(u.t, 'GET', '/wallet');
    check('re-asked after text change', again.salesTerms.required === true && again.salesTerms.updated === true);

    // Metinler: ön bilgilendirme paket fiyatlarını ve künye yer tutucularını içerir
    const pre = await (await fetch(`${B}/legal/preinfo?lang=tr`)).text();
    check('preinfo has pack table', pre.includes('<table>') && pre.includes('1.000'));
    check('preinfo mentions withdrawal exception', pre.includes('15/1-ğ'));
    check('distance sales page', (await fetch(`${B}/legal/distance-sales?lang=en`)).status === 200);
  });

  it('künye: panelden doldurulur (sadece süper yönetici), yasal metinlere yansır', async () => {
    const mod = await makeAdmin('moderator');
    const sup = await makeAdmin('super');
    const before = await call(mod.t, 'GET', '/admin/api/support/company');
    check('everyone sees missing fields', Array.isArray(before.missing));
    check('moderator cannot edit', (await call(mod.t, 'PUT', '/admin/api/support/company', { legalName: 'X' })).http === 403);
    const name = `MeetPoint Teknoloji A.Ş. ${uniqueTag()}`;
    const r = await call(sup.t, 'PUT', '/admin/api/support/company', { legalName: name, mersisNo: '0123456789000015' });
    check('super edits', r.http === 200 && r.legalName === name && !r.missing.includes('legalName'));
    await waitFor(async () => (await fetch(`${B}/legal/imprint?lang=tr`)).text(), (h) => h.includes(name), 8000, 250);
    const imprint = await (await fetch(`${B}/legal/imprint?lang=tr`)).text();
    check('imprint shows company', imprint.includes(name) && imprint.includes('0123456789000015'));
    const terms = await (await fetch(`${B}/legal/terms?lang=tr`)).text();
    check('terms filled', terms.includes(name) && !terms.includes('{{legalName}}'));
    const audit = await call(sup.t, 'GET', '/admin/api/audit?action=company.update');
    check('change audited', JSON.stringify(audit).includes('company.update'));
  });

  it('destek talebi: ekran görüntüsü + ilgili işlem, panelden yanıt, bildirim/e-posta, okundu', async () => {
    const u = await registerVerified(`destek${uniqueTag()}@test.com`);
    const other = await registerVerified(`baska${uniqueTag()}@test.com`);
    await call(u.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    await call(other.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const db = await testDb();
    const mine = await db.purchase.findFirstOrThrow({ where: { userId: u.id } });
    const theirs = await db.purchase.findFirstOrThrow({ where: { userId: other.id } });

    const foreign = await openTicket(u.t, { category: 'coins', subject: 'Başkasının satın alması', body: 'Bu benim değil ama deneyelim', relatedType: 'purchase', relatedId: theirs.id });
    check("someone else's record rejected", foreign.http === 400 && foreign.error === 'invalid_related');
    check('short body rejected', (await openTicket(u.t, { category: 'coins', subject: 'Kısa', body: 'kısa' })).http === 400);

    const t = await openTicket(
      u.t,
      { category: 'coins', subject: 'Jetonlarım gelmedi', body: 'Dün 500 jeton aldım, bakiyeme eksik yüklendi.', relatedType: 'purchase', relatedId: mine.id, platform: 'android', appVersion: '1.0.0+1' },
      true,
    );
    check('ticket created', t.http === 201 && t.status === 'OPEN' && t.messages.length === 1 && t.messages[0].hasAttachment);

    const own = await fetch(`${B}/support/attachments/${t.messages[0].id}`, { headers: { authorization: `Bearer ${u.t}` } });
    check('owner sees screenshot', own.status === 200 && own.headers.get('content-type')?.includes('image/webp'));
    const leak = await fetch(`${B}/support/attachments/${t.messages[0].id}`, { headers: { authorization: `Bearer ${other.t}` } });
    check('others cannot', leak.status === 404);
    check('others cannot read ticket', (await call(other.t, 'GET', `/support/tickets/${t.id}`)).http === 404);

    // Panel: moderatör ve finans görür; kuyrukta, ilgili işlem özetiyle
    const fin = await makeAdmin('finance');
    const queue = await call(fin.t, 'GET', '/admin/api/support/tickets?status=OPEN');
    const row = queue._arr?.find((x: { id: string }) => x.id === t.id);
    check('in queue, not overdue', row && row.overdue === false && row.email === u.email);
    const detail = await call(fin.t, 'GET', `/admin/api/support/tickets/${t.id}`);
    check('detail has related purchase + user', detail.related?.type === 'purchase' && detail.related.text.includes('500') && detail.user.email === u.email && detail.appVersion === '1.0.0+1');
    const shot = await fetch(`${B}/admin/api/support/tickets/attachments/${t.messages[0].id}`, { headers: { authorization: `Bearer ${fin.t}` } });
    check('staff sees screenshot', shot.status === 200);

    const before = mailsFor(u.email).length;
    check('reply', (await call(fin.t, 'POST', `/admin/api/support/tickets/${t.id}/reply`, { body: 'Kontrol ettik, eksik 50 jetonu yükledik.' })).http === 200);
    const mails = await waitFor(() => mailsFor(u.email), (m) => m.length > before, 5000, 100);
    check('reply emailed', mails.at(-1)?.includes('eksik 50 jetonu'));

    const list = await call(u.t, 'GET', '/support/tickets');
    check('user sees unread answer', list.unread === 1 && list.tickets[0].status === 'ANSWERED');
    const opened = await call(u.t, 'GET', `/support/tickets/${t.id}`);
    check('staff reply visible, marked read', opened.messages.length === 2 && opened.messages[1].fromStaff && opened.unread === false);
    check('unread cleared', (await call(u.t, 'GET', '/support/tickets')).unread === 0);

    // Kullanıcı cevap yazınca sıra tekrar bizde, yeni hedef süre
    const follow = await call(u.t, 'POST', `/support/tickets/${t.id}/messages`, { body: 'Teşekkürler, geldi!' });
    check('follow-up reopens', follow.http === 201 && follow.status === 'OPEN');
    const row2 = await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    check('first response time kept', row2.firstResponseAt !== null && row2.dueAt > new Date());

    check('close by staff', (await call(fin.t, 'POST', `/admin/api/support/tickets/${t.id}/reply`, { body: 'Rica ederiz, iyi eğlenceler!', close: true })).http === 200);
    const closed = await call(u.t, 'POST', `/support/tickets/${t.id}/messages`, { body: 'Bir şey daha' });
    check('closed ticket takes no messages', closed.http === 409 && closed.error === 'ticket_closed');

    const metrics = await call(fin.t, 'GET', '/admin/api/support/tickets/metrics');
    check('metrics', metrics.targetHours === 48 && metrics.last30Days >= 1 && metrics.withinTargetPct === 100);
    const audit = await call((await makeAdmin('super')).t, 'GET', '/admin/api/audit?action=support');
    check('attachment view audited', JSON.stringify(audit).includes('support.attachment_view'));
  });

  it('destek: açık talep sınırı, kullanıcı kapatabilir, yetkisiz rol göremez', async () => {
    const u = await registerVerified(`sinir${uniqueTag()}@test.com`);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const t = await openTicket(u.t, { category: 'other', subject: `Soru ${i}`, body: 'Uygulama hakkında bir sorum var.' });
      ids.push(t.id);
    }
    const sixth = await openTicket(u.t, { category: 'other', subject: 'Altıncı', body: 'Uygulama hakkında bir sorum var.' });
    check('open ticket limit', sixth.http === 429 && sixth.error === 'support_limit');
    check('user closes', (await call(u.t, 'POST', `/support/tickets/${ids[0]}/close`)).http === 200);
    check('can open again', (await openTicket(u.t, { category: 'bug', subject: 'Hata', body: 'Ekran donuyor, uygulama kapanıyor.' })).http === 201);
    check('regular user blocked from panel', (await call(u.t, 'GET', '/admin/api/support/tickets')).http === 403);
  });

  // Faz 16: uygulama içi geri bildirim, mevcut destek talebi altyapısını "suggestion" kategorisiyle kullanır
  it('destek: öneri kategorisi (uygulama içi geri bildirim)', async () => {
    const u = await registerVerified(`feedback${uniqueTag()}@test.com`);
    const t = await openTicket(u.t, { category: 'suggestion', subject: 'Fikrim var', body: 'Keşfette filtre olarak boy eklenebilir mi?' });
    check('öneri talebi açılır', t.http === 201);
    const fin = await makeAdmin('finance');
    const detail = await call(fin.t, 'GET', `/admin/api/support/tickets/${t.id}`);
    check('panelde öneri kategorisiyle görünür', detail.category === 'suggestion');
  });

  it('yardım merkezi: herkese açık, değerler ayarlardan, arama, panelden düzenleme', async () => {
    const r = await (await fetch(`${B}/help/articles?lang=tr`)).json();
    check('default FAQ loaded', r.categories.length === 5 && r.categories.every((c: { articles: unknown[] }) => c.articles.length > 0));
    const all = JSON.stringify(r);
    check('placeholders filled', !all.includes('{{') && all.includes('15'));
    const search = await (await fetch(`${B}/help/articles?lang=tr&q=${encodeURIComponent('İADE')}`)).json();
    check('turkish case-insensitive search', search.categories.length >= 1 && JSON.stringify(search).toLocaleLowerCase('tr').includes('iade'));
    const en = await (await fetch(`${B}/help/articles?lang=en`)).json();
    check('english FAQ', en.categories[0].title === 'Coins & purchases');
    const page = await fetch(`${B}/help?lang=tr&q=arama`);
    const html = await page.text();
    check('web page', page.status === 200 && html.includes('Yardım merkezi') && html.includes('<details'));

    const mod = await makeAdmin('moderator');
    const fin = await makeAdmin('finance');
    check('finance cannot edit help', (await call(fin.t, 'GET', '/admin/api/support/help')).http === 403);
    const tag = uniqueTag();
    const a = await call(mod.t, 'POST', '/admin/api/support/help', { locale: 'tr', category: 'account', question: `Test sorusu ${tag}?`, answer: 'Bu bir deneme cevabıdır, silinecek.' });
    check('created', a.http === 201);
    const shown = await (await fetch(`${B}/help/articles?lang=tr&q=${tag}`)).json();
    check('public sees it', JSON.stringify(shown).includes(tag));
    await call(mod.t, 'PUT', `/admin/api/support/help/${a.id}`, { published: false });
    const hidden = await (await fetch(`${B}/help/articles?lang=tr&q=${tag}`)).json();
    check('unpublished hidden', hidden.categories.length === 0);
    check('delete', (await call(mod.t, 'DELETE', `/admin/api/support/help/${a.id}`)).http === 200);
  });

  it('bildirim tercihleri ve kampanya izinleri (e-posta ayrı, bildirim ayrı) + İYS dışa aktarım', async () => {
    const u = await registerVerified(`bildirim${uniqueTag()}@test.com`);
    const d = await call(u.t, 'GET', '/me/notifications');
    check('defaults on', Object.values(d.prefs).every(Boolean) && d.quietHours.enabled === false);
    const s = await call(u.t, 'PUT', '/me/notifications', { prefs: { message: false, like: false }, quietHours: { enabled: true, start: 1380, end: 480 }, tzOffsetMin: 180 });
    check('saved', s.prefs.message === false && s.prefs.like === false && s.prefs.call === true && s.quietHours.enabled && s.quietHours.start === 1380);
    const s2 = await call(u.t, 'PUT', '/me/notifications', { prefs: { message: true } });
    check('partial update keeps others', s2.prefs.message === true && s2.prefs.like === false && s2.quietHours.enabled);
    check('invalid minute', (await call(u.t, 'PUT', '/me/notifications', { quietHours: { enabled: true, start: 2000, end: 10 } })).http === 400);
    check('unknown type', (await call(u.t, 'PUT', '/me/notifications', { prefs: { payout: false } })).http === 400);
    const off = await call(u.t, 'PUT', '/me/notifications', { quietHours: { enabled: false, start: 0, end: 0 } });
    check('quiet hours off', off.quietHours.enabled === false);

    const push = await call(u.t, 'PUT', '/me/consents', { kind: 'marketing_push', granted: true });
    check('marketing push separate', push.marketing_push === true && push.marketing === false);
    await call(u.t, 'PUT', '/me/consents', { kind: 'marketing', granted: true });
    const sup = await makeAdmin('super');
    const csv = await (await fetch(`${B}/admin/api/privacy/iys.csv`, { headers: { authorization: `Bearer ${sup.t}` } })).text();
    check('iys csv header', csv.includes('recipient,type,source,status,consentDate,recipientType'));
    check('iys has email consent', csv.includes(`${u.email},EPOSTA,HS_MOBIL,ONAY,`));
    await call(u.t, 'PUT', '/me/consents', { kind: 'marketing', granted: false });
    const csv2 = await (await fetch(`${B}/admin/api/privacy/iys.csv`, { headers: { authorization: `Bearer ${sup.t}` } })).text();
    check('iys latest state is RET', csv2.includes(`${u.email},EPOSTA,HS_MOBIL,RET,`) && !csv2.includes(`${u.email},EPOSTA,HS_MOBIL,ONAY,`));
    const mod = await makeAdmin('moderator');
    check('iys super only', (await fetch(`${B}/admin/api/privacy/iys.csv`, { headers: { authorization: `Bearer ${mod.t}` } })).status === 403);
  });

  it("web'den hesap silme: e-posta + şifre, bekleme süresi, girişle geri gelir", async () => {
    const u = await registerVerified(`websil${uniqueTag()}@test.com`);
    const page = await fetch(`${B}/account/delete?lang=tr`);
    const html = await page.text();
    check('form page', page.status === 200 && html.includes('<form') && html.includes('Hesabımı sil'));
    check('csp form-action self', page.headers.get('content-security-policy')?.includes("form-action 'self'"));

    const post = (email: string, password: string) =>
      fetch(`${B}/account/delete?lang=tr`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
    const bad = await post(u.email, 'yanlis-sifre-123');
    check('wrong password', bad.status === 401 && (await bad.text()).includes('hatalı'));
    const unknown = await post(`yok${uniqueTag()}@test.com`, 'bir-sifre-123');
    check('unknown email same answer', unknown.status === 401);
    const ok = await post(u.email.toUpperCase(), TEST_PASSWORD);
    check('deleted', ok.status === 200 && (await ok.text()).includes('kalıcı olarak silinecek'));
    const db = await testDb();
    check('pending deletion', (await db.user.findUniqueOrThrow({ where: { id: u.id } })).deletionRequestedAt !== null);
    check('session revoked', (await call(u.t, 'GET', '/me')).http === 401);
    check('confirmation email', mailsFor(u.email).at(-1)?.includes('silinecek'));
    await login(u.email);
    check('login restores', (await db.user.findUniqueOrThrow({ where: { id: u.id } })).deletionRequestedAt === null);
  });
});
