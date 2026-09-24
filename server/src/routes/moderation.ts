import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError, prisma } from '../db';
import { reportLimiter } from '../limits';
import { createAppeal, readAppealToken, sanctionDto } from '../moderation/sanctions';

// Kullanıcı tarafı: aldığı yaptırımlar ve itirazlar
export const moderationRouter = Router();

moderationRouter.get('/me/sanctions', async (req, res) => {
  const list = await prisma.sanction.findMany({
    where: { userId: uid(req) },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { appeal: { select: { status: true, answer: true } } },
  });
  res.json(list.map(sanctionDto));
});

// Kullanıcı bildirimi gördü (uygulama bir daha göstermez)
moderationRouter.post('/me/sanctions/:id/seen', async (req, res) => {
  await prisma.sanction.updateMany({ where: { id: req.params.id, userId: uid(req), seenAt: null }, data: { seenAt: new Date() } });
  res.json({ ok: true });
});

const appealBody = z.object({ sanctionId: z.string(), message: z.string().trim().min(10).max(2000) });

moderationRouter.post('/me/appeals', reportLimiter, async (req, res) => {
  const { sanctionId, message } = appealBody.parse(req.body);
  const a = await createAppeal(uid(req), sanctionId, message);
  res.status(201).json({ id: a.id, status: a.status });
});

// Yasaklı kullanıcı giriş yapamadığı için: girişte verilen kısa ömürlü itiraz anahtarıyla
export const publicAppealRouter = Router();

publicAppealRouter.post('/', reportLimiter, async (req, res) => {
  const { appealToken, message } = z.object({ appealToken: z.string().min(10).max(2000), message: appealBody.shape.message }).parse(req.body);
  const { userId, sanctionId } = readAppealToken(appealToken);
  const s = await prisma.sanction.findUnique({ where: { id: sanctionId } });
  if (!s || s.level !== 'ban') throw new HttpError(404, 'not_found');
  const a = await createAppeal(userId, sanctionId, message);
  res.status(201).json({ id: a.id, status: a.status });
});
