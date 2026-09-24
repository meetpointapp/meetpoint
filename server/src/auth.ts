import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { HttpError, prisma } from './db';

export type AdminRole = 'super' | 'moderator' | 'finance';

export interface AuthedUser {
  id: string;
  sessionId: string;
  isAdmin: boolean;
  adminRole: AdminRole | '';
  mfaEnabled: boolean;
  mfa: boolean; // bu oturumda yönetim 2FA'sı doğrulandı
  emailVerified: boolean;
  legalCurrent: boolean; // kullanım koşulları ve aydınlatma metninin güncel sürümü onaylı mı
  restrictedUntil: Date | null; // moderasyon kısıtı
}

export interface AuthedRequest extends Request {
  user: AuthedUser;
}

// Erişim jetonu: kullanıcı, tokenVersion (şifre değişince eski jetonlar geçersiz) ve oturum kimliği.
// Süresi dolan jeton "token_expired" verir: uygulama yenileme jetonuyla yenisini alır.
function decode(token: string): { sub: string; v: number; sid: string } {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw new HttpError(401, 'token_expired');
    throw new HttpError(401, 'invalid_token');
  }
  if (typeof payload === 'string' || !payload.sub || !payload.sid) throw new HttpError(401, 'invalid_token');
  return { sub: payload.sub, v: Number(payload.v ?? 0), sid: String(payload.sid) };
}

// Jetonu doğrular; oturum açık mı (çıkış, "diğer cihazlardan çık", yasak anında etkili) ve kullanıcı yasaklı mı bakar
export async function authenticate(token: string): Promise<AuthedUser> {
  const decoded = decode(token);
  const session = await prisma.session.findUnique({
    where: { id: decoded.sid },
    include: {
      user: {
        select: {
          id: true,
          tokenVersion: true,
          bannedAt: true,
          isAdmin: true,
          adminRole: true,
          mfaEnabledAt: true,
          emailVerifiedAt: true,
          termsVersion: true,
          privacyVersion: true,
          restrictedUntil: true,
        },
      },
    },
  });
  const user = session?.user;
  if (!session || !user || user.id !== decoded.sub) throw new HttpError(401, 'invalid_token');
  // Önce yasak kontrolü: yasaklama oturumları da kapatır, kullanıcı doğru mesajı görmeli
  if (user.bannedAt) throw new HttpError(403, 'banned');
  if (session.revokedAt || session.expiresAt < new Date() || user.tokenVersion !== decoded.v) {
    throw new HttpError(401, 'invalid_token');
  }
  return {
    id: user.id,
    sessionId: session.id,
    isAdmin: user.isAdmin,
    adminRole: (user.isAdmin ? user.adminRole : '') as AdminRole | '',
    mfaEnabled: user.mfaEnabledAt !== null,
    mfa: session.mfa,
    emailVerified: user.emailVerifiedAt !== null,
    legalCurrent: user.termsVersion === config.termsVersion && user.privacyVersion === config.privacyVersion,
    restrictedUntil: user.restrictedUntil,
  };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'unauthorized');
  (req as AuthedRequest).user = await authenticate(token);
  next();
}

// E-postası doğrulanmamış kullanıcılar sadece hesap/doğrulama uçlarına erişebilir
const UNVERIFIED_ALLOWED = [/^\/me$/, /^\/me\/locale$/, /^\/me\/sessions/, /^\/auth\//];

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user.emailVerified && !UNVERIFIED_ALLOWED.some((r) => r.test(req.path))) {
    throw new HttpError(403, 'email_not_verified');
  }
  next();
}

// Yasal metinler değiştiyse: kullanıcı yeni sürümü onaylayana kadar sadece hesap, gizlilik ve
// veri hakları uçları açık (verilerini indirebilir, hesabını silebilir, onay vermeyebilir)
const LEGAL_PENDING_ALLOWED = [
  /^\/me$/,
  /^\/me\/locale$/,
  /^\/me\/sessions/,
  /^\/me\/consents/,
  /^\/me\/data-export/,
  /^\/me\/kvkk-requests/,
  /^\/me\/devices$/,
  /^\/auth\//,
];

export function requireCurrentLegal(req: Request, _res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user.legalCurrent && !LEGAL_PENDING_ALLOWED.some((r) => r.test(req.path))) throw new HttpError(403, 'reconsent_required');
  next();
}

// Yönetim paneli: yönetici + bu oturumda 2FA doğrulanmış olmalı. 2FA kurulmamışsa önce kurulum.
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user?.isAdmin || !user.adminRole) throw new HttpError(403, 'forbidden');
  if (!user.mfaEnabled) throw new HttpError(403, 'mfa_setup_required');
  if (!user.mfa) throw new HttpError(403, 'mfa_required');
  next();
}

// Rol bazlı yetki: süper yönetici her şeyi yapabilir
export const requireRole =
  (...roles: AdminRole[]) =>
  // Genel parametre tipi: rota parametreleri (req.params.id) arkadaki işleyicide string olarak kalır
  <P>(req: Request<P>, _res: Response, next: NextFunction) => {
    const role = (req as unknown as AuthedRequest).user.adminRole;
    if (role !== 'super' && !roles.includes(role as AdminRole)) throw new HttpError(403, 'forbidden');
    next();
  };

export const uid = (req: Request) => (req as AuthedRequest).user.id;
export const currentSession = (req: Request) => (req as AuthedRequest).user.sessionId;
export const authedUser = (req: Request) => (req as AuthedRequest).user;
