import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError, prisma } from '../db';
import { requestLimiter } from '../limits';
import { submitKyc } from '../finance/kyc';
import { getFinance } from '../finance/settings';
import { closePayout, payoutDto, requestPayout } from '../payouts';
import { requireNotRestricted } from '../moderation/sanctions';

// Kimlik belgesi fotoğrafı (en fazla 10 MB, sadece görüntü; içerik images.ts'te yeniden kodlanır)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

export const payoutsRouter = Router();

payoutsRouter.get('/payouts', async (req, res) => {
  const list = await prisma.payout.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(list.map(payoutDto));
});

payoutsRouter.post('/payouts', requireNotRestricted, requestLimiter, async (req, res) => {
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

// Kimlik doğrulama (para çekme için): ad-soyad, TC kimlik no, belge fotoğrafı
payoutsRouter.get('/me/kyc', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) }, select: { kycStatus: true, kycVerifiedAt: true } });
  const last = await prisma.kycSubmission.findFirst({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' }, select: { status: true, note: true, createdAt: true } });
  res.json({ status: user.kycStatus, verifiedAt: user.kycVerifiedAt, last });
});

payoutsRouter.post('/me/kyc', requestLimiter, upload.single('document'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'invalid_image');
  const { fullName, tcNo } = z
    .object({ fullName: z.string().trim().min(5).max(80), tcNo: z.string().trim().regex(/^\d{11}$/) })
    .parse(req.body);
  const sub = await submitKyc(uid(req), { fullName, tcNo, document: req.file.buffer });
  res.status(201).json({ id: sub.id, status: 'pending' });
});

// Yıllık kazanç dökümü: ödenen para çekmeler (brüt, stopaj, net) ve yıl içinde kazanılan jeton
payoutsRouter.get('/me/earnings', async (req, res) => {
  const { year } = z.object({ year: z.coerce.number().int().min(2024).max(2100).default(new Date().getUTCFullYear()) }).parse(req.query);
  const userId = uid(req);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const [paid, earned, s] = await Promise.all([
    prisma.payout.findMany({ where: { userId, status: 'PAID', processedAt: { gte: from, lt: to } }, orderBy: { processedAt: 'asc' } }),
    prisma.walletEntry.aggregate({ where: { userId, counterpartyId: { not: null }, earned: { gt: 0 }, createdAt: { gte: from, lt: to } }, _sum: { earned: true, reclaimedCoins: true } }),
    getFinance(),
  ]);
  const sum = (k: 'usd' | 'withholdingUsd' | 'netUsd') => +paid.reduce((a, p) => a + (k === 'netUsd' ? p.netUsd || p.usd : p[k]), 0).toFixed(2);
  res.json({
    year,
    earnedCoins: (earned._sum.earned ?? 0) - (earned._sum.reclaimedCoins ?? 0),
    payouts: paid.map(payoutDto),
    totals: { count: paid.length, grossUsd: sum('usd'), withholdingUsd: sum('withholdingUsd'), netUsd: sum('netUsd') },
    withholdingRate: s.withholdingRate,
  });
});
