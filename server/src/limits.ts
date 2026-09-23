import type { Request } from 'express';
import { type ClientRateLimitInfo, type Options, type Store, ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { AuthedRequest } from './auth';
import { config } from './config';
import { prisma } from './db';

// Sayaçlar PostgreSQL'de: birden fazla sunucu çalışırken aynı kullanıcı/IP için tek sayaç tutulur.
// Tek sorguda artır-veya-sıfırla (süresi dolan pencere yeniden başlar). Saatler UTC.
class PostgresStore implements Store {
  prefix: string;
  private windowMs = 60_000;
  constructor(prefix: string) {
    this.prefix = `${prefix}:`;
  }
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  async increment(key: string): Promise<ClientRateLimitInfo> {
    const k = this.prefix + key;
    const rows = await prisma.$queryRaw<{ hits: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitHit" ("key", "hits", "resetAt")
      VALUES (${k}, 1, (now() AT TIME ZONE 'UTC') + ${this.windowMs} * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateLimitHit"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimitHit"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimitHit"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "RateLimitHit"."resetAt" END
      RETURNING "hits", "resetAt"`;
    return { totalHits: rows[0].hits, resetTime: rows[0].resetAt };
  }
  async decrement(key: string) {
    await prisma.$executeRaw`UPDATE "RateLimitHit" SET "hits" = GREATEST("hits" - 1, 0) WHERE "key" = ${this.prefix + key}`;
  }
  async resetKey(key: string) {
    await prisma.$executeRaw`DELETE FROM "RateLimitHit" WHERE "key" = ${this.prefix + key}`;
  }
}

const store = (name: string) => ({ store: new PostgresStore(name) });

// Kötüye kullanım koruması. Sınır aşılınca { error: 'rate_limited' } döner.
const base = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  handler: (_req: Request, res: import('express').Response) => res.status(429).json({ error: 'rate_limited' }),
};

const byUser = (req: Request) => (req as AuthedRequest).user?.id ?? ipKeyGenerator(req.ip ?? '');

// Lokal testler hep aynı IP'den geldiği için IP bazlı sınırlar geliştirmede gevşek tutulur
const ipLimit = (production: number) => production * config.rateLimitScale;

// Giriş/kayıt/şifre sıfırlama: IP başına 15 dakikada 20 deneme (kaba kuvvet saldırısına karşı)
export const authLimiter = rateLimit({ ...base, ...store('auth'), windowMs: 15 * 60_000, limit: ipLimit(20) });

// Kod doğrulama: IP başına 15 dakikada 30 deneme (ayrıca her kodun kendi deneme sınırı var)
export const codeLimiter = rateLimit({ ...base, ...store('code'), windowMs: 15 * 60_000, limit: ipLimit(30) });

// Mesaj gönderme: kullanıcı başına dakikada 30 (spam'e karşı)
export const messageLimiter = rateLimit({ ...base, ...store('message'), windowMs: 60_000, limit: 30, keyGenerator: byUser });

// Ücretli istek: kullanıcı başına saatte 30
export const requestLimiter = rateLimit({ ...base, ...store('request'), windowMs: 60 * 60_000, limit: 30, keyGenerator: byUser });

// Kaydırma: kullanıcı başına dakikada 120 (bot davranışına karşı)
export const swipeLimiter = rateLimit({ ...base, ...store('swipe'), windowMs: 60_000, limit: 120, keyGenerator: byUser });

// Hata raporu: IP başına dakikada 30 (hata döngüsündeki uygulama sunucuyu boğmasın)
export const errorReportLimiter = rateLimit({ ...base, ...store('error'), windowMs: 60_000, limit: ipLimit(30) });

// Şikayet: kullanıcı başına saatte 20
export const reportLimiter = rateLimit({ ...base, ...store('report'), windowMs: 60 * 60_000, limit: 20, keyGenerator: byUser });
