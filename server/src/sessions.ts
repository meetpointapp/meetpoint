import crypto from 'node:crypto';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { config, sessionPolicy } from './config';
import { HttpError, prisma } from './db';
import { newDeviceMail, sendMail } from './mailer';
import { disconnectSession } from './realtime';

// Oturumlar: erişim jetonu (kısa ömürlü JWT, oturum kimliği taşır) + yenileme jetonu (her kullanımda
// değişir). 60 gün kullanılmayan oturum düşer. Çıkış, şifre değişimi, yasaklama ve "diğer cihazlardan
// çık" oturumları anında kapatır (erişim jetonları her istekte oturuma bakılarak doğrulanır).

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const newRefreshToken = () => crypto.randomBytes(32).toString('base64url');
const expiry = () => new Date(Date.now() + sessionPolicy.idleDays * 86_400_000);

export function signAccess(user: { id: string; tokenVersion: number }, sessionId: string) {
  return jwt.sign({ sub: user.id, v: user.tokenVersion, sid: sessionId }, config.jwtSecret, {
    expiresIn: sessionPolicy.accessTokenSeconds,
  });
}

// İstekten cihaz bilgisi (uygulama gönderir; tarayıcıda User-Agent'tan kısa ad)
function deviceOf(req: Request) {
  const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
  const ua = clip(req.headers['user-agent'], 200);
  const guess = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : '';
  return {
    deviceId: clip(req.header('x-device-id'), 64),
    deviceName: clip(req.header('x-device-name'), 60) || guess || 'Bilinmeyen cihaz',
    platform: clip(req.header('x-platform'), 20),
    ip: clip(req.ip, 64),
  };
}

export type IssuedTokens = { token: string; refreshToken: string; userId: string };

export async function createSession(
  user: { id: string; tokenVersion: number; email: string; locale: string },
  req: Request,
  opts: { notifyNewDevice?: boolean } = {},
): Promise<IssuedTokens> {
  const device = deviceOf(req);
  const refreshToken = newRefreshToken();

  // Yeni cihaz uyarısı: daha önce oturumu olan bir hesapta, bu cihazdan hiç giriş yapılmamışsa
  if (opts.notifyNewDevice) {
    const [previous, sameDevice] = await Promise.all([
      prisma.session.count({ where: { userId: user.id } }),
      device.deviceId ? prisma.session.count({ where: { userId: user.id, deviceId: device.deviceId } }) : Promise.resolve(0),
    ]);
    if (previous > 0 && sameDevice === 0) {
      const mail = newDeviceMail(user.locale, device.deviceName, maskIp(device.ip));
      void sendMail(user.email, mail.subject, mail.text).catch((e) => console.error('new device mail', e));
    }
  }

  const session = await prisma.session.create({
    data: { userId: user.id, refreshHash: sha256(refreshToken), expiresAt: expiry(), ...device },
  });
  return { token: signAccess(user, session.id), refreshToken, userId: user.id };
}

// Yenileme: yeni erişim + yeni yenileme jetonu. Önceki yenileme jetonu tekrar gelirse (çalınmış olabilir)
// oturum kapatılır. Aynı anda gelen iki yenilemeye (uygulama yarışı) kısa bir tolerans tanınır.
const RACE_GRACE_MS = 30_000;

export async function refreshSession(refreshToken: string): Promise<IssuedTokens> {
  const hash = sha256(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshHash: hash }, include: { user: true } });
  if (!session) {
    const reused = await prisma.session.findUnique({ where: { prevRefreshHash: hash } });
    if (reused && !reused.revokedAt) {
      if (reused.rotatedAt && Date.now() - reused.rotatedAt.getTime() < RACE_GRACE_MS) throw new HttpError(409, 'refresh_race');
      await revokeSession(reused.id, 'refresh_reused');
    }
    throw new HttpError(401, 'invalid_refresh');
  }
  if (session.revokedAt || session.expiresAt < new Date()) throw new HttpError(401, 'invalid_refresh');
  if (session.user.bannedAt) throw new HttpError(403, 'banned');

  const next = newRefreshToken();
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, refreshHash: hash, revokedAt: null },
    data: { refreshHash: sha256(next), prevRefreshHash: hash, rotatedAt: new Date(), lastUsedAt: new Date(), expiresAt: expiry() },
  });
  if (count !== 1) throw new HttpError(409, 'refresh_race');
  return { token: signAccess(session.user, session.id), refreshToken: next, userId: session.userId };
}

export async function revokeSession(id: string, reason: string) {
  await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  disconnectSession(id);
}

export async function revokeAllSessions(userId: string, reason: string, exceptId?: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  for (const s of sessions) await revokeSession(s.id, reason);
}

// IP'nin son bölümü gizlenir (kullanıcıya gösterim ve e-posta için)
export function maskIp(ip: string) {
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.replace(/\.\d+$/, '.*');
  return ip.includes(':') ? `${ip.split(':').slice(0, 3).join(':')}:…` : ip;
}

export async function listSessions(userId: string, currentId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });
  return sessions.map((s) => ({
    id: s.id,
    deviceName: s.deviceName,
    platform: s.platform,
    ip: maskIp(s.ip),
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    current: s.id === currentId,
  }));
}
