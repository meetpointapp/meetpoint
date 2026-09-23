import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, signToken, uid } from '../auth';
import { consumeCode, issueCode } from '../codes';
import { config } from '../config';
import { HttpError, prisma } from '../db';
import { authLimiter, codeLimiter } from '../limits';
import { grantSignupBonus } from '../purchases';

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
      // Kullanım koşulları + gizlilik politikası + 18 yaş beyanı zorunlu
      acceptTerms: z.literal(true),
    })
    .parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new HttpError(409, 'email_taken');

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 10),
      locale: data.locale ?? 'tr',
      termsAcceptedAt: new Date(),
      termsVersion: config.termsVersion,
    },
  });
  await issueCode(user, 'verify');
  res.status(201).json({ token: signToken(user), userId: user.id });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const data = z.object({ email, password }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new HttpError(401, 'invalid_credentials');
  }
  if (user.bannedAt) throw new HttpError(403, 'banned');
  res.json({ token: signToken(user), userId: user.id });
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
  // tokenVersion artışı: diğer cihazlardaki oturumlar kapanır
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(data.password, 10),
      tokenVersion: { increment: 1 },
      // Kodu e-postasına alabildiği için adres de doğrulanmış olur
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
  res.json({ token: signToken(updated), userId: updated.id });
});
