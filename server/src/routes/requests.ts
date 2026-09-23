import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { economy, REQUEST_KINDS } from '../config';
import { HttpError, isBlockedEitherWay, orderedPair, prisma } from '../db';
import { requestLimiter } from '../limits';
import { notify } from '../notify';
import { emitToUser } from '../realtime';
import { closeRequest, expireStaleRequests } from '../requestService';
import { addEntry, getBalance } from '../wallet';
import { publicProfile } from './profile';

export const requestsRouter = Router();

requestsRouter.post('/requests', requestLimiter, async (req, res) => {
  const { toId, kind, note } = z
    .object({ toId: z.string(), kind: z.enum(REQUEST_KINDS), note: z.string().trim().max(500).default('') })
    .parse(req.body);
  const me = uid(req);

  if (toId === me) throw new HttpError(400, 'invalid_target');
  const target = await prisma.user.findUnique({ where: { id: toId }, include: { profile: true } });
  if (!target?.profile || target.bannedAt || (await isBlockedEitherWay(me, toId))) throw new HttpError(404, 'not_found');

  if (kind === 'MESSAGE') {
    if (!note) throw new HttpError(400, 'note_required');
    const [userAId, userBId] = orderedPair(me, toId);
    const conv = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
    if (conv) throw new HttpError(409, 'already_in_conversation');
  }

  const price = economy.requestPrices[kind];
  const expiresAt = new Date(Date.now() + economy.requestTtlHours * 3600_000);

  const request = await prisma.$transaction(async (tx) => {
    const pending = await tx.contactRequest.findFirst({ where: { fromId: me, toId, kind, status: 'PENDING' } });
    if (pending) throw new HttpError(409, 'request_already_pending');
    if ((await getBalance(me, tx)) < price) throw new HttpError(402, 'insufficient_balance');

    const r = await tx.contactRequest.create({ data: { fromId: me, toId, kind, price, note, expiresAt } });
    // Jeton bloke: gönderenden düşülür, kabulde alıcıya geçer, redde iade edilir
    await addEntry(tx, { userId: me, amount: -price, type: 'HOLD', requestId: r.id });
    return r;
  });

  emitToUser(toId, 'request:new', { id: request.id, kind, fromId: me });
  void notify(toId, 'request', me, kind);
  res.status(201).json(request);
});

requestsRouter.get('/requests', async (req, res) => {
  await expireStaleRequests();
  const { box } = z.object({ box: z.enum(['inbox', 'outbox']).default('inbox') }).parse(req.query);
  const me = uid(req);
  const requests = await prisma.contactRequest.findMany({
    where: box === 'inbox' ? { toId: me } : { fromId: me },
    include: {
      from: { include: { profile: true, photos: true } },
      to: { include: { profile: true, photos: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(
    requests.map(({ from, to, ...r }) => ({
      ...r,
      user: publicProfile(box === 'inbox' ? from : to),
    })),
  );
});

requestsRouter.post('/requests/:id/accept', async (req, res) => {
  const me = uid(req);
  const id = req.params.id;

  const result = await prisma.$transaction(async (tx) => {
    const r = await tx.contactRequest.findUnique({ where: { id } });
    if (!r || r.toId !== me) throw new HttpError(404, 'not_found');
    if (r.expiresAt <= new Date()) throw new HttpError(410, 'request_expired');

    const { count } = await tx.contactRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    if (count !== 1) throw new HttpError(409, 'request_not_pending');

    // Kesinti yok: bloke edilen jetonun tamamı alıcıya geçer
    await addEntry(tx, { userId: me, amount: r.price, type: 'EARN', requestId: id });

    let conversationId: string | null = null;
    if (r.kind === 'MESSAGE') {
      const [userAId, userBId] = orderedPair(r.fromId, r.toId);
      const conv = await tx.conversation.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        create: { userAId, userBId, origin: 'REQUEST' },
        update: {},
      });
      await tx.message.create({ data: { conversationId: conv.id, senderId: r.fromId, kind: 'text', body: r.note } });
      conversationId = conv.id;
    }
    return { request: r, conversationId };
  });

  emitToUser(result.request.fromId, 'request:updated', {
    id,
    status: 'ACCEPTED',
    conversationId: result.conversationId,
  });
  res.json({ ok: true, conversationId: result.conversationId });
});

requestsRouter.post('/requests/:id/reject', async (req, res) => {
  const r = await prisma.contactRequest.findUnique({ where: { id: req.params.id } });
  if (!r || r.toId !== uid(req)) throw new HttpError(404, 'not_found');
  await closeRequest(r.id, 'REJECTED');
  res.json({ ok: true });
});

requestsRouter.post('/requests/:id/cancel', async (req, res) => {
  const r = await prisma.contactRequest.findUnique({ where: { id: req.params.id } });
  if (!r || r.fromId !== uid(req)) throw new HttpError(404, 'not_found');
  await closeRequest(r.id, 'CANCELLED');
  res.json({ ok: true });
});
