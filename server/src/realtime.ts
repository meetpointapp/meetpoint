import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { authenticate } from './auth';
import { prisma } from './db';

let io: Server | null = null;

// Çevrimiçi durumu: kullanıcı başına açık bağlantı sayısı
const online = new Map<string, number>();
const offlineHooks: ((userId: string) => void)[] = [];

export const isOnline = (userId: string) => (online.get(userId) ?? 0) > 0;

// Kullanıcının son bağlantısı kapandığında çağrılır (ör. aramayı düşürmek için)
export function onUserOffline(hook: (userId: string) => void) {
  offlineHooks.push(hook);
}

// Her kullanıcı kendi odasına ("user:<id>") katılır; sunucu olayları oraya yollar.
export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: '*' } });

  io.use(async (socket, next) => {
    try {
      const user = await authenticate(String(socket.handshake.auth?.token ?? ''));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const me: string = socket.data.userId;
    socket.join(`user:${me}`);
    online.set(me, (online.get(me) ?? 0) + 1);
    socket.on('disconnect', () => {
      const left = (online.get(me) ?? 1) - 1;
      if (left > 0) online.set(me, left);
      else {
        online.delete(me);
        for (const hook of offlineHooks) hook(me);
      }
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

// Yasaklanan kullanıcının açık bağlantılarını kapat
export function disconnectUser(userId: string) {
  io?.in(`user:${userId}`).disconnectSockets(true);
}
