import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { AuthedRequest } from './auth';
import { config } from './config';

// Kötüye kullanım koruması. Sınır aşılınca { error: 'rate_limited' } döner.
const base = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  handler: (_req: Request, res: import('express').Response) => res.status(429).json({ error: 'rate_limited' }),
};

const byUser = (req: Request) => (req as AuthedRequest).user?.id ?? ipKeyGenerator(req.ip ?? '');

// Lokal testler hep aynı IP'den geldiği için IP bazlı sınırlar geliştirmede gevşek tutulur
const ipLimit = (production: number) => (config.isProduction ? production : production * 25);

// Giriş/kayıt/şifre sıfırlama: IP başına 15 dakikada 20 deneme (kaba kuvvet saldırısına karşı)
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: ipLimit(20) });

// Kod doğrulama: IP başına 15 dakikada 30 deneme (ayrıca her kodun kendi deneme sınırı var)
export const codeLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: ipLimit(30) });

// Mesaj gönderme: kullanıcı başına dakikada 30 (spam'e karşı)
export const messageLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 30, keyGenerator: byUser });

// Ücretli istek: kullanıcı başına saatte 30
export const requestLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 30, keyGenerator: byUser });

// Kaydırma: kullanıcı başına dakikada 120 (bot davranışına karşı)
export const swipeLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 120, keyGenerator: byUser });

// Hata raporu: IP başına dakikada 30 (hata döngüsündeki uygulama sunucuyu boğmasın)
export const errorReportLimiter = rateLimit({ ...base, windowMs: 60_000, limit: ipLimit(30) });

// Şikayet: kullanıcı başına saatte 20
export const reportLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 20, keyGenerator: byUser });
