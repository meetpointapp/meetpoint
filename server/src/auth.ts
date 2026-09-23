import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { HttpError, prisma } from './db';

export interface AuthedUser {
  id: string;
  isAdmin: boolean;
  emailVerified: boolean;
}

export interface AuthedRequest extends Request {
  user: AuthedUser;
}

// Token, kullanıcının tokenVersion'ını taşır: şifre değişince eski tokenlar geçersiz olur
export function signToken(user: { id: string; tokenVersion: number }) {
  return jwt.sign({ sub: user.id, v: user.tokenVersion }, config.jwtSecret, { expiresIn: '30d' });
}

function decode(token: string): { sub: string; v: number } {
  const payload = jwt.verify(token, config.jwtSecret);
  if (typeof payload === 'string' || !payload.sub) throw new HttpError(401, 'invalid_token');
  return { sub: payload.sub, v: Number(payload.v ?? 0) };
}

// Token'ı doğrular ve kullanıcıyı yükler; yasaklı veya eski oturumları reddeder
export async function authenticate(token: string): Promise<AuthedUser> {
  let decoded: { sub: string; v: number };
  try {
    decoded = decode(token);
  } catch {
    throw new HttpError(401, 'invalid_token');
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, tokenVersion: true, bannedAt: true, isAdmin: true, emailVerifiedAt: true },
  });
  if (!user) throw new HttpError(401, 'invalid_token');
  // Önce yasak kontrolü: yasaklama tokenVersion'ı da artırır, kullanıcı doğru mesajı görmeli
  if (user.bannedAt) throw new HttpError(403, 'banned');
  if (user.tokenVersion !== decoded.v) throw new HttpError(401, 'invalid_token');
  return { id: user.id, isAdmin: user.isAdmin, emailVerified: user.emailVerifiedAt !== null };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'unauthorized');
  (req as AuthedRequest).user = await authenticate(token);
  next();
}

// E-postası doğrulanmamış kullanıcılar sadece hesap/doğrulama uçlarına erişebilir
const UNVERIFIED_ALLOWED = [/^\/me$/, /^\/me\/locale$/, /^\/auth\//];

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user.emailVerified && !UNVERIFIED_ALLOWED.some((r) => r.test(req.path))) {
    throw new HttpError(403, 'email_not_verified');
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!(req as AuthedRequest).user?.isAdmin) throw new HttpError(403, 'forbidden');
  next();
}

export const uid = (req: Request) => (req as AuthedRequest).user.id;
