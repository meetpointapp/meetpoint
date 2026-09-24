import { Router } from 'express';
import { z } from 'zod';
import { currentSession, requireAuth, uid } from '../auth';
import { consumeCode, issueCode } from '../codes';
import { HttpError, prisma } from '../db';
import { authLimiter, codeLimiter, refreshLimiter } from '../limits';
import { assertNotLocked, assertPasswordAllowed, clearLoginFailures, hashPassword, recordLoginFailure, verifyPassword } from '../passwords';
import { grantSignupBonus } from '../purchases';
import { appealToken, latestBan } from '../moderation/sanctions';
import { restoreIfPendingDeletion } from '../privacy/accounts';
import { acceptLegal, recordConsent } from '../privacy/consents';
import { createSession, refreshSession, revokeAllSessions, revokeSession } from '../sessions';
import { assertDeviceQuota, verifyCaptcha } from '../signupGuard';

export const authRouter = Router();

const email = z.email().transform((e) => e.toLowerCase().trim());
const password = z.string().min(8).max(128);
const code = z.string().regex(/^\d{6}$/);

authRouter.post('/register', authLimiter, async (req, res) => {
  const data = z
    .object({
      email,
      password,
      locale: z.enum(['tr', 'en']).optional(),
      // Kullanım koşulları + aydınlatma metni + 18 yaş beyanı zorunlu
      acceptTerms: z.literal(true),
      // İsteğe bağlı açık rızalar (ayrı kutucuklar, varsayılan kapalı)
      consents: z.object({ overseas: z.boolean().default(false), marketing: z.boolean().default(false) }).default({ overseas: false, marketing: false }),
      captchaToken: z.string().max(4096).optional(),
    })
    .parse(req.body);
  await verifyCaptcha(data.captchaToken, req.ip);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new HttpError(409, 'email_taken');
  await assertPasswordAllowed(data.password, data.email);
  const deviceId = String(req.header('x-device-id') ?? '').slice(0, 64);
  await assertDeviceQuota(deviceId);

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email: data.email, passwordHash, locale: data.locale ?? 'tr', registeredDeviceId: deviceId },
    });
    const ip = String(req.ip ?? '');
    await acceptLegal(tx, u.id, 'register', ip);
    if (data.consents.overseas) await recordConsent(tx, u.id, 'overseas_transfer', true, 'register', ip);
    if (data.consents.marketing) await recordConsent(tx, u.id, 'marketing', true, 'register', ip);
    return tx.user.findUniqueOrThrow({ where: { id: u.id } });
  });
  await issueCode(user, 'verify');
  res.locals.userId = user.id;
  res.status(201).json(await createSession(user, req));
});

authRouter.post('/login', authLimiter, async (req, res) => {
  // Girişte uzunluk sınırı yok (eski kurallarla açılmış hesaplar da girebilsin), sadece üst sınır
  const data = z.object({ email, password: z.string().min(1).max(128) }).parse(req.body);
  await assertNotLocked(data.email);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const check = await verifyPassword(user?.passwordHash ?? null, data.password);
  if (!user || !check.ok) {
    await recordLoginFailure(data.email);
    throw new HttpError(401, 'invalid_credentials');
  }
  await clearLoginFailures(data.email);
  if (check.upgraded) await prisma.user.update({ where: { id: user.id }, data: { passwordHash: check.upgraded } });
  if (user.bannedAt) {
    // İtiraz edilmemiş bir yasak varsa uygulama itiraz formunu açabilsin
    const ban = await latestBan(user.id);
    throw new HttpError(403, 'banned', ban ? { reason: ban.reason, note: ban.note, appealed: !!ban.appeal, ...(ban.appeal ? {} : { appealToken: appealToken(user.id, ban.id) }) } : {});
  }
  // Silme talebinden sonraki bekleme süresinde giriş: hesap geri gelir
  res.locals.userId = user.id;
  const restored = await restoreIfPendingDeletion(user);
  res.json({ ...(await createSession(user, req, { notifyNewDevice: true })), ...(restored ? { restored: true } : {}) });
});

// Erişim jetonu yenileme: yenileme jetonu her kullanımda değişir
authRouter.post('/refresh', refreshLimiter, async (req, res) => {
  const data = z.object({ refreshToken: z.string().min(1).max(200) }).parse(req.body);
  res.json(await refreshSession(data.refreshToken));
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await revokeSession(currentSession(req), 'logout');
  res.json({ ok: true });
});

// Şifre değiştirme: mevcut şifre gerekir, bu cihaz dışındaki oturumlar kapanır
authRouter.post('/change-password', authLimiter, requireAuth, async (req, res) => {
  const data = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (!(await verifyPassword(user.passwordHash, data.currentPassword)).ok) throw new HttpError(401, 'invalid_credentials');
  if (data.currentPassword === data.newPassword) throw new HttpError(400, 'password_same');
  await assertPasswordAllowed(data.newPassword, user.email);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.newPassword) } });
  await revokeAllSessions(user.id, 'password_changed', currentSession(req));
  res.json({ ok: true });
});

authRouter.post('/verify-email', codeLimiter, requireAuth, async (req, res) => {
  const data = z.object({ code }).parse(req.body);
  const userId = uid(req);
  await consumeCode(userId, 'verify', data.code);
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  // Kayıt hediyesi: doğrulanmış hesaplara bir kez (sahte hesap çiftliğine karşı doğrulamaya bağlı)
  await grantSignupBonus(userId);
  res.json({ ok: true });
});

authRouter.post('/resend-code', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (user.emailVerifiedAt) return res.json({ ok: true });
  await issueCode(user, 'verify');
  res.json({ ok: true });
});

// Hesabın var olup olmadığını belli etmemek için her zaman aynı yanıt döner
authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const data = z.object({ email }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (user && !user.bannedAt) {
    await issueCode(user, 'reset').catch((e) => {
      if (!(e instanceof HttpError && e.code === 'code_cooldown')) throw e;
    });
  }
  res.json({ ok: true });
});

authRouter.post('/reset-password', codeLimiter, async (req, res) => {
  const data = z.object({ email, code, password }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new HttpError(400, 'code_invalid');
  await consumeCode(user.id, 'reset', data.code);
  await assertPasswordAllowed(data.password, data.email);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(data.password),
      // Kodu e-postasına alabildiği için adres de doğrulanmış olur
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
  // Tüm oturumlar kapanır (hesap ele geçirilmiş olabilir), kilit kalkar
  await revokeAllSessions(user.id, 'password_reset');
  await clearLoginFailures(user.email);
  if (updated.bannedAt) throw new HttpError(403, 'banned');
  const restored = await restoreIfPendingDeletion(updated);
  res.json({ ...(await createSession(updated, req)), ...(restored ? { restored: true } : {}) });
});
