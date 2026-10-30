import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/postgres-adapter';
import { createAdapter as createRedisAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import { authenticate } from './auth';
import { recordTraffic } from './moderation/traffic';
import { config, corsOrigins } from './config';
import { prisma } from './db';
import { pool } from './pgPool';
import { redis } from './redis';

let io: Server | null = null;

// Faz 25: çevrimiçi durumu. Redis varsa bağlı kullanıcılar bir ZSET'te (skor = son kalp atışı) tutulur:
// destedeki 50 kartın "şu an" rozeti tek ZMSCORE ile okunur (her kart için tüm sunuculara soru yayılmaz).
// Rozet 90 sn'ye kadar gecikebilir; arama gibi kesin karar gereken yerler isOnline() ile hâlâ tam sonuç alır.
const PRESENCE_KEY = 'vibeupme:presence';
const PRESENCE_BEAT_MS = 30_000;
const PRESENCE_TTL_MS = 90_000;
let presenceSweep: ReturnType<typeof setInterval> | null = null;
const touchPresence = (userId: string) => void redis?.zadd(PRESENCE_KEY, Date.now(), userId).catch(() => {});

// Çevrimiçi/çevrimdışı olayları (ör. aramadaki bağlantı kopması). Birden fazla sunucuda çalışırken
// "çevrimdışı" kararı küme genelinde verilir: kullanıcının başka sunucuda bağlantısı varsa çevrimiçidir.
const offlineHooks: ((userId: string) => void | Promise<void>)[] = [];
const onlineHooks: ((userId: string) => void | Promise<void>)[] = [];

export function onUserOffline(hook: (userId: string) => void | Promise<void>) {
  offlineHooks.push(hook);
}

export function onUserOnline(hook: (userId: string) => void | Promise<void>) {
  onlineHooks.push(hook);
}

// Küme genelinde: kullanıcının herhangi bir sunucuda açık bağlantısı var mı?
// Birden çok kullanıcının çevrimiçi durumu (keşfet destesi). Redis yoksa tek tek tam kontrol.
export async function onlineMany(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  if (redis) {
    try {
      const scores = await redis.zmscore(PRESENCE_KEY, ...ids);
      const cutoff = Date.now() - PRESENCE_TTL_MS;
      return new Set(ids.filter((_, i) => scores[i] !== null && Number(scores[i]) > cutoff));
    } catch {
      // Redis'e ulaşılamadı: aşağıdaki tam kontrole düş
    }
  }
  const flags = await Promise.all(ids.map((id) => isOnline(id)));
  return new Set(ids.filter((_, i) => flags[i]));
}

export async function isOnline(userId: string) {
  if (!io) return false;
  try {
    return (await io.in(`user:${userId}`).fetchSockets()).length > 0;
  } catch {
    // Diğer sunuculardan yanıt gelmedi: kararsız durumda çevrimiçi say (aramayı haksız yere bitirme)
    return true;
  }
}

// Her kullanıcı kendi odasına ("user:<id>") katılır; sunucu olayları oraya yollar.
// PostgreSQL adaptörü sayesinde bir sunucudan gönderilen olay, kullanıcı hangi sunucuya bağlıysa ona ulaşır.
export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: config.isProduction ? corsOrigins : '*' } });
  // Redis varsa onun yayın/abone kanalı (onbinlerce bağlantı için); yoksa PostgreSQL LISTEN/NOTIFY
  if (redis) {
    io.adapter(createRedisAdapter(redis, redis.duplicate(), { key: 'vibeupme' }));
    presenceSweep = setInterval(() => {
      void redis!.zremrangebyscore(PRESENCE_KEY, '-inf', Date.now() - PRESENCE_TTL_MS * 2).catch(() => {});
    }, 60_000);
    presenceSweep.unref();
  } else {
    io.adapter(createAdapter(pool, { channelPrefix: 'vibeupme' }));
  }

  io.use(async (socket, next) => {
    try {
      const user = await authenticate(String(socket.handshake.auth?.token ?? ''));
      socket.data.userId = user.id;
      socket.data.sessionId = user.sessionId;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const me: string = socket.data.userId;
    socket.join(`user:${me}`);
    socket.join(`session:${socket.data.sessionId}`);
    // Çevrimiçi kalp atışı (Redis varsa)
    touchPresence(me);
    const beat = redis ? setInterval(() => touchPresence(me), PRESENCE_BEAT_MS) : null;
    // 5651: anlık bağlantı açılışı (vekil arkasında gerçek IP/port başlıklardan)
    const h = socket.handshake.headers;
    recordTraffic({
      userId: me,
      // Son değer bizim vekilin eklediği gerçek adres (baştakiler istemci tarafından uydurulabilir)
      ip: String(h['x-forwarded-for'] ?? socket.handshake.address).split(',').at(-1)!.trim(),
      port: Number(h['x-real-port'] ?? socket.request.socket.remotePort ?? 0) || 0,
      method: 'WS',
      path: '/socket.io',
      status: 101,
      createdAt: new Date(),
    });
    for (const hook of onlineHooks) void Promise.resolve(hook(me)).catch((e) => console.error('online hook', e));

    socket.on('disconnect', async () => {
      if (beat) clearInterval(beat);
      // Aynı kullanıcının bu veya başka sunucuda hâlâ bağlantısı varsa çevrimdışı sayılmaz
      if (await isOnline(me)) return;
      void redis?.zrem(PRESENCE_KEY, me).catch(() => {});
      for (const hook of offlineHooks) void Promise.resolve(hook(me)).catch((e) => console.error('offline hook', e));
    });

    // "Yazıyor..." göstergesi: sadece sohbetin tarafları arasında aktarılır.
    // Sohbet → karşı taraf eşlemesi bağlantı başına önbelleğe alınır.
    const peers = new Map<string, string | null>();
    socket.on('typing', async (payload: unknown) => {
      const conversationId = typeof payload === 'object' && payload ? String((payload as { conversationId?: unknown }).conversationId ?? '') : '';
      if (!conversationId) return;
      if (!peers.has(conversationId)) {
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } }).catch(() => null);
        const other = conv && (conv.userAId === me ? conv.userBId : conv.userBId === me ? conv.userAId : null);
        peers.set(conversationId, other ?? null);
      }
      const other = peers.get(conversationId);
      if (other) emitToUser(other, 'typing', { conversationId, userId: me });
    });
  });
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

// Kapatılan oturumun anlık bağlantılarını kes (tüm sunucularda)
export function disconnectSession(sessionId: string) {
  io?.in(`session:${sessionId}`).disconnectSockets(true);
}

// Yasaklanan kullanıcının açık bağlantılarını kapat (tüm sunucularda)
export function disconnectUser(userId: string) {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

export async function closeRealtime() {
  if (presenceSweep) clearInterval(presenceSweep);
  await io?.close();
}
