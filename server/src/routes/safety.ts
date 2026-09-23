import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError, prisma } from '../db';
import { reportLimiter } from '../limits';

export const safetyRouter = Router();

safetyRouter.post('/blocks', async (req, res) => {
  const { toId } = z.object({ toId: z.string() }).parse(req.body);
  const me = uid(req);
  if (toId === me) throw new HttpError(400, 'invalid_target');
  await prisma.block.upsert({
    where: { fromId_toId: { fromId: me, toId } },
    create: { fromId: me, toId },
    update: {},
  });
  res.json({ ok: true });
});

safetyRouter.delete('/blocks/:toId', async (req, res) => {
  await prisma.block.deleteMany({ where: { fromId: uid(req), toId: req.params.toId } });
  res.json({ ok: true });
});

safetyRouter.post('/reports', reportLimiter, async (req, res) => {
  const data = z
    .object({
      toId: z.string(),
      reason: z.enum(['fake_profile', 'inappropriate_content', 'harassment', 'scam', 'underage', 'other']),
      details: z.string().max(1000).default(''),
    })
    .parse(req.body);
  const me = uid(req);
  if (data.toId === me) throw new HttpError(400, 'invalid_target');
  await prisma.report.create({ data: { fromId: me, ...data } });
  res.status(201).json({ ok: true });
});
