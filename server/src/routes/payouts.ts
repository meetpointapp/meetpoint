import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError, prisma } from '../db';
import { requestLimiter } from '../limits';
import { closePayout, payoutDto, requestPayout } from '../payouts';

export const payoutsRouter = Router();

payoutsRouter.get('/payouts', async (req, res) => {
  const list = await prisma.payout.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(list.map(payoutDto));
});

payoutsRouter.post('/payouts', requestLimiter, async (req, res) => {
  const input = z
    .object({
      coins: z.number().int().positive(),
      method: z.enum(['iban', 'paypal']),
      accountName: z.string().trim().max(80).default(''),
      accountValue: z.string().trim().min(5).max(80),
    })
    .refine((v) => v.method !== 'paypal' || z.email().safeParse(v.accountValue).success, { path: ['accountValue'] })
    .parse(req.body);
  res.status(201).json(await requestPayout(uid(req), input));
});

payoutsRouter.post('/payouts/:id/cancel', async (req, res) => {
  const p = await prisma.payout.findUnique({ where: { id: req.params.id } });
  if (!p || p.userId !== uid(req)) throw new HttpError(404, 'not_found');
  res.json(await closePayout(p.id, 'CANCELLED'));
});
