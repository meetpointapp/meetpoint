import type pg from 'pg';
import { closeLegacyCalls, processCallDeadlines, sweepCallPresence } from './calls';
import { scheduler as cfg } from './config';
import { prisma } from './db';
import { pool } from './pgPool';
import { cleanupIdempotencyKeys } from './idempotency';
import { expireStaleRequests } from './requestService';

// Zamanlayıcı: zamanı gelen işleri veritabanından okuyup işler (arama ücretleri, cevapsız aramalar,
// bağlantı kopmaları, süresi dolan istekler, eski hız sınırı kayıtları).
//
// Birden fazla sunucu çalışırken sadece biri "lider" olur ve işleri o yapar: PostgreSQL advisory
// lock ile seçilir. Lider çökerse bağlantısı kopar, kilit serbest kalır ve başka bir sunucu birkaç
// saniye içinde liderliği devralır. İşler veritabanında durduğu için hiçbir şey kaybolmaz.

const LOCK_KEY = 727_001; // "meetpoint zamanlayıcı" kilidi
let leaderClient: pg.PoolClient | null = null;
let timer: NodeJS.Timeout | null = null;
let running = false;
let lastAttempt = 0;
const lastRun: Record<string, number> = {};

export const isLeader = () => leaderClient !== null;

async function tryBecomeLeader() {
  if (leaderClient || Date.now() - lastAttempt < cfg.leaderRetryMs) return;
  lastAttempt = Date.now();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY]);
    if (!rows[0].ok) {
      client.release();
      return;
    }
    leaderClient = client;
    // Bağlantı koparsa kilit de gider: liderlik bırakılır, sonraki denemede yeniden yarışılır
    client.on('error', () => dropLeadership());
    console.log(`[zamanlayıcı] lider (pid ${process.pid})`);
    await closeLegacyCalls();
  } catch (e) {
    client.release();
    throw e;
  }
}

function dropLeadership() {
  if (!leaderClient) return;
  leaderClient.release(true);
  leaderClient = null;
  console.log('[zamanlayıcı] liderlik bırakıldı');
}

// `every` ms'de bir çalışacak iş
async function periodic(name: string, every: number, job: () => Promise<unknown>) {
  if (Date.now() - (lastRun[name] ?? 0) < every) return;
  lastRun[name] = Date.now();
  await job();
}

async function tick() {
  if (running) return; // önceki tur bitmeden yenisi başlamaz
  running = true;
  try {
    await tryBecomeLeader();
    if (!leaderClient) return;
    // Liderlik bağlantısı hâlâ canlı mı?
    await periodic('heartbeat', 2_000, () => leaderClient!.query('SELECT 1'));
    await processCallDeadlines();
    await periodic('presence', cfg.presenceSweepMs, () => sweepCallPresence());
    await periodic('requests', 30_000, () => expireStaleRequests());
    await periodic('idempotency', 3_600_000, cleanupIdempotencyKeys);
    await periodic('rateLimits', 60_000, () =>
      prisma.$executeRaw`DELETE FROM "RateLimitHit" WHERE "resetAt" < (now() AT TIME ZONE 'UTC')`,
    );
  } catch (e) {
    console.error('[zamanlayıcı]', e);
    // Lider bağlantısında hata: liderliği bırak (kilit veritabanı tarafında da düşer)
    if (leaderClient) {
      try {
        await leaderClient.query('SELECT 1');
      } catch {
        dropLeadership();
      }
    }
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (timer) return;
  timer = setInterval(() => void tick(), cfg.tickMs);
  void tick();
}

export async function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  if (leaderClient) {
    await leaderClient.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    dropLeadership();
  }
}
