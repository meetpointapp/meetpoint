import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Message } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { uid } from '../auth';
import { config } from '../config';
import { HttpError, isBlockedEitherWay, prisma } from '../db';
import { messageLimiter } from '../limits';
import { notify } from '../notify';
import { emitToUser } from '../realtime';
import { publicProfile } from './profile';

export const conversationsRouter = Router();

const userInclude = { include: { profile: true, photos: true } } as const;

// Tek seferlik fotoğraflar özel klasörde durur, herkese açık değildir
const upload = multer({
  storage: multer.diskStorage({
    destination: config.privateUploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `chat-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic)$/.test(file.mimetype)),
});

// İstemciye giden mesaj: dosya yolu asla dışarı verilmez
export const messageDto = (m: Message) => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  kind: m.kind,
  body: m.body,
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
  const { before } = z.object({ before: z.coerce.date().optional() }).parse(req.query);
  const messages = await prisma.message.findMany({
    where: { conversationId: req.params.id, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
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

async function deliver(conversationId: string, me: string, otherId: string, data: { kind: string; body: string; photoPath?: string }) {
  const message = await prisma.message.create({ data: { conversationId, senderId: me, ...data } });
  const dto = messageDto(message);
  emitToUser(otherId, 'message:new', dto);
  void notify(otherId, 'message', me, data.kind === 'photo' ? '📷' : data.body.slice(0, 120), { conversationId });
  return dto;
}

conversationsRouter.post('/conversations/:id/messages', messageLimiter, async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
  if (await isBlockedEitherWay(me, otherId)) throw new HttpError(403, 'blocked');
  const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  res.status(201).json(await deliver(conv.id, me, otherId, { kind: 'text', body }));
});

// Tek seferlik fotoğraf gönder
conversationsRouter.post('/conversations/:id/photos', messageLimiter, upload.single('photo'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'invalid_image');
  const me = uid(req);
  try {
    const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
    if (await isBlockedEitherWay(me, otherId)) throw new HttpError(403, 'blocked');
    res.status(201).json(await deliver(conv.id, me, otherId, { kind: 'photo', body: '', photoPath: req.file.filename }));
  } catch (e) {
    fs.rmSync(req.file.path, { force: true });
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

  const file = path.resolve(config.privateUploadDir, msg.photoPath);
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(file, () => fs.rmSync(file, { force: true }));
  emitToUser(msg.senderId, 'message:viewed', { id: msg.id, conversationId: msg.conversationId });
});
