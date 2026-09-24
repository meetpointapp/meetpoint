import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { privacy } from '../config';
import { HttpError, prisma } from '../db';
import { downloadLimiter, dsrLimiter } from '../limits';
import { CONSENT_KINDS, acceptLegal, consentState, legalUpdatesNeeded, recordConsent } from '../privacy/consents';
import { latestExport, requestExport, takeExport } from '../privacy/dataExport';
import { privateStore } from '../storage';

// Gizlilik ve verilerim (KVKK): rızalar, yeniden onay, veri indirme, ilgili kişi başvurusu
export const privacyRouter = Router();

privacyRouter.get('/me/consents', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  const history = await prisma.consent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { kind: true, version: true, granted: true, source: true, createdAt: true },
  });
  res.json({ ...consentState(user), legalUpdates: legalUpdatesNeeded(user), history });
});

// Rıza ver / geri al. Geri almanın sonuçları: özel nitelikli → keşfette gizlenir; yurt dışı → arama ve
// bildirim kapanır; selfie → saklanan selfie'ler silinir, bekleyen başvuru geri çekilir.
privacyRouter.put('/me/consents', async (req, res) => {
  const { kind, granted, source } = z
    .object({ kind: z.enum(CONSENT_KINDS), granted: z.boolean(), source: z.enum(['onboarding', 'settings', 'verification', 'call']).default('settings') })
    .parse(req.body);
  const userId = uid(req);
  await prisma.$transaction((tx) => recordConsent(tx, userId, kind, granted, source, String(req.ip ?? '')));

  if (kind === 'selfie' && !granted) {
    const requests = await prisma.verificationRequest.findMany({ where: { userId, selfiePath: { not: '' } } });
    for (const v of requests) await privateStore.remove(v.selfiePath).catch(() => {});
    await prisma.verificationRequest.updateMany({ where: { userId }, data: { selfiePath: '' } });
    await prisma.verificationRequest.updateMany({ where: { userId, status: 'PENDING' }, data: { status: 'REJECTED', note: 'consent_withdrawn', reviewedAt: new Date() } });
    await prisma.user.updateMany({ where: { id: userId, verificationStatus: 'pending' }, data: { verificationStatus: 'none' } });
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  res.json(consentState(user));
});

// Değişen kullanım koşulları / aydınlatma metnini onayla
privacyRouter.post('/me/consents/accept-legal', async (req, res) => {
  const userId = uid(req);
  await prisma.$transaction((tx) => acceptLegal(tx, userId, 'reconsent', String(req.ip ?? '')));
  res.json({ ok: true });
});

privacyRouter.get('/me/data-export', async (req, res) => {
  res.json({ latest: await latestExport(uid(req)) });
});

privacyRouter.post('/me/data-export', async (req, res) => {
  const x = await requestExport(uid(req));
  res.status(202).json({ status: x.status, createdAt: x.createdAt });
});

// İlgili kişi başvurusu (bilgi, düzeltme, itiraz vb.): yönetim en geç 30 günde yanıtlar
privacyRouter.post('/me/kvkk-requests', dsrLimiter, async (req, res) => {
  const { kind, message } = z
    .object({ kind: z.enum(['info', 'correction', 'deletion', 'objection', 'other']), message: z.string().trim().min(10).max(2000) })
    .parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  const r = await prisma.dsrRequest.create({
    data: {
      userId: user.id,
      email: user.email,
      kind,
      message,
      dueAt: new Date(Date.now() + privacy.dsrResponseDays * 86_400_000),
    },
  });
  res.status(201).json({ id: r.id, status: r.status, dueAt: r.dueAt });
});

privacyRouter.get('/me/kvkk-requests', async (req, res) => {
  const list = await prisma.dsrRequest.findMany({
    where: { userId: uid(req) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, kind: true, message: true, status: true, answer: true, dueAt: true, createdAt: true, answeredAt: true },
  });
  res.json(list);
});

// E-postadaki indirme bağlantısı (oturum gerekmez; bağlantının kendisi tek kullanımlık anahtardır)
export const dataExportDownloadRouter = Router();

dataExportDownloadRouter.get('/:token', downloadLimiter, async (req, res) => {
  const token = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/).safeParse(req.params.token);
  if (!token.success) throw new HttpError(404, 'export_unavailable');
  const { file, name } = await takeExport(token.data);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.type('application/zip').send(file);
});
