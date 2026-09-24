import type { Request, Response, NextFunction } from 'express';
import type { Sanction } from '@prisma/client';
import jwt from 'jsonwebtoken';
import type { AuthedRequest } from '../auth';
import { config } from '../config';
import { HttpError, prisma } from '../db';
import { sendMail } from '../mailer';
import { disconnectUser, emitToUser } from '../realtime';
import { closeAllPendingFor } from '../requestService';
import { revokeAllSessions } from '../sessions';

// Kademeli yaptırım: uyarı → 24 saat kısıt → 7 gün kısıt → kalıcı yasak. Ağır ihlalde (reşit olmayan,
// müstehcenlik, dolandırıcılık) moderatör doğrudan yasak verebilir. Her yaptırıma bir kez itiraz edilir.
// Kısıtlı kullanıcı giriş yapıp okuyabilir; mesaj, istek, beğeni, arama, fotoğraf ve profil değişikliği yapamaz.

export const LEVELS = ['warning', 'restrict_24h', 'restrict_7d', 'ban'] as const;
export type Level = (typeof LEVELS)[number];
export const SEVERE_REASONS = ['underage', 'inappropriate_content', 'scam'];

const HOURS: Partial<Record<Level, number>> = { restrict_24h: 24, restrict_7d: 24 * 7 };
const HISTORY_DAYS = 365; // bu süreden eski yaptırımlar basamağı artırmaz

// Kullanıcının sıradaki basamağı (geri alınmamış, son 1 yıldaki yaptırım sayısına göre)
export async function nextLevel(userId: string): Promise<Level> {
  const count = await prisma.sanction.count({
    where: { userId, revokedAt: null, createdAt: { gt: new Date(Date.now() - HISTORY_DAYS * 86_400_000) } },
  });
  return LEVELS[Math.min(count, LEVELS.length - 1)];
}

const LEVEL_TEXT: Record<Level, [string, string]> = {
  warning: ['bir uyarı aldı', 'received a warning'],
  restrict_24h: ['24 saat kısıtlandı', 'was restricted for 24 hours'],
  restrict_7d: ['7 gün kısıtlandı', 'was restricted for 7 days'],
  ban: ['kalıcı olarak kapatıldı', 'was permanently banned'],
};

export async function applySanction(input: {
  userId: string;
  level?: Level;
  reason: string;
  note?: string;
  source?: string;
  createdBy: string;
}) {
  const level = input.level ?? (await nextLevel(input.userId));
  const hours = HOURS[level];
  const endsAt = hours ? new Date(Date.now() + hours * 3_600_000) : null;
  const sanction = await prisma.sanction.create({
    data: { userId: input.userId, level, reason: input.reason, note: input.note ?? '', source: input.source ?? 'manual', createdBy: input.createdBy, endsAt },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (endsAt && (!user.restrictedUntil || user.restrictedUntil < endsAt)) {
    await prisma.user.update({ where: { id: user.id }, data: { restrictedUntil: endsAt } });
  }
  if (level === 'ban') {
    // Yasak: oturumlar kapanır, bekleyen istekler iade edilir, profil her yerden kalkar
    await prisma.user.update({ where: { id: user.id }, data: { bannedAt: new Date(), banReason: input.reason } });
    await revokeAllSessions(user.id, 'banned');
    await closeAllPendingFor(user.id);
    disconnectUser(user.id);
  } else {
    emitToUser(user.id, 'sanction', { id: sanction.id, level, endsAt });
  }
  const tr = user.locale === 'tr';
  const [trText, enText] = LEVEL_TEXT[level];
  await sendMail(
    user.email,
    tr ? 'MeetPoint: hesabınla ilgili bir karar' : 'MeetPoint: a decision about your account',
    tr
      ? `Merhaba,\n\nHesabın topluluk kurallarını ihlal ettiği için ${trText}.${input.note ? `\n\nAçıklama: ${input.note}` : ''}\n\nBu karara uygulamadan bir kez itiraz edebilirsin.`
      : `Hi,\n\nYour account ${enText} for breaking our community rules.${input.note ? `\n\nNote: ${input.note}` : ''}\n\nYou can appeal this decision once in the app.`,
  ).catch((e) => console.error('sanction mail', e));
  return sanction;
}

// Yaptırımı kaldır (itiraz kabulü veya yönetim kararı): kısıt/yasak yeniden hesaplanır
export async function revokeSanction(id: string) {
  const s = await prisma.sanction.update({ where: { id }, data: { revokedAt: new Date() } });
  const active = await prisma.sanction.findMany({
    where: { userId: s.userId, revokedAt: null, OR: [{ endsAt: { gt: new Date() } }, { level: 'ban' }] },
  });
  const until = active.filter((a) => a.endsAt).reduce<Date | null>((m, a) => (!m || a.endsAt! > m ? a.endsAt! : m), null);
  const stillBanned = active.some((a) => a.level === 'ban');
  await prisma.user.update({
    where: { id: s.userId },
    data: { restrictedUntil: until, ...(stillBanned ? {} : { bannedAt: null, banReason: '' }) },
  });
  return s;
}

// Kısıtlı kullanıcı içerik oluşturamaz (authenticate restrictedUntil'i yükler)
export function requireNotRestricted(req: Request, _res: Response, next: NextFunction) {
  const until = (req as AuthedRequest).user?.restrictedUntil;
  if (until && until > new Date()) throw new HttpError(403, 'restricted', { until });
  next();
}

export const sanctionDto = (s: Sanction & { appeal?: { status: string; answer: string } | null }) => ({
  id: s.id,
  level: s.level,
  reason: s.reason,
  note: s.note,
  endsAt: s.endsAt,
  createdAt: s.createdAt,
  revoked: s.revokedAt !== null,
  seen: s.seenAt !== null,
  appeal: s.appeal ? { status: s.appeal.status, answer: s.appeal.answer } : null,
});

// Yasaklı kullanıcı giriş yapamaz: itiraz için kısa ömürlü, sadece itiraza yarayan anahtar verilir
export function appealToken(userId: string, sanctionId: string) {
  return jwt.sign({ sub: userId, sid: sanctionId, purpose: 'appeal' }, config.jwtSecret, { expiresIn: 3600 });
}

export function readAppealToken(token: string) {
  try {
    const p = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (p.purpose !== 'appeal' || !p.sub || !p.sid) throw new Error('purpose');
    return { userId: String(p.sub), sanctionId: String(p.sid) };
  } catch {
    throw new HttpError(401, 'invalid_token');
  }
}

export async function createAppeal(userId: string, sanctionId: string, message: string) {
  const s = await prisma.sanction.findUnique({ where: { id: sanctionId }, include: { appeal: true } });
  if (!s || s.userId !== userId || s.revokedAt) throw new HttpError(404, 'not_found');
  if (s.appeal) throw new HttpError(409, 'already_appealed');
  return prisma.appeal.create({ data: { sanctionId, userId, message } });
}

// Yasaklı kullanıcının girişinde gösterilecek son yasak
export const latestBan = (userId: string) =>
  prisma.sanction.findFirst({ where: { userId, level: 'ban', revokedAt: null }, orderBy: { createdAt: 'desc' }, include: { appeal: true } });
