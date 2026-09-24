// Faz 10: yönetim paneli 2FA, roller, işlem kaydı
import { describe, it } from 'vitest';
import { call, check, makeAdmin, makeUser, registerVerified, TEST_PASSWORD, testDb, totpCode, uniqueTag } from '../helpers';

describe('Yönetim paneli güvenliği (Faz 10)', () => {
  it('2FA: kurulmadan panel açılmaz; her girişte kod; kod ve yedek kod tekrar kullanılamaz', async () => {
    const u = await registerVerified(`mfa${uniqueTag()}@staff.test`);
    const db = await testDb();
    await db.user.update({ where: { id: u.id }, data: { isAdmin: true, adminRole: 'super' } });

    const noSetup = await call(u.t, 'GET', '/admin/api/stats');
    check('panel blocked until 2FA set up', noSetup.http === 403 && noSetup.error === 'mfa_setup_required', noSetup.error);
    const status0 = await call(u.t, 'GET', '/admin/api/mfa/status');
    check('status: not enabled', status0.http === 200 && status0.enabled === false && status0.role === 'super');

    const setup = await call(u.t, 'POST', '/admin/api/mfa/setup');
    check('setup returns secret + QR', setup.http === 200 && /^[A-Z2-7]+$/.test(setup.secret) && setup.qrSvg?.startsWith('<svg') && setup.uri?.startsWith('otpauth://totp/'));
    const stored = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    check('pending secret encrypted at rest', stored.mfaPendingSecret.startsWith('v1:') && !stored.mfaPendingSecret.includes(setup.secret));

    const bad = await call(u.t, 'POST', '/admin/api/mfa/enable', { code: '000000' === totpCode(setup.secret) ? '111111' : '000000' });
    check('wrong code does not enable', bad.http === 400 && bad.error === 'mfa_invalid');
    const code = totpCode(setup.secret);
    const enable = await call(u.t, 'POST', '/admin/api/mfa/enable', { code });
    check('enabled with 10 backup codes', enable.http === 200 && enable.backupCodes?.length === 10);
    check('this session is verified', (await call(u.t, 'GET', '/admin/api/stats')).http === 200);
    const again = await call(u.t, 'POST', '/admin/api/mfa/setup');
    check('cannot re-run setup when enabled', again.http === 409);

    // Yeni giriş: kod ister
    const login2 = await call(null, 'POST', '/auth/login', { email: u.email, password: TEST_PASSWORD });
    const need = await call(login2.token, 'GET', '/admin/api/stats');
    check('new session needs a code', need.http === 403 && need.error === 'mfa_required');
    const replay = await call(login2.token, 'POST', '/admin/api/mfa/verify', { code });
    check('same TOTP code cannot be reused', replay.http === 400 && replay.error === 'mfa_code_used', replay.error);
    const backup = enable.backupCodes[0];
    const viaBackup = await call(login2.token, 'POST', '/admin/api/mfa/verify', { code: backup.toUpperCase() });
    check('backup code works (case-insensitive)', viaBackup.http === 200 && viaBackup.backupCodesLeft === 9);
    check('session verified by backup code', (await call(login2.token, 'GET', '/admin/api/stats')).http === 200);

    const login3 = await call(null, 'POST', '/auth/login', { email: u.email, password: TEST_PASSWORD });
    const backupAgain = await call(login3.token, 'POST', '/admin/api/mfa/verify', { code: backup });
    check('backup code is single-use', backupAgain.http === 400);
    const next = await call(login3.token, 'POST', '/admin/api/mfa/verify', { code: totpCode(setup.secret, 1) });
    check('next-window code accepted (clock drift)', next.http === 200);

    // Deneme sınırı: 10 hatalı koddan sonra 429
    const login4 = await call(null, 'POST', '/auth/login', { email: u.email, password: TEST_PASSWORD });
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) {
      const r = await call(login4.token, 'POST', '/admin/api/mfa/verify', { code: String(100000 + i) });
      limited = r.http === 429;
    }
    check('code guessing rate-limited', limited);

    const audit = await db.adminAudit.findMany({ where: { adminId: u.id }, orderBy: { createdAt: 'asc' } });
    check('mfa events audited', audit.some((a) => a.action === 'mfa.enable') && audit.some((a) => a.action === 'mfa.backup_code_used'));
  });

  it('normal kullanıcı 2FA uçlarına da erişemez', async () => {
    const u = await registerVerified(`nomfa${uniqueTag()}@test.com`);
    check('mfa status forbidden', (await call(u.t, 'GET', '/admin/api/mfa/status')).http === 403);
    check('mfa setup forbidden', (await call(u.t, 'POST', '/admin/api/mfa/setup')).http === 403);
    check('admin api forbidden', (await call(u.t, 'GET', '/admin/api/stats')).error === 'forbidden');
  });

  it('roller: moderatör ödemeleri, finans şikayetleri göremez; ekip ve kayıt sadece süper yöneticide', async () => {
    const mod = await makeAdmin('moderator');
    const fin = await makeAdmin('finance');
    const sup = await makeAdmin('super');
    const cases: [string, string, Record<string, number>][] = [
      ['GET', '/admin/api/stats', { mod: 200, fin: 200, sup: 200 }],
      ['GET', '/admin/api/reports', { mod: 200, fin: 403, sup: 200 }],
      ['GET', '/admin/api/verifications', { mod: 200, fin: 403, sup: 200 }],
      ['GET', '/admin/api/users', { mod: 200, fin: 200, sup: 200 }],
      ['GET', '/admin/api/payouts', { mod: 403, fin: 200, sup: 200 }],
      ['GET', '/admin/api/purchases', { mod: 403, fin: 200, sup: 200 }],
      ['GET', '/admin/api/errors', { mod: 403, fin: 403, sup: 200 }],
      ['GET', '/admin/api/staff', { mod: 403, fin: 403, sup: 200 }],
      ['GET', '/admin/api/audit', { mod: 403, fin: 403, sup: 200 }],
    ];
    const tokens: Record<string, string> = { mod: mod.t, fin: fin.t, sup: sup.t };
    for (const [method, p, expected] of cases) {
      for (const [who, status] of Object.entries(expected)) {
        const r = await call(tokens[who], method, p);
        check(`${who} ${p} -> ${status}`, r.http === status, String(r.http));
      }
    }
    const finBan = await call(fin.t, 'POST', `/admin/api/users/${mod.id}/ban`, { reason: 'x' });
    check('finance cannot ban', finBan.http === 403);
    const selfBan = await call(mod.t, 'POST', `/admin/api/users/${mod.id}/ban`, { reason: 'x' });
    check('cannot ban yourself', selfBan.error === 'cannot_ban_self');
  });

  it('yasaklama oturumları kapatır; tüm yönetim işlemleri silinemez kayda yazılır', async () => {
    const mod = await makeAdmin('moderator');
    const sup = await makeAdmin('super');
    const target = await makeUser('Hedef', 'female', 'male');

    const ban = await call(mod.t, 'POST', `/admin/api/users/${target.id}/ban`, { reason: 'spam' });
    check('moderator bans', ban.http === 200);
    check('banned user told so', (await call(target.t, 'GET', '/me')).error === 'banned');
    check('banned user cannot refresh', (await call(null, 'POST', '/auth/refresh', { refreshToken: target.refresh })).http !== 200);
    await call(mod.t, 'POST', `/admin/api/users/${target.id}/unban`);
    const after = await call(target.t, 'GET', '/me');
    check('old session stays closed after unban', after.http === 401, String(after.http));
    check('can log in again after unban', (await call(null, 'POST', '/auth/login', { email: target.email, password: TEST_PASSWORD })).http === 200);

    const log = await call(sup.t, 'GET', `/admin/api/audit?targetId=${target.id}`);
    const actions = log._arr?.map((a) => a.action) ?? [];
    check('ban + unban audited', actions.includes('user.ban') && actions.includes('user.unban'), actions.join(','));
    const row = log._arr?.find((a) => a.action === 'user.ban');
    check('audit has who + details', row?.adminEmail === mod.email && row?.details?.reason === 'spam' && !!row?.ip);
    const filtered = await call(sup.t, 'GET', '/admin/api/audit?action=user.');
    check('audit filter by action prefix', filtered._arr?.every((a) => a.action.startsWith('user.')));

    // Kayıtlar değiştirilemez ve silinemez (veritabanı tetikleyicisi)
    const db = await testDb();
    const id = row.id as string;
    const tryUpdate = await db.adminAudit.update({ where: { id }, data: { action: 'silindi' } }).then(() => 'ok', (e) => String(e));
    check('audit row cannot be updated', tryUpdate !== 'ok' && /değiştirilemez|append-only|admin_audit/i.test(tryUpdate), tryUpdate.slice(0, 120));
    const tryDelete = await db.adminAudit.delete({ where: { id } }).then(() => 'ok', (e) => String(e));
    check('audit row cannot be deleted', tryDelete !== 'ok');
  });

  it('ekip yönetimi: rol ver, 2FA sıfırla, yetkiyi al', async () => {
    const sup = await makeAdmin('super');
    const member = await registerVerified(`uye${uniqueTag()}@test.com`);

    const unknown = await call(sup.t, 'POST', '/admin/api/staff', { email: `yok${uniqueTag()}@test.com`, role: 'moderator' });
    check('unknown email -> 404', unknown.http === 404);
    const give = await call(sup.t, 'POST', '/admin/api/staff', { email: member.email, role: 'moderator' });
    check('role granted', give.http === 200);
    const staff = await call(sup.t, 'GET', '/admin/api/staff');
    check('member listed without 2FA', staff._arr?.some((s) => s.id === member.id && s.role === 'moderator' && s.mfaEnabled === false));
    check('new member must set up 2FA', (await call(member.t, 'GET', '/admin/api/reports')).error === 'mfa_setup_required');

    const setup = await call(member.t, 'POST', '/admin/api/mfa/setup');
    await call(member.t, 'POST', '/admin/api/mfa/enable', { code: totpCode(setup.secret) });
    check('member works after 2FA', (await call(member.t, 'GET', '/admin/api/reports')).http === 200);

    const reset = await call(sup.t, 'POST', `/admin/api/staff/${member.id}/reset-mfa`);
    check('super resets member 2FA', reset.http === 200);
    check('member must set up again', (await call(member.t, 'GET', '/admin/api/reports')).error === 'mfa_setup_required');
    const selfReset = await call(sup.t, 'POST', `/admin/api/staff/${sup.id}/reset-mfa`);
    check('cannot reset own 2FA', selfReset.http === 400);
    const selfRole = await call(sup.t, 'POST', '/admin/api/staff', { email: sup.email, role: 'none' });
    check('cannot change own role', selfRole.http === 400);

    const remove = await call(sup.t, 'POST', '/admin/api/staff', { email: member.email, role: 'none' });
    check('role removed', remove.http === 200);
    check('removed member logged out', (await call(member.t, 'GET', '/me')).http === 401);
    const audit = await call(sup.t, 'GET', `/admin/api/audit?targetId=${member.id}`);
    check('staff changes audited', ['staff.role', 'staff.reset_mfa'].every((a) => audit._arr?.some((r) => r.action === a)));
  });

  it('güvenlik başlıkları: panelde CSP, her yanıtta temel başlıklar', async () => {
    const { B } = await import('../helpers');
    const panel = await fetch(`${B}/admin/`);
    const csp = panel.headers.get('content-security-policy') ?? '';
    check('panel has strict CSP', csp.includes("script-src 'self'") && csp.includes("frame-ancestors 'none'"), csp);
    check('nosniff', panel.headers.get('x-content-type-options') === 'nosniff');
    check('no x-powered-by', !panel.headers.get('x-powered-by'));
    check('panel not cached', panel.headers.get('cache-control')?.includes('no-store'));
  });
});
