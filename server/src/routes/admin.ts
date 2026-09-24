import { Router } from 'express';
import { z } from 'zod';
import { type AdminRole, requireRole, uid } from '../auth';
import { adminEmailOf, audit } from '../audit';
import { LEVELS, applySanction, revokeSanction } from '../moderation/sanctions';
import { HttpError, prisma } from '../db';
import { decryptField } from '../fieldCrypto';
import { resetMfa } from '../mfa';
import { revokeAllSessions } from '../sessions';
import { photoUrls, removeProfilePhoto } from '../images';
import { closePayout, markPayoutPaid } from '../payouts';
import { privateStore } from '../storage';
import { getCashable } from '../wallet';

// Yönetim paneli API'si (/admin/api). requireAuth + requireAdmin (2FA dahil) ile korunur.
// Roller: super (her şey), moderator (şikayet, doğrulama, kullanıcı), finance (ödeme, satış).
// Her değişiklik ve hassas veri görüntüleme işlem kaydına (AdminAudit) yazılır.
export const adminRouter = Router();


const userSummary = {
  select: {
    id: true,
    email: true,
    createdAt: true,
    bannedAt: true,
    banReason: true,
    deleteAfter: true,
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
    deleteAfter: u.deleteAfter,
    emailVerified: u.emailVerifiedAt !== null,
    verificationStatus: u.verificationStatus,
    displayName: u.profile?.displayName ?? '',
    city: u.profile?.city ?? '',
    bio: u.profile?.bio ?? '',
    photos: u.photos.map((p) => ({ id: p.id, url: photoUrls(p.path).url })),
    reportCount: u._count.reportsAgainst,
  };
}

// Yasakla (yaptırım kaydıyla): oturumlar kapanır, bekleyen istekler iade edilir, profil her yerden kalkar
const banUser = async (req: import('express').Request, userId: string, reason: string, source = 'manual') =>
  applySanction({ userId, level: 'ban', reason, source, createdBy: await adminEmailOf(req) });

const MOD: AdminRole[] = ['moderator'];
const FIN: AdminRole[] = ['finance'];

adminRouter.get('/me', (req, res) => {
  res.json({ ok: true, role: (req as import('../auth').AuthedRequest).user.adminRole });
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
  const [openDsr, overdueDsr, openFlags, openAppeals, openLegal] = await Promise.all([
    prisma.dsrRequest.count({ where: { status: 'OPEN' } }),
    prisma.dsrRequest.count({ where: { status: 'OPEN', dueAt: { lt: new Date() } } }),
    prisma.moderationFlag.count({ where: { status: 'OPEN' } }),
    prisma.appeal.count({ where: { status: 'OPEN' } }),
    prisma.legalRequest.count({ where: { status: 'OPEN' } }),
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
    openDsr,
    overdueDsr,
    // Moderasyon kuyruğu = açık şikayet + otomatik işaret + itiraz
    openModeration: openReports + openFlags + openAppeals,
    openLegal,
  });
});

// Para çekme talepleri: ödemeyi yapan yönetici, hesap bilgisinin tamamını görür
adminRouter.get('/payouts', requireRole(...FIN), async (req, res) => {
  const status = z.enum(['PENDING', 'PAID', 'REJECTED', 'CANCELLED']).default('PENDING').parse(req.query.status);
  await audit(req, 'payout.view_list', 'payout', '', { status });
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
        accountName: decryptField(p.accountName),
        accountValue: decryptField(p.accountValue),
        withholdingUsd: p.withholdingUsd,
        netUsd: p.netUsd || p.usd,
        riskFlags: p.riskFlags,
        exportedAt: p.exportedAt,
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

adminRouter.post('/payouts/:id/pay', requireRole(...FIN), async (req, res) => {
  const { reference } = z.object({ reference: z.string().trim().min(3).max(100) }).parse(req.body);
  const result = await markPayoutPaid(req.params.id, reference);
  await audit(req, 'payout.pay', 'payout', req.params.id, { reference });
  res.json(result);
});

adminRouter.post('/payouts/:id/reject', requireRole(...FIN), async (req, res) => {
  const { note } = z.object({ note: z.string().trim().min(3).max(300) }).parse(req.body);
  const result = await closePayout(req.params.id, 'REJECTED', note);
  await audit(req, 'payout.reject', 'payout', req.params.id, { note });
  res.json(result);
});

// Hata takibi
adminRouter.get('/errors', requireRole(), async (req, res) => {
  const resolved = req.query.resolved === '1';
  const list = await prisma.errorLog.findMany({
    where: { resolvedAt: resolved ? { not: null } : null },
    orderBy: { lastSeen: 'desc' },
    take: 100,
  });
  res.json(list);
});

adminRouter.post('/errors/:id/resolve', requireRole(), async (req, res) => {
  await prisma.errorLog.update({ where: { id: req.params.id }, data: { resolvedAt: new Date() } });
  await audit(req, 'error.resolve', 'error', req.params.id);
  res.json({ ok: true });
});

adminRouter.get('/purchases', requireRole(...FIN), async (_req, res) => {
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
      user: { email: p.user?.email ?? p.email, displayName: p.user?.profile?.displayName ?? '(hesap silinmiş)' },
    })),
  );
});

adminRouter.get('/reports', requireRole(...MOD), async (req, res) => {
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

// Şikayeti kapat: yoksay, kademeli yaptırım (basamak verilmezse sıradaki) veya doğrudan yasak.
// Yaptırımda aynı kişiye ait diğer açık şikayetler de kapanır.
adminRouter.post('/reports/:id/resolve', requireRole(...MOD), async (req, res) => {
  const { action, reason, level, note } = z
    .object({
      action: z.enum(['dismiss', 'ban', 'sanction']),
      reason: z.string().max(200).default(''),
      level: z.enum(LEVELS).optional(),
      note: z.string().max(500).default(''),
    })
    .parse(req.body);
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) throw new HttpError(404, 'not_found');

  if (action === 'ban' || action === 'sanction') {
    const s = await applySanction({
      userId: report.toId,
      level: action === 'ban' ? 'ban' : level,
      reason: reason || report.reason,
      note,
      source: `report:${report.id}`,
      createdBy: await adminEmailOf(req),
    });
    await prisma.report.updateMany({
      where: { toId: report.toId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolution: s.level === 'ban' ? 'banned' : 'sanctioned', resolvedAt: new Date() },
    });
  } else {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: 'RESOLVED', resolution: 'dismissed', resolvedAt: new Date() },
    });
  }
  await audit(req, `report.${action}`, 'report', report.id, { userId: report.toId, reason, level: level ?? '' });
  res.json({ ok: true });
});

// Uygunsuz fotoğrafı kaldır (isteğe bağlı olarak ilgili şikayeti kapatır)
adminRouter.delete('/photos/:id', requireRole(...MOD), async (req, res) => {
  const { reportId } = z.object({ reportId: z.string().optional() }).parse(req.query);
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) throw new HttpError(404, 'not_found');
  await prisma.photo.delete({ where: { id: photo.id } });
  await removeProfilePhoto(photo.path);
  if (reportId) {
    await prisma.report.updateMany({
      where: { id: reportId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolution: 'photo_removed', resolvedAt: new Date() },
    });
  }
  await audit(req, 'photo.remove', 'user', photo.userId, { photoId: photo.id, reportId: reportId ?? '' });
  res.json({ ok: true });
});

adminRouter.get('/verifications', requireRole(...MOD), async (req, res) => {
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
adminRouter.get('/verifications/:id/selfie', requireRole(...MOD), async (req, res) => {
  const v = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
  if (!v) throw new HttpError(404, 'not_found');
  await audit(req, 'verification.view_selfie', 'user', v.userId, { verificationId: v.id });
  const data = await privateStore.read(v.selfiePath);
  if (!data) throw new HttpError(404, 'not_found');
  res.setHeader('Cache-Control', 'no-store');
  res.type(v.selfiePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg').send(data);
});

adminRouter.post('/verifications/:id/:decision', requireRole(...MOD), async (req, res) => {
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
  await audit(req, `verification.${decision}`, 'user', v.userId, { verificationId: v.id, note });
  res.json({ ok: true });
});

adminRouter.get('/users', requireRole(...MOD, ...FIN), async (req, res) => {
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

adminRouter.post('/users/:id/ban', requireRole(...MOD), async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(200).default('') }).parse(req.body ?? {});
  await loadUser(req.params.id).catch(() => {
    throw new HttpError(404, 'not_found');
  });
  if (req.params.id === uid(req)) throw new HttpError(400, 'cannot_ban_self');
  await banUser(req, req.params.id, reason);
  await audit(req, 'user.ban', 'user', req.params.id, { reason });
  res.json({ ok: true });
});

adminRouter.post('/users/:id/unban', requireRole(...MOD), async (req, res) => {
  // Açık yasak yaptırımları kaldırılır (kayıtları kalır); eski usul yasaklar da temizlenir
  const bans = await prisma.sanction.findMany({ where: { userId: req.params.id, level: 'ban', revokedAt: null } });
  for (const b of bans) await revokeSanction(b.id);
  await prisma.user.update({ where: { id: req.params.id }, data: { bannedAt: null, banReason: '' } });
  await audit(req, 'user.unban', 'user', req.params.id);
  res.json({ ok: true });
});

// Yönetim ekibi (sadece süper yönetici)
adminRouter.get('/staff', requireRole(), async (_req, res) => {
  const staff = await prisma.user.findMany({
    where: { isAdmin: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, adminRole: true, mfaEnabledAt: true, createdAt: true },
  });
  res.json(staff.map((s) => ({ id: s.id, email: s.email, role: s.adminRole, mfaEnabled: s.mfaEnabledAt !== null, createdAt: s.createdAt })));
});

// Rol ver / değiştir / al. "none" yetkiyi kaldırır ve oturumlarını kapatır.
adminRouter.post('/staff', requireRole(), async (req, res) => {
  const { email, role } = z
    .object({ email: z.email().transform((e) => e.toLowerCase().trim()), role: z.enum(['super', 'moderator', 'finance', 'none']) })
    .parse(req.body);
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) throw new HttpError(404, 'not_found');
  if (target.id === uid(req)) throw new HttpError(400, 'cannot_change_own_role');
  const admin = role !== 'none';
  await prisma.user.update({ where: { id: target.id }, data: { isAdmin: admin, adminRole: admin ? role : '' } });
  if (!admin) await revokeAllSessions(target.id, 'staff_removed');
  await audit(req, 'staff.role', 'user', target.id, { email, from: target.adminRole, to: role });
  res.json({ ok: true });
});

// Telefonunu kaybeden ekip üyesinin 2FA'sını sıfırla (bir sonraki girişte yeniden kurar)
adminRouter.post('/staff/:id/reset-mfa', requireRole(), async (req, res) => {
  if (req.params.id === uid(req)) throw new HttpError(400, 'cannot_reset_own_mfa');
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target?.isAdmin) throw new HttpError(404, 'not_found');
  await resetMfa(target.id);
  await audit(req, 'staff.reset_mfa', 'user', target.id, { email: target.email });
  res.json({ ok: true });
});

// İşlem kaydı (sadece süper yönetici). Salt okunur.
adminRouter.get('/audit', requireRole(), async (req, res) => {
  const q = z
    .object({ action: z.string().trim().max(60).default(''), targetId: z.string().trim().max(60).default(''), before: z.iso.datetime().optional() })
    .parse(req.query);
  const list = await prisma.adminAudit.findMany({
    where: {
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.targetId ? { targetId: q.targetId } : {}),
      ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(list);
});
