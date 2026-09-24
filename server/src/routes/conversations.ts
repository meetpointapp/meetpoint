import type { Message } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { sanitizePrivatePhoto } from '../images';
import { privateStore, randomKey } from '../storage';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError, isBlockedEitherWay, prisma } from '../db';
import { messageLimiter } from '../limits';
import { afterMessage, contactInfo } from '../moderation/detect';
import { requireNotRestricted } from '../moderation/sanctions';
import { notify } from '../notify';
import { emitToUser } from '../realtime';
import { publicProfile } from './profile';

export const conversationsRouter = Router();

const userInclude = { include: { profile: true, photos: true } } as const;

// Tek seferlik fotoğraflar özel depoda durur, herkese açık değildir
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  // Tür ön süzgeci; asıl kontrol images.ts'te dosyanın içeriğine bakılarak yapılır
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

// İstemciye giden mesaj: dosya yolu asla dışarı verilmez
export const messageDto = (m: Message) => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  kind: m.kind,
  body: m.body,
  // contact: iletişim bilgisi paylaşıldı → alıcıya güvenlik ipucu gösterilir
  flag: m.flag,
  viewedAt: m.viewedAt,
  readAt: m.readAt,
  createdAt: m.createdAt,
});

async function getOwnConversation(id: string, me: string) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv || (conv.userAId !== me && conv.userBId !== me)) throw new HttpError(404, 'not_found');
  return { conv, otherId: conv.userAId === me ? conv.userBId : conv.userAId };
}

conversationsRouter.get('/conversations', async (req, res) => {
  const me = uid(req);
  const viewer = await prisma.profile.findUnique({ where: { userId: me }, select: { latitude: true, longitude: true } });
  const convs = await prisma.conversation.findMany({
    where: {
      OR: [{ userAId: me }, { userBId: me }],
      // Engellenen veya yasaklanan kişilerle sohbetler listede görünmez
      NOT: {
        OR: [
          { userA: { blocksGiven: { some: { toId: me } } } },
          { userA: { blocksReceived: { some: { fromId: me } } } },
          { userB: { blocksGiven: { some: { toId: me } } } },
          { userB: { blocksReceived: { some: { fromId: me } } } },
          { userA: { bannedAt: { not: null } } },
          { userB: { bannedAt: { not: null } } },
          // Silinmeyi bekleyen hesaplar da görünmez (geri gelirse sohbet yeniden görünür)
          { userA: { deletionRequestedAt: { not: null } } },
          { userB: { deletionRequestedAt: { not: null } } },
        ],
      },
    },
    include: {
      userA: userInclude,
      userB: userInclude,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { messages: { where: { senderId: { not: me }, readAt: null } } } },
    },
  });

  const list = convs
    .map((c) => ({
      id: c.id,
      origin: c.origin,
      createdAt: c.createdAt,
      user: publicProfile(c.userAId === me ? c.userB : c.userA, viewer),
      lastMessage: c.messages[0] ? messageDto(c.messages[0]) : null,
      unreadCount: c._count.messages,
    }))
    .sort((a, b) => +(b.lastMessage?.createdAt ?? b.createdAt) - +(a.lastMessage?.createdAt ?? a.createdAt));
  res.json(list);
});

conversationsRouter.get('/conversations/:id/messages', async (req, res) => {
  const me = uid(req);
  await getOwnConversation(req.params.id, me);
  // Sayfalama: "beforeId" mesajından daha eski olanlar. İmleç (zaman, kimlik) çiftidir: aynı
  // milisaniyede yazılmış mesajlar sayfa sınırında kaybolmaz ya da tekrarlanmaz.
  const { beforeId, limit } = z
    .object({ beforeId: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) })
    .parse(req.query);
  const cursor = beforeId
    ? await prisma.message.findFirst({ where: { id: beforeId, conversationId: req.params.id } })
    : null;
  if (beforeId && !cursor) throw new HttpError(404, 'not_found');
  const messages = await prisma.message.findMany({
    where: {
      conversationId: req.params.id,
      ...(cursor
        ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  res.json(messages.reverse().map(messageDto));
});

// Karşı tarafın mesajlarını okundu işaretle
conversationsRouter.post('/conversations/:id/read', async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(req.params.id, me);
  const readAt = new Date();
  const { count } = await prisma.message.updateMany({
    where: { conversationId: conv.id, senderId: otherId, readAt: null },
    data: { readAt },
  });
  if (count > 0) emitToUser(otherId, 'message:read', { conversationId: conv.id, readAt });
  res.json({ ok: true });
});

async function deliver(conversationId: string, me: string, otherId: string, data: { kind: string; body: string; photoPath?: string; flag?: string }) {
  const message = await prisma.message.create({ data: { conversationId, senderId: me, ...data } });
  const dto = messageDto(message);
  emitToUser(otherId, 'message:new', dto);
  void notify(otherId, 'message', me, data.kind === 'photo' ? '📷' : data.body.slice(0, 120), { conversationId });
  return dto;
}

conversationsRouter.post('/conversations/:id/messages', requireNotRestricted, messageLimiter, async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
  if (await isBlockedEitherWay(me, otherId)) throw new HttpError(403, 'blocked');
  const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  // Telefon, IBAN, sosyal medya vb. paylaşımı engellenmez: gönderene uyarı, alıcıya güvenlik ipucu
  const contact = contactInfo(body);
  const flag = contact.length ? 'contact' : '';
  const dto = await deliver(conv.id, me, otherId, { kind: 'text', body, flag });
  void afterMessage(me, dto.id, body, flag !== '').catch((e) => console.error('[moderasyon] mesaj', e));
  res.status(201).json({ ...dto, ...(flag ? { warning: 'contact_info', contact } : {}) });
});

// Tek seferlik fotoğraf gönder
conversationsRouter.post('/conversations/:id/photos', requireNotRestricted, messageLimiter, upload.single('photo'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'invalid_image');
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
  if (await isBlockedEitherWay(me, otherId)) throw new HttpError(403, 'blocked');
  // Üst verisi temizlenmiş kopya saklanır (konum bilgisi karşı tarafa gitmez)
  const key = randomKey('chat', 'webp');
  await privateStore.put(key, await sanitizePrivatePhoto(req.file.buffer));
  try {
    res.status(201).json(await deliver(conv.id, me, otherId, { kind: 'photo', body: '', photoPath: key }));
  } catch (e) {
    await privateStore.remove(key);
    throw e;
  }
});

// Fotoğrafı aç: sadece alıcı, sadece bir kez. Açıldıktan sonra dosya silinir.
conversationsRouter.get('/messages/:id/photo', async (req, res) => {
  const me = uid(req);
  const msg = await prisma.message.findUnique({ where: { id: req.params.id }, include: { conversation: true } });
  const c = msg?.conversation;
  if (!msg || !c || (c.userAId !== me && c.userBId !== me) || msg.kind !== 'photo') throw new HttpError(404, 'not_found');
  if (msg.senderId === me) throw new HttpError(403, 'view_once_sender');
  if (msg.viewedAt || !msg.photoPath) throw new HttpError(410, 'already_viewed');

  // Yarış durumunda iki kez açılmasın: koşullu güncelle
  const { count } = await prisma.message.updateMany({
    where: { id: msg.id, viewedAt: null },
    data: { viewedAt: new Date(), photoPath: null },
  });
  if (count !== 1) throw new HttpError(410, 'already_viewed');

  const data = await privateStore.read(msg.photoPath);
  await privateStore.remove(msg.photoPath);
  if (!data) throw new HttpError(410, 'already_viewed');
  res.setHeader('Cache-Control', 'no-store');
  res.type(msg.photoPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg').send(data);
  emitToUser(msg.senderId, 'message:viewed', { id: msg.id, conversationId: msg.conversationId });
});
