import crypto from 'node:crypto';
import { config } from './config';
import { HttpError, prisma } from './db';
import { codeMail, sendMail } from './mailer';

type Purpose = 'verify' | 'reset';

const hash = (userId: string, code: string) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

// 6 haneli kod üretip e-postayla gönderir. Aynı amaçla önceki kodlar geçersiz olur.
export async function issueCode(user: { id: string; email: string; locale: string }, purpose: Purpose) {
  const last = await prisma.emailCode.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (last && Date.now() - last.createdAt.getTime() < config.codeResendCooldownSec * 1000) {
    throw new HttpError(429, 'code_cooldown');
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await prisma.$transaction([
    prisma.emailCode.updateMany({ where: { userId: user.id, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.emailCode.create({
      data: {
        userId: user.id,
        purpose,
        codeHash: hash(user.id, code),
        expiresAt: new Date(Date.now() + config.codeTtlMinutes * 60_000),
      },
    }),
  ]);
  const mail = codeMail(user.locale, purpose, code);
  await sendMail(user.email, mail.subject, mail.text);
}

// Kodu doğrular ve tüketir. Yanlış denemeler sayılır; sınır aşılınca kod geçersiz olur.
export async function consumeCode(userId: string, purpose: Purpose, code: string) {
  const current = await prisma.emailCode.findFirst({
    where: { userId, purpose, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!current || current.expiresAt <= new Date() || current.attempts >= config.codeMaxAttempts) {
    throw new HttpError(400, 'code_expired');
  }
  const ok = crypto.timingSafeEqual(Buffer.from(current.codeHash), Buffer.from(hash(userId, code)));
  if (!ok) {
    await prisma.emailCode.update({ where: { id: current.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, 'code_invalid');
  }
  await prisma.emailCode.update({ where: { id: current.id }, data: { usedAt: new Date() } });
}
