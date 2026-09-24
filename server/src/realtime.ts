import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/postgres-adapter';
import { Server } from 'socket.io';
import { authenticate } from './auth';
import { config, corsOrigins } from './config';
import { prisma } from './db';
import { pool } from './pgPool';

let io: Server | null = null;

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
  io.adapter(createAdapter(pool, { channelPrefix: 'meetpoint' }));

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
    for (const hook of onlineHooks) void Promise.resolve(hook(me)).catch((e) => console.error('online hook', e));

    socket.on('disconnect', async () => {
      // Aynı kullanıcının bu veya başka sunucuda hâlâ bağlantısı varsa çevrimdışı sayılmaz
      if (await isOnline(me)) return;
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
  await io?.close();
}
