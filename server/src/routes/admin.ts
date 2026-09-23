import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { HttpError, prisma } from '../db';
import { disconnectUser } from '../realtime';
import { closePayout, markPayoutPaid } from '../payouts';
import { closeAllPendingFor } from '../requestService';
import { getCashable } from '../wallet';

// Yönetim paneli API'si (/admin/api). requireAuth + requireAdmin ile korunur.
export const adminRouter = Router();

const photoUrl = (p: { path: string }) => `/uploads/${p.path}`;

const userSummary = {
  select: {
    id: true,
    email: true,
    createdAt: true,
    bannedAt: true,
    banReason: true,
    emailVerifiedAt: true,
    verificationStatus: true,
    profile: { select: { displayName: true, birthDate: true, city: true, country: true, bio: true } },
    photos: { select: { id: true, path: true, position: true }, orderBy: { position: 'asc' as const } },
    _count: { select: { reportsAgainst: true } },
  },
};

type SummaryUser = Awaited<ReturnType<typeof loadUser>>;
const loadUser = (id: string) => prisma.user.findUniqueOrThrow({ where: { id }, ...userSummary });

function shapeUser(u: NonNullable<SummaryUser>) {
  return {
    id: u.id,
    email: u.email,
    createdAt: u.createdAt,
    banned: u.bannedAt !== null,
    banReason: u.banReason,
    emailVerified: u.emailVerifiedAt !== null,
    verificationStatus: u.verificationStatus,
    displayName: u.profile?.displayName ?? '',
    city: u.profile?.city ?? '',
    bio: u.profile?.bio ?? '',
    photos: u.photos.map((p) => ({ id: p.id, url: photoUrl(p) })),
    reportCount: u._count.reportsAgainst,
  };
}

// Yasakla: oturumları kapat, bekleyen istekleri iade et, keşfetten gizle
async function banUser(userId: string, reason: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: new Date(), banReason: reason, tokenVersion: { increment: 1 } },
  });
  await closeAllPendingFor(userId);
  disconnectUser(userId);
}

adminRouter.get('/me', (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get('/stats', async (_req, res) => {
  // Gerçek gelir: iade edilmemiş, test (sandbox/dev) olmayan mağaza satışları
  const realSale = { status: 'COMPLETED', sandbox: false, store: { not: 'dev' } };
  const [users, verifiedEmail, banned, openReports, pendingVerifications, verified, purchased, earned, sales, refunds, spent, calls, liveCalls, payoutsPending, payoutsPaid, openErrors] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      prisma.user.count({ where: { bannedAt: { not: null } } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { verificationStatus: 'approved' } }),
      prisma.walletEntry.aggregate({ where: { type: 'PURCHASE' }, _sum: { amount: true } }),
      prisma.walletEntry.aggregate({ where: { type: 'EARN' }, _sum: { amount: true } }),
      prisma.purchase.aggregate({ where: realSale, _count: true, _sum: { priceUsd: true } }),
      prisma.purchase.count({ where: { status: 'REFUNDED' } }),
      prisma.walletEntry.aggregate({ where: { type: 'SPEND' }, _sum: { amount: true } }),
      prisma.call.aggregate({ where: { status: 'ENDED' }, _count: true, _sum: { billedMinutes: true, totalCoins: true, giftCoins: true } }),
      prisma.call.count({ where: { status: 'ACTIVE' } }),
      prisma.payout.aggregate({ where: { status: 'PENDING' }, _count: true, _sum: { usd: true } }),
      prisma.payout.aggregate({ where: { status: 'PAID' }, _count: true, _sum: { usd: true } }),
      prisma.errorLog.count({ where: { resolvedAt: null } }),
    ]);
  res.json({
    users,
    verifiedEmail,
    banned,
    openReports,
    pendingVerifications,
    verified,
    coinsPurchased: purchased._sum.amount ?? 0,
    coinsEarned: earned._sum.amount ?? 0,
    // Özellik harcamaları (süper beğeni, öne çıkarma, beğenenler): kimseye geçmeyen jeton
    coinsSpentOnFeatures: -(spent._sum.amount ?? 0),
    sales: sales._count,
    revenueUsd: +(sales._sum.priceUsd ?? 0).toFixed(2),
    refunds,
    calls: calls._count,
    liveCalls,
    callMinutes: calls._sum.billedMinutes ?? 0,
    callCoins: calls._sum.totalCoins ?? 0,
    giftCoins: calls._sum.giftCoins ?? 0,
    payoutsPending: payoutsPending._count,
    payoutsPendingUsd: +(payoutsPending._sum.usd ?? 0).toFixed(2),
    payoutsPaidUsd: +(payoutsPaid._sum.usd ?? 0).toFixed(2),
    openErrors,
  });
});

// Para çekme talepleri: ödemeyi yapan yönetici, hesap bilgisinin tamamını görür
adminRouter.get('/payouts', async (req, res) => {
  const status = z.enum(['PENDING', 'PAID', 'REJECTED', 'CANCELLED']).default('PENDING').parse(req.query.status);
  const list = await prisma.payout.findMany({
    where: { status },
    orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          bannedAt: true,
          verificationStatus: true,
          createdAt: true,
          profile: { select: { displayName: true } },
          _count: { select: { reportsAgainst: true } },
        },
      },
    },
  });
  res.json(
    await Promise.all(
      list.map(async (p) => ({
        id: p.id,
        coins: p.coins,
        usd: p.usd,
        method: p.method,
        accountName: p.accountName,
        accountValue: p.accountValue,
        email: p.email,
        status: p.status,
        reference: p.reference,
        adminNote: p.adminNote,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
        user: p.user && {
          id: p.user.id,
          displayName: p.user.profile?.displayName ?? '',
          banned: p.user.bannedAt !== null,
          verified: p.user.verificationStatus === 'approved',
          memberSince: p.user.createdAt,
          reportCount: p.user._count.reportsAgainst,
          // Talep sonrası kalan bozdurulabilir bakiye (tutarlılık kontrolü için)
          cashableLeft: await getCashable(p.user.id),
        },
      })),
    ),
  );
});

adminRouter.post('/payouts/:id/pay', async (req, res) => {
  const { reference } = z.object({ reference: z.string().trim().min(3).max(100) }).parse(req.body);
  res.json(await markPayoutPaid(req.params.id, reference));
});

adminRouter.post('/payouts/:id/reject', async (req, res) => {
  const { note } = z.object({ note: z.string().trim().min(3).max(300) }).parse(req.body);
  res.json(await closePayout(req.params.id, 'REJECTED', note));
});

// Hata takibi
adminRouter.get('/errors', async (req, res) => {
  const resolved = req.query.resolved === '1';
  const list = await prisma.errorLog.findMany({
    where: { resolvedAt: resolved ? { not: null } : null },
    orderBy: { lastSeen: 'desc' },
    take: 100,
  });
  res.json(list);
});

adminRouter.post('/errors/:id/resolve', async (req, res) => {
  await prisma.errorLog.update({ where: { id: req.params.id }, data: { resolvedAt: new Date() } });
  res.json({ ok: true });
});

adminRouter.get('/purchases', async (_req, res) => {
  const list = await prisma.purchase.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
  });
  res.json(
    list.map((p) => ({
      id: p.id,
      store: p.store,
      productId: p.productId,
      coins: p.coins,
      bonusCoins: p.bonusCoins,
      priceUsd: p.priceUsd,
      currency: p.currency,
      sandbox: p.sandbox,
      status: p.status,
      createdAt: p.createdAt,
      user: { email: p.user.email, displayName: p.user.profile?.displayName ?? '' },
    })),
  );
});

adminRouter.get('/reports', async (req, res) => {
  const { status } = z.object({ status: z.enum(['OPEN', 'RESOLVED']).default('OPEN') }).parse(req.query);
  const reports = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: status === 'OPEN' ? 'asc' : 'desc' },
    take: 100,
    include: { from: userSummary, to: userSummary },
  });
  res.json(
    reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      resolution: r.resolution,
      createdAt: r.createdAt,
      from: shapeUser(r.from),
      to: shapeUser(r.to),
    })),
  );
});

// Şikayeti kapat: yoksay veya kullanıcıyı yasakla. Aynı kişiye ait diğer açık şikayetler de kapanır.
adminRouter.post('/reports/:id/resolve', async (req, res) => {
  const { action, reason } = z
    .object({ action: z.enum(['dismiss', 'ban']), reason: z.string().max(200).default('') })
    .parse(req.body);
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) throw new HttpError(404, 'not_found');

  if (action === 'ban') {
    await banUser(report.toId, reason || report.reason);
    await prisma.report.updateMany({
      where: { toId: report.toId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolution: 'banned', resolvedAt: new Date() },
    });
  } else {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: 'RESOLVED', resolution: 'dismissed', resolvedAt: new Date() },
    });
  }
  res.json({ ok: true });
});

// Uygunsuz fotoğrafı kaldır (isteğe bağlı olarak ilgili şikayeti kapatır)
adminRouter.delete('/photos/:id', async (req, res) => {
  const { reportId } = z.object({ reportId: z.string().optional() }).parse(req.query);
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) throw new HttpError(404, 'not_found');
  await prisma.photo.delete({ where: { id: photo.id } });
  fs.rmSync(path.join(config.uploadDir, photo.path), { force: true });
  if (reportId) {
    await prisma.report.updateMany({
      where: { id: reportId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolution: 'photo_removed', resolvedAt: new Date() },
    });
  }
  res.json({ ok: true });
});

adminRouter.get('/verifications', async (req, res) => {
  const { status } = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }).parse(req.query);
  const list = await prisma.verificationRequest.findMany({
    where: { status },
    orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    take: 100,
    include: { user: userSummary },
  });
  res.json(list.map((v) => ({ id: v.id, pose: v.pose, status: v.status, note: v.note, createdAt: v.createdAt, user: shapeUser(v.user) })));
});

// Selfie sadece yöneticiye, yetkili istekle sunulur (herkese açık klasörde değil)
adminRouter.get('/verifications/:id/selfie', async (req, res) => {
  const v = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
  if (!v) throw new HttpError(404, 'not_found');
  res.sendFile(path.resolve(config.privateUploadDir, v.selfiePath));
});

adminRouter.post('/verifications/:id/:decision', async (req, res) => {
  const { decision } = z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.params);
  const { note } = z.object({ note: z.string().max(200).default('') }).parse(req.body ?? {});
  const v = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
  if (!v || v.status !== 'PENDING') throw new HttpError(404, 'not_found');
  const approved = decision === 'approve';
  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id: v.id },
      data: { status: approved ? 'APPROVED' : 'REJECTED', note, reviewedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: v.userId },
      data: { verificationStatus: approved ? 'approved' : 'rejected', verifiedAt: approved ? new Date() : null },
    }),
  ]);
  res.json({ ok: true });
});

adminRouter.get('/users', async (req, res) => {
  const { q } = z.object({ q: z.string().trim().default('') }).parse(req.query);
  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ email: { contains: q.toLowerCase() } }, { profile: { displayName: { contains: q } } }] }
      : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
    ...userSummary,
  });
  res.json(users.map(shapeUser));
});

adminRouter.post('/users/:id/ban', async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(200).default('') }).parse(req.body ?? {});
  await loadUser(req.params.id).catch(() => {
    throw new HttpError(404, 'not_found');
  });
  await banUser(req.params.id, reason);
  res.json({ ok: true });
});

adminRouter.post('/users/:id/unban', async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { bannedAt: null, banReason: '' } });
  res.json({ ok: true });
});
