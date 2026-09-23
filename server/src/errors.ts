import crypto from 'node:crypto';
import { prisma } from './db';

// Hata takibi (harici servis yok): hatalar parmak iziyle gruplanır, yönetim panelinde listelenir.
export type ErrorReport = {
  source: 'app' | 'server';
  platform?: string;
  appVersion?: string;
  message: string;
  stack?: string;
  context?: string;
  userId?: string;
};

// Yığındaki değişken kısımları (satır/sütun, bellek adresleri, kimlikler) at: aynı hata aynı iz versin
export function fingerprintOf(r: ErrorReport) {
  const firstFrames = (r.stack ?? '').split('\n').slice(0, 4).join('\n');
  const normalized = `${r.source}|${r.message}|${firstFrames}`
    .replace(/:\d+(:\d+)?/g, '')
    .replace(/0x[0-9a-f]+/gi, '')
    .replace(/\b[a-z0-9]{24,}\b/gi, '<id>');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 40);
}

// Hatalar bellekte toplanıp aralıklarla yazılır: bir hata fırtınasında (ör. veritabanı yavaşladığında)
// her hata için ayrı yazma yapılıp sorunu büyütmesin. Aralık başına her farklı hata için tek yazma.
const FLUSH_MS = Number(process.env.ERROR_FLUSH_MS ?? 5000);
const MAX_PENDING = 200; // aynı aralıkta en fazla bu kadar farklı hata tutulur, gerisi sayılmaz
type Pending = { report: ErrorReport; count: number; lastSeen: Date };
const pending = new Map<string, Pending>();
let dropped = 0;

export function recordError(r: ErrorReport) {
  const fingerprint = fingerprintOf(r);
  const p = pending.get(fingerprint);
  if (p) {
    p.count++;
    p.report = r; // son platform/sürüm/kullanıcı
    p.lastSeen = new Date();
  } else if (pending.size < MAX_PENDING) {
    pending.set(fingerprint, { report: r, count: 1, lastSeen: new Date() });
  } else {
    dropped++;
  }
}

export async function flushErrors() {
  if (!pending.size) return;
  const batch = [...pending.entries()];
  pending.clear();
  if (dropped) {
    console.error(`error log: ${dropped} hata kapasite aşımı nedeniyle kaydedilmedi`);
    dropped = 0;
  }
  for (const [fingerprint, { report: r, count, lastSeen }] of batch) {
    const data = {
      platform: (r.platform ?? '').slice(0, 20),
      appVersion: (r.appVersion ?? '').slice(0, 30),
      context: (r.context ?? '').slice(0, 200),
      lastUserId: r.userId ?? '',
      lastSeen,
    };
    try {
      await prisma.errorLog.upsert({
        where: { fingerprint },
        create: {
          fingerprint,
          source: r.source,
          message: r.message.slice(0, 1000),
          stack: (r.stack ?? '').slice(0, 8000),
          count,
          ...data,
        },
        // Çözüldü işaretlenmiş hata tekrar olursa yeniden açılır
        update: { ...data, count: { increment: count }, resolvedAt: null },
      });
    } catch (e) {
      // Kaydedilemeyen hata tekrar denenmez (sonsuz döngü olmasın), sadece konsola
      console.error('error log failed', e);
    }
  }
}

setInterval(() => void flushErrors(), FLUSH_MS).unref();
