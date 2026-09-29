import type { IcebreakerGame, Message, TicTacToeGame } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { recordFunnelStage } from '../analytics';
import { unlockMilestone } from '../achievements';
import { THIS_OR_THAT_PROMPTS } from '../catalog';
import { sanitizePrivatePhoto } from '../images';
import { privateStore, randomKey } from '../storage';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError, isBlockedEitherWay, prisma } from '../db';
import { messageLimiter } from '../limits';
import { afterMessage, contactInfo } from '../moderation/detect';
import { requireNotRestricted } from '../moderation/sanctions';
import { notify } from '../notify';
import { emitToUser, isOnline } from '../realtime';
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
  deliveredAt: m.deliveredAt,
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

// Karşı tarafın mesajlarını okundu işaretle (okunan mesaj her zaman teslim edilmiş sayılır)
conversationsRouter.post('/conversations/:id/read', async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(req.params.id, me);
  const now = new Date();
  const { count } = await prisma.message.updateMany({
    where: { conversationId: conv.id, senderId: otherId, readAt: null },
    data: { readAt: now, deliveredAt: now },
  });
  if (count > 0) emitToUser(otherId, 'message:read', { conversationId: conv.id, readAt: now });
  res.json({ ok: true });
});

// Faz 15: mesaj teslim garantisi. Uygulama, mesajı cihaza alıp kalıcı depoladığında bunu bildirir
// (çevrimdışı alınan mesajlar da bağlantı gelince buradan işaretlenir).
conversationsRouter.post('/conversations/:id/delivered', async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(req.params.id, me);
  const { ids } = z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body);
  const deliveredAt = new Date();
  const { count } = await prisma.message.updateMany({
    where: { id: { in: ids }, conversationId: conv.id, senderId: otherId, deliveredAt: null },
    data: { deliveredAt },
  });
  if (count > 0) emitToUser(otherId, 'message:delivered', { conversationId: conv.id, ids, deliveredAt });
  res.json({ ok: true });
});

async function deliver(conversationId: string, me: string, otherId: string, data: { kind: string; body: string; photoPath?: string; flag?: string }) {
  // Alıcı şu an bağlıysa mesaj anında teslim edilmiş sayılır (soket olayı ulaşır); değilse
  // çevrimdışı kuyruktan gelen /delivered çağrısı ya da "okundu" bunu sonradan işaretler.
  const deliveredAt = (await isOnline(otherId)) ? new Date() : null;
  const message = await prisma.message.create({ data: { conversationId, senderId: me, deliveredAt, ...data } });
  const dto = messageDto(message);
  emitToUser(otherId, 'message:new', dto);
  void notify(otherId, 'message', me, data.kind === 'photo' ? '📷' : data.body.slice(0, 120), { conversationId });
  await recordFunnelStage(me, 'FIRST_MESSAGE').catch(() => {});
  // Faz 17: "Sosyal cesaret yolculuğu" — İletişim izi
  await unlockMilestone(me, 'first_message');
  const [first, senders] = await Promise.all([
    prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.message.findMany({ where: { conversationId }, distinct: ['senderId'], select: { senderId: true } }),
  ]);
  if (first && senders.length === 2 && Date.now() - first.createdAt.getTime() >= 7 * 86_400_000) {
    await unlockMilestone(me, 'week_long_chat');
    await unlockMilestone(otherId, 'week_long_chat');
  }
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

// Faz 17: sohbet içi buz kırıcı mini oyunlar ("2 doğru 1 yalan", "bu mu o mu"). Mesajlardan ayrı
// bir tabloda (IcebreakerGame): "2 doğru 1 yalan"da hangi ifadenin yalan olduğu, cevaplayan tahmin
// edene kadar sadece başlatana döner — Message'ın aksine burada tarafa göre maskelenmiş veri var.
function icebreakerDto(g: IcebreakerGame, viewerId: string) {
  const revealed = g.answeredAt !== null || g.starterId === viewerId;
  return {
    id: g.id,
    conversationId: g.conversationId,
    kind: g.kind,
    starterId: g.starterId,
    promptId: g.promptId,
    statements: g.statements,
    lieIndex: revealed ? g.lieIndex : null,
    starterChoice: g.starterChoice,
    responderId: g.responderId,
    responderChoice: g.responderChoice,
    answeredAt: g.answeredAt,
    createdAt: g.createdAt,
  };
}

const startIcebreakerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('this_or_that'), promptId: z.enum(THIS_OR_THAT_PROMPTS), choice: z.enum(['a', 'b']) }),
  z.object({
    kind: z.literal('two_truths'),
    statements: z.array(z.string().trim().min(1).max(200)).length(3),
    lieIndex: z.number().int().min(0).max(2),
  }),
]);

conversationsRouter.post('/conversations/:id/icebreaker', requireNotRestricted, messageLimiter, async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
  if (await isBlockedEitherWay(me, otherId)) throw new HttpError(403, 'blocked');
  const body = startIcebreakerSchema.parse(req.body);
  // Serbest metin (2 doğru 1 yalan) iletişim bilgisi içeremez — normal mesajdan farklı olarak
  // burada uyarmak yerine doğrudan reddedilir (oyun içeriği, bir uyarı akışı yok)
  if (body.kind === 'two_truths' && body.statements.some((s) => contactInfo(s).length > 0)) {
    throw new HttpError(400, 'validation');
  }
  const game = await prisma.icebreakerGame.create({
    data:
      body.kind === 'this_or_that'
        ? { conversationId: conv.id, starterId: me, kind: 'this_or_that', promptId: body.promptId, starterChoice: body.choice }
        : { conversationId: conv.id, starterId: me, kind: 'two_truths', statements: body.statements, lieIndex: body.lieIndex },
  });
  const dto = icebreakerDto(game, otherId);
  emitToUser(otherId, 'icebreaker:new', dto);
  void notify(otherId, 'message', me, '🎲', { conversationId: conv.id });
  res.status(201).json(icebreakerDto(game, me));
});

conversationsRouter.get('/conversations/:id/icebreaker', async (req, res) => {
  const me = uid(req);
  const { conv } = await getOwnConversation(String(req.params.id), me);
  const games = await prisma.icebreakerGame.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: 'asc' } });
  res.json(games.map((g) => icebreakerDto(g, me)));
});

conversationsRouter.post('/conversations/:id/icebreaker/:gameId/answer', requireNotRestricted, async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
  const game = await prisma.icebreakerGame.findUnique({ where: { id: String(req.params.gameId) } });
  if (!game || game.conversationId !== conv.id) throw new HttpError(404, 'not_found');
  if (game.starterId === me) throw new HttpError(400, 'validation');
  if (game.answeredAt) throw new HttpError(400, 'validation');
  const { choice } = z.object({ choice: z.string() }).parse(req.body);
  if (game.kind === 'this_or_that' && !['a', 'b'].includes(choice)) throw new HttpError(400, 'validation');
  if (game.kind === 'two_truths' && !['0', '1', '2'].includes(choice)) throw new HttpError(400, 'validation');

  const updated = await prisma.icebreakerGame.update({
    where: { id: game.id },
    data: { responderId: me, responderChoice: choice, answeredAt: new Date() },
  });
  // Faz 17: "Sosyal cesaret yolculuğu" — İletişim izi, altın kademe (bir tur tamamlanınca her iki tarafta da)
  await unlockMilestone(game.starterId, 'first_icebreaker');
  await unlockMilestone(me, 'first_icebreaker');
  emitToUser(otherId, 'icebreaker:answered', icebreakerDto(updated, otherId));
  res.json(icebreakerDto(updated, me));
});

// Faz 17 madde 5: sohbet içi iki kişilik XOX. Sembolik veri (kimin ne yazdığı yok, sadece tahta) —
// buz kırıcı oyunların aksine taraf başına maskeleme gerekmiyor, tek bir DTO her iki tarafa da gider.
const TICTACTOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

function ticTacToeWinner(board: readonly (string | null)[]): string | null {
  for (const [a, b, c] of TICTACTOE_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function ticTacToeDto(g: TicTacToeGame) {
  return {
    id: g.id,
    conversationId: g.conversationId,
    starterId: g.starterId,
    board: g.board,
    turnUserId: g.turnUserId,
    status: g.status,
    winnerId: g.winnerId,
    createdAt: g.createdAt,
  };
}

conversationsRouter.post('/conversations/:id/tictactoe', requireNotRestricted, messageLimiter, async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
  if (await isBlockedEitherWay(me, otherId)) throw new HttpError(403, 'blocked');
  // Sohbette aynı anda en fazla bir açık oyun olabilir
  const active = await prisma.ticTacToeGame.findFirst({ where: { conversationId: conv.id, status: 'active' } });
  if (active) throw new HttpError(400, 'validation');
  const game = await prisma.ticTacToeGame.create({
    data: { conversationId: conv.id, starterId: me, turnUserId: me, board: Array(9).fill(null) },
  });
  const dto = ticTacToeDto(game);
  emitToUser(otherId, 'tictactoe:new', dto);
  void notify(otherId, 'message', me, '⭕', { conversationId: conv.id });
  res.status(201).json(dto);
});

conversationsRouter.get('/conversations/:id/tictactoe', async (req, res) => {
  const me = uid(req);
  const { conv } = await getOwnConversation(String(req.params.id), me);
  const games = await prisma.ticTacToeGame.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: 'asc' } });
  res.json(games.map(ticTacToeDto));
});

conversationsRouter.post('/conversations/:id/tictactoe/:gameId/move', requireNotRestricted, async (req, res) => {
  const me = uid(req);
  const { conv, otherId } = await getOwnConversation(String(req.params.id), me);
  const game = await prisma.ticTacToeGame.findUnique({ where: { id: String(req.params.gameId) } });
  if (!game || game.conversationId !== conv.id) throw new HttpError(404, 'not_found');
  if (game.status !== 'active' || game.turnUserId !== me) throw new HttpError(400, 'validation');
  const { position } = z.object({ position: z.number().int().min(0).max(8) }).parse(req.body);
  const board = [...(game.board as (string | null)[])];
  if (board[position] !== null) throw new HttpError(400, 'validation');
  board[position] = game.starterId === me ? 'X' : 'O';
  const winMark = ticTacToeWinner(board);
  const draw = !winMark && board.every((c) => c !== null);
  const updated = await prisma.ticTacToeGame.update({
    where: { id: game.id },
    data: {
      board,
      status: winMark ? 'won' : draw ? 'draw' : 'active',
      winnerId: winMark ? me : null,
      turnUserId: winMark || draw ? game.turnUserId : otherId,
    },
  });
  const dto = ticTacToeDto(updated);
  emitToUser(otherId, 'tictactoe:move', dto);
  res.json(dto);
});
