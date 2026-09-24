import crypto from 'node:crypto';
import argon2 from 'argon2';
import bcrypt from 'bcryptjs';
import { passwordPolicy } from './config';
import { HttpError, prisma } from './db';

// Şifreler: Argon2id (OWASP önerisi: 19 MiB bellek, 2 tur, 1 iş parçacığı). Yerel (native) çalışır ve
// libuv iş parçacığında hesaplanır: toplu kayıtta sunucuyu bloke etmez (eski bcryptjs ediyordu).
// Eski bcrypt özetleri girişte doğrulanır ve kullanıcı fark etmeden Argon2id'ye yükseltilir.
const ARGON = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => argon2.hash(password, ARGON);

// Kullanıcı yoksa da aynı sürede yanıt verilsin (e-posta adresinin kayıtlı olup olmadığı zamanlamadan anlaşılmasın)
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(hash: string | null, password: string): Promise<{ ok: boolean; upgraded?: string }> {
  if (!hash) {
    dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'));
    await argon2.verify(await dummyHash, password).catch(() => false);
    return { ok: false };
  }
  if (hash.startsWith('$2')) {
    const ok = await bcrypt.compare(password, hash);
    return ok ? { ok, upgraded: await hashPassword(password) } : { ok };
  }
  const ok = await argon2.verify(hash, password).catch(() => false);
  // Parametreler güçlendirildiyse eski özet yenilenir
  return ok && argon2.needsRehash(hash, ARGON) ? { ok, upgraded: await hashPassword(password) } : { ok };
}

// --- Sızdırılmış şifre kontrolü ---
// 1) Çevrimdışı: en yaygın şifreler (Türkçe olanlar dahil)
// 2) Çevrimiçi: Have I Been Pwned "k-anonimlik" API'si. Şifrenin kendisi ya da tam özeti gönderilmez:
//    SHA-1 özetinin sadece ilk 5 karakteri gider, eşleşme yerelde aranır. Servis yanıt vermezse
//    kayıt engellenmez (çevrimdışı liste yine uygulanır).
const COMMON = new Set(
  [
    '12345678', '123456789', '1234567890', '12341234', '11111111', '00000000', '87654321', '123123123', '11223344',
    'password', 'password1', 'password123', 'passw0rd', 'qwertyui', 'qwerty123', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx',
    'abc12345', 'abcd1234', 'asdfghjk', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'welcome1',
    'superman', 'trustno1', 'letmein1', 'dragon12', 'monkey12', 'zaq12wsx', 'aa123456', 'a1234567', 'q1w2e3r4',
    'sifre123', 'sifre1234', 'parola123', 'parola12', 'sifresifre', 'galatasaray', 'fenerbahce', 'besiktas',
    'trabzonspor', 'galatasaray1905', 'fenerbahce1907', 'besiktas1903', 'istanbul', 'istanbul34', 'ankara06',
    'izmir3535', 'turkiye1', 'seniseviyorum', 'askim123', 'bitanem1', 'meetpoint', 'meetpoint1',
  ].map((p) => p.toLowerCase()),
);

async function breachCount(password: string): Promise<number> {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const res = await fetch(`${passwordPolicy.pwnedApiBase}/range/${sha1.slice(0, 5)}`, {
    headers: { 'Add-Padding': 'true', 'User-Agent': 'MeetPoint-server' },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(`HIBP ${res.status}`);
  const suffix = sha1.slice(5);
  for (const line of (await res.text()).split('\n')) {
    const [s, n] = line.trim().split(':');
    if (s === suffix) return Number(n);
  }
  return 0;
}

export async function assertPasswordAllowed(password: string, email?: string) {
  const p = password.toLowerCase();
  if (COMMON.has(p) || (email && p.includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4)) {
    throw new HttpError(400, 'password_too_common');
  }
  if (!passwordPolicy.breachCheck) return;
  try {
    if ((await breachCount(password)) > 0) throw new HttpError(400, 'password_breached');
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.warn('[şifre] sızıntı servisine ulaşılamadı, sadece yerel liste uygulandı');
  }
}

// --- Hesap başına kaba kuvvet kilidi ---
// IP sınırından bağımsız: çok sayıda IP'den tek hesaba deneme de durdurulur.
// 15 dakikada 10 hatalı denemeden sonra hesap 15 dakika girişe kapanır; başarılı girişte sayaç sıfırlanır.
const LOCK_WINDOW_MS = 15 * 60_000;
const LOCK_AFTER = 10;
const failKey = (email: string) => `login-fail:${email}`;

export async function assertNotLocked(email: string) {
  const row = await prisma.rateLimitHit.findUnique({ where: { key: failKey(email) } });
  if (row && row.hits >= LOCK_AFTER && row.resetAt > new Date()) throw new HttpError(429, 'account_locked');
}

export async function recordLoginFailure(email: string) {
  // Zaman SQL içinde UTC hesaplanır (tarih parametresi oturum saat dilimiyle kayabilir)
  await prisma.$executeRaw`
    INSERT INTO "RateLimitHit" ("key", "hits", "resetAt")
    VALUES (${failKey(email)}, 1, (now() AT TIME ZONE 'UTC') + ${LOCK_WINDOW_MS} * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimitHit"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE "RateLimitHit"."hits" + 1 END,
      "resetAt" = CASE WHEN "RateLimitHit"."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "RateLimitHit"."resetAt" END`;
}

export const clearLoginFailures = (email: string) => prisma.rateLimitHit.deleteMany({ where: { key: failKey(email) } });
