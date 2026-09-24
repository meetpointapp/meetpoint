import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthedRequest } from '../auth';
import { retention } from '../config';
import { prisma } from '../db';

// 5651 sayılı Kanun: yer sağlayıcı trafik bilgisi (kaynak IP, port, zaman, kullanıcı) saklar ve resmi
// talepte bütünlüğü doğrulanabilir biçimde verir. Kayıtlar önce bellekte toplanır, birkaç saniyede bir
// parti hâlinde yazılır. Her parti bir öncekinin özetini içerir (hash zinciri); veritabanı tetikleyicisi
// değiştirme/silmeyi reddeder. Sadece saklama süresi dolan partiler imha işiyle silinir.
//
// Kaydedilenler: içerik oluşturan/değiştiren her istek (GET dışı), giriş/kayıt, anlık bağlantı açılışı.

export type TrafficRow = { userId: string; ip: string; port: number; method: string; path: string; status: number; createdAt: Date };

const LOCK_KEY = 727_002;
const FLUSH_MS = Number(process.env.TRAFFIC_FLUSH_MS ?? 2000);
const MAX_BUFFER = 5000;
let buffer: TrafficRow[] = [];
let timer: NodeJS.Timeout | null = null;
let flushing: Promise<void> | null = null;

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const rowLine = (r: TrafficRow) => `${r.userId}|${r.ip}|${r.port}|${r.method}|${r.path}|${r.status}|${r.createdAt.toISOString()}`;
export const rowsHash = (rows: TrafficRow[]) => sha256(rows.map(rowLine).join('\n'));
export const batchHash = (prevHash: string, rows: string) => sha256(`${prevHash}:${rows}`);

export function recordTraffic(row: TrafficRow) {
  buffer.push({ ...row, path: row.path.slice(0, 200), ip: row.ip.slice(0, 64), method: row.method.slice(0, 8) });
  if (buffer.length >= MAX_BUFFER) void flushTraffic();
  if (!timer) {
    timer = setInterval(() => void flushTraffic(), FLUSH_MS);
    timer.unref();
  }
}

// Birden fazla sunucu aynı zincire yazar: parti eklenirken küme genelinde kilit tutulur
export function flushTraffic(): Promise<void> {
  if (flushing) return flushing;
  if (!buffer.length) return Promise.resolve();
  const rows = buffer;
  buffer = [];
  flushing = prisma
    .$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      const last = await tx.trafficBatch.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } });
      const prevHash = last?.hash ?? 'genesis';
      const hashOfRows = rowsHash(rows);
      const batch = await tx.trafficBatch.create({
        data: { count: rows.length, rowsHash: hashOfRows, prevHash, hash: batchHash(prevHash, hashOfRows) },
      });
      await tx.trafficLog.createMany({ data: rows.map((r) => ({ ...r, batchId: batch.id })) });
    })
    .catch((e) => {
      // Yazılamadıysa kayıtlar kaybolmasın: sıraya geri al (bir sonraki denemede yazılır)
      console.error('[trafik] yazılamadı', e);
      buffer = rows.concat(buffer).slice(-MAX_BUFFER * 4);
    })
    .finally(() => {
      flushing = null;
    });
  return flushing;
}

// Vekil (nginx) arkasında kaynak port X-Real-Port başlığıyla gelir: proxy_set_header X-Real-Port $remote_port;
export const clientPort = (req: Request) => Number(req.header('x-real-port') ?? req.socket.remotePort ?? 0) || 0;

export function trafficMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const createdAt = new Date();
  res.on('finish', () => {
    const userId = (req as AuthedRequest).user?.id ?? (res.locals.userId as string | undefined) ?? '';
    recordTraffic({ userId, ip: String(req.ip ?? ''), port: clientPort(req), method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, createdAt });
  });
  next();
}

// Zincir doğrulama: her partinin satırları özetiyle, her parti bir öncekiyle tutarlı mı?
// Saklama süresi dolup silinen eski partiler yüzünden ilk kalan partinin prevHash'i kontrol edilmez.
export async function verifyTrafficChain() {
  const batches = await prisma.trafficBatch.findMany({ orderBy: { id: 'asc' } });
  let prev: string | null = null;
  let rows = 0;
  for (const b of batches) {
    const logs = await prisma.trafficLog.findMany({ where: { batchId: b.id }, orderBy: { id: 'asc' } });
    rows += logs.length;
    const ok =
      logs.length === b.count &&
      rowsHash(logs) === b.rowsHash &&
      batchHash(b.prevHash, b.rowsHash) === b.hash &&
      (prev === null || b.prevHash === prev);
    if (!ok) return { ok: false, batches: batches.length, rows, brokenAt: b.id.toString() };
    prev = b.hash;
  }
  return { ok: true, batches: batches.length, rows, brokenAt: null };
}

// Saklama süresi (varsayılan 2 yıl) dolan partileri sil. Tetikleyici sadece bu işlemde silmeye izin verir.
export async function purgeOldTraffic() {
  const cutoff = new Date(Date.now() - retention.trafficLogDays * 86_400_000);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('meetpoint.retention', 'on', true)`;
    const old = await tx.trafficBatch.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true } });
    if (!old.length) return 0;
    const ids = old.map((b) => b.id);
    const { count } = await tx.trafficLog.deleteMany({ where: { batchId: { in: ids } } });
    await tx.trafficBatch.deleteMany({ where: { id: { in: ids } } });
    return count;
  });
}

export function trafficCsv(rows: { userId: string; ip: string; port: number; method: string; path: string; status: number; createdAt: Date; batchId: bigint }[]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [
    'zaman_utc,kullanici,ip,port,yontem,yol,durum,parti',
    ...rows.map((r) => [r.createdAt.toISOString(), r.userId, r.ip, String(r.port), r.method, esc(r.path), String(r.status), r.batchId.toString()].join(',')),
  ].join('\n');
}
