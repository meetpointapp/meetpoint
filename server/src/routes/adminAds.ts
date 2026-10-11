import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth';
import { audit } from '../audit';
import { HttpError, prisma } from '../db';
import { social } from '../social';

// Faz 22: dış reklam alanı — yönetim paneli. Reklamlar akışta "Sponsorlu" etiketiyle görünür.
export const adminAdsRouter = Router();
const FIN = requireRole('finance');

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => /^https:\/\/[^\s]+$/i.test(u), 'https bağlantı gerekli');

const AdBody = z.object({
  advertiser: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().max(200).default(''),
  ctaLabel: z.string().trim().max(24).default(''),
  url: httpsUrl,
  accent: z.enum(social.storyBackgrounds).default('sunset'),
  weight: z.number().int().min(1).max(10).default(1),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const dto = (a: Awaited<ReturnType<typeof prisma.ad.findFirstOrThrow>>) => ({
  ...a,
  ctr: a.impressions > 0 ? +((a.clicks / a.impressions) * 100).toFixed(2) : 0,
});

adminAdsRouter.get('/', FIN, async (_req, res) => {
  const ads = await prisma.ad.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(ads.map(dto));
});

adminAdsRouter.post('/', FIN, async (req, res) => {
  const b = AdBody.parse(req.body);
  const ad = await prisma.ad.create({
    data: { ...b, startsAt: b.startsAt ? new Date(b.startsAt) : new Date(), endsAt: b.endsAt ? new Date(b.endsAt) : null },
  });
  await audit(req, 'ad.create', 'ad', ad.id, { advertiser: ad.advertiser, title: ad.title });
  res.status(201).json(dto(ad));
});

adminAdsRouter.put('/:id', FIN, async (req, res) => {
  const b = AdBody.partial().parse(req.body);
  const exists = await prisma.ad.findUnique({ where: { id: req.params.id } });
  if (!exists) throw new HttpError(404, 'not_found');
  const ad = await prisma.ad.update({
    where: { id: exists.id },
    data: {
      ...b,
      startsAt: b.startsAt ? new Date(b.startsAt) : undefined,
      endsAt: b.endsAt === undefined ? undefined : b.endsAt ? new Date(b.endsAt) : null,
    },
  });
  await audit(req, 'ad.update', 'ad', ad.id, { active: ad.active });
  res.json(dto(ad));
});

adminAdsRouter.delete('/:id', FIN, async (req, res) => {
  const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
  if (!ad) throw new HttpError(404, 'not_found');
  await prisma.ad.delete({ where: { id: ad.id } });
  await audit(req, 'ad.delete', 'ad', ad.id, { advertiser: ad.advertiser, impressions: ad.impressions, clicks: ad.clicks });
  res.json({ ok: true });
});
