import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth';
import { adminEmailOf, audit } from '../audit';
import { HttpError, prisma } from '../db';
import { photoUrls, removeProfilePhoto } from '../images';
import { sendMail } from '../mailer';
import { REPORT_REASONS } from '../moderation/reports';
import { LEVELS, applySanction, nextLevel, revokeSanction, sanctionDto } from '../moderation/sanctions';
import { trafficCsv, verifyTrafficChain } from '../moderation/traffic';

// Moderasyon (/admin/api/moderation): öncelikli kuyruk, yaptırımlar, itirazlar, kullanıcı geçmişi (moderatör);
// resmi talepler ve 5651 trafik kaydı dışa aktarımı (süper yönetici)
export const adminModerationRouter = Router();
const MOD = requireRole('moderator');
const SUPER = requireRole();

const HOUR = 3_600_000;
const ageHours = (d: Date) => +((Date.now() - d.getTime()) / HOUR).toFixed(1);
const userBrief = {
  select: {
    id: true,
    email: true,
    bannedAt: true,
    restrictedUntil: true,
    profile: { select: { displayName: true } },
    photos: { select: { id: true, path: true, hiddenAt: true }, orderBy: { position: 'asc' as const } },
  },
} as const;
type Brief = {
  id: string;
  email: string;
  bannedAt: Date | null;
  restrictedUntil: Date | null;
  profile: { displayName: string } | null;
  photos: { id: string; path: string; hiddenAt: Date | null }[];
};
const brief = (u: Brief | null) =>
  u && {
    id: u.id,
    email: u.email,
    displayName: u.profile?.displayName ?? '',
    banned: u.bannedAt !== null,
    restrictedUntil: u.restrictedUntil && u.restrictedUntil > new Date() ? u.restrictedUntil : null,
    photos: u.photos.map((p) => ({ id: p.id, url: photoUrls(p.path).thumbUrl, hidden: p.hiddenAt !== null })),
  };

// ---------- Öncelikli kuyruk: şikayetler + otomatik işaretler + itirazlar
adminModerationRouter.get('/queue', MOD, async (_req, res) => {
  const [reports, flags, appeals] = await Promise.all([
    prisma.report.findMany({ where: { status: 'OPEN' }, include: { from: userBrief, to: userBrief }, take: 200 }),
    prisma.moderationFlag.findMany({ where: { status: 'OPEN' }, include: { user: userBrief }, take: 200 }),
    prisma.appeal.findMany({ where: { status: 'OPEN' }, include: { sanction: true, user: userBrief }, take: 200 }),
  ]);
  // İşarete konu fotoğraf / mesaj
  const photoIds = flags.filter((f) => f.kind === 'photo_suspicious').map((f) => f.refId);
  const msgIds = flags.filter((f) => f.kind !== 'photo_suspicious' && f.refId).map((f) => f.refId);
  const [photos, messages] = await Promise.all([
    prisma.photo.findMany({ where: { id: { in: photoIds } } }),
    prisma.message.findMany({ where: { id: { in: msgIds } }, select: { id: true, body: true, createdAt: true } }),
  ]);
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const msgById = new Map(messages.map((m) => [m.id, m]));

  const items = [
    ...reports.map((r) => ({
      type: 'report' as const,
      id: r.id,
      priority: r.priority,
      createdAt: r.createdAt,
      ageHours: ageHours(r.createdAt),
      reason: r.reason,
      details: r.details,
      user: brief(r.to),
      reporter: brief(r.from),
    })),
    ...flags.map((f) => {
      const photo = photoById.get(f.refId);
      const msg = msgById.get(f.refId);
      return {
        type: 'flag' as const,
        id: f.id,
        priority: f.priority,
        createdAt: f.createdAt,
        ageHours: ageHours(f.createdAt),
        kind: f.kind,
        details: f.details,
        user: brief(f.user),
        photo: photo ? { id: photo.id, url: photoUrls(photo.path).url, hidden: photo.hiddenAt !== null } : null,
        message: msg ? { body: msg.body, createdAt: msg.createdAt } : null,
      };
    }),
    ...appeals.map((a) => ({
      type: 'appeal' as const,
      id: a.id,
      priority: 2,
      createdAt: a.createdAt,
      ageHours: ageHours(a.createdAt),
      message: a.message,
      sanction: sanctionDto({ ...a.sanction, appeal: null }),
      user: brief(a.user),
    })),
  ].sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());

  // İşlem süresi: son 7 günde kapatılanların ortalaması (saat)
  const since = new Date(Date.now() - 7 * 24 * HOUR);
  const [doneReports, doneFlags] = await Promise.all([
    prisma.report.findMany({ where: { resolvedAt: { gt: since } }, select: { createdAt: true, resolvedAt: true } }),
    prisma.moderationFlag.findMany({ where: { resolvedAt: { gt: since } }, select: { createdAt: true, resolvedAt: true } }),
  ]);
  const done = [...doneReports, ...doneFlags];
  const avg = done.length ? done.reduce((s, d) => s + (d.resolvedAt!.getTime() - d.createdAt.getTime()), 0) / done.length / HOUR : 0;
  res.json({
    items,
    stats: {
      open: items.length,
      urgent: items.filter((i) => i.priority === 1).length,
      oldestHours: items.reduce((m, i) => Math.max(m, i.ageHours), 0),
      avgResolutionHours7d: +avg.toFixed(1),
      resolved7d: done.length,
    },
  });
});

// ---------- Otomatik işareti kapat
adminModerationRouter.post('/flags/:id/resolve', MOD, async (req, res) => {
  const q = z
    .object({
      action: z.enum(['dismiss', 'approve_photo', 'remove_photo', 'sanction']),
      level: z.enum(LEVELS).optional(),
      reason: z.enum([...REPORT_REASONS, 'spam']).default('other'),
      note: z.string().max(500).default(''),
    })
    .parse(req.body);
  const flag = await prisma.moderationFlag.findUnique({ where: { id: req.params.id } });
  if (!flag) throw new HttpError(404, 'not_found');
  if (flag.status !== 'OPEN') throw new HttpError(409, 'already_resolved');
  const by = await adminEmailOf(req);

  const photo = flag.kind === 'photo_suspicious' ? await prisma.photo.findUnique({ where: { id: flag.refId } }) : null;
  let resolution: string = q.action;
  if (q.action === 'approve_photo' && photo) {
    await prisma.photo.update({ where: { id: photo.id }, data: { hiddenAt: null } });
    resolution = 'photo_approved';
  } else if (q.action === 'remove_photo' && photo) {
    await prisma.photo.delete({ where: { id: photo.id } });
    await removeProfilePhoto(photo.path);
    resolution = 'photo_removed';
  } else if (q.action === 'sanction') {
    // Fotoğraf da kaldırılır (varsa)
    if (photo) {
      await prisma.photo.delete({ where: { id: photo.id } });
      await removeProfilePhoto(photo.path);
    }
    await applySanction({ userId: flag.userId, level: q.level, reason: q.reason, note: q.note, source: `flag:${flag.id}`, createdBy: by });
    resolution = 'sanctioned';
  } else {
    resolution = 'dismissed';
  }
  await prisma.moderationFlag.update({ where: { id: flag.id }, data: { status: 'RESOLVED', resolution, resolvedBy: by, resolvedAt: new Date() } });
  await audit(req, `flag.${resolution}`, 'user', flag.userId, { flagId: flag.id, kind: flag.kind, level: q.level ?? '' });
  res.json({ ok: true, resolution });
});

// ---------- Doğrudan yaptırım (basamak verilmezse sıradaki)
adminModerationRouter.post('/users/:id/sanction', MOD, async (req, res) => {
  const q = z
    .object({ level: z.enum(LEVELS).optional(), reason: z.enum([...REPORT_REASONS, 'spam']), note: z.string().max(500).default('') })
    .parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new HttpError(404, 'not_found');
  if (user.isAdmin) throw new HttpError(400, 'cannot_sanction_staff');
  const s = await applySanction({ userId: user.id, level: q.level, reason: q.reason, note: q.note, source: 'manual', createdBy: await adminEmailOf(req) });
  await audit(req, `sanction.${s.level}`, 'user', user.id, { reason: q.reason, note: q.note });
  res.json(sanctionDto(s));
});

adminModerationRouter.post('/sanctions/:id/revoke', MOD, async (req, res) => {
  const s = await prisma.sanction.findUnique({ where: { id: req.params.id } });
  if (!s || s.revokedAt) throw new HttpError(404, 'not_found');
  await revokeSanction(s.id);
  await audit(req, 'sanction.revoke', 'user', s.userId, { sanctionId: s.id, level: s.level });
  res.json({ ok: true });
});

// ---------- Kullanıcı geçmişi: şikayetler, işaretler, yaptırımlar
adminModerationRouter.get('/users/:id/history', MOD, async (req, res) => {
  const id = req.params.id;
  const [user, against, by, flags, sanctions, next] = await Promise.all([
    prisma.user.findUnique({ where: { id }, ...userBrief }),
    prisma.report.findMany({ where: { toId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.report.count({ where: { fromId: id } }),
    prisma.moderationFlag.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.sanction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, include: { appeal: { select: { status: true, answer: true } } } }),
    nextLevel(id),
  ]);
  if (!user) throw new HttpError(404, 'not_found');
  res.json({
    user: brief(user),
    nextLevel: next,
    reportsAgainst: against.map(({ id: rid, reason, details, status, resolution, priority, createdAt }) => ({ id: rid, reason, details, status, resolution, priority, createdAt })),
    reportsFiled: by,
    flags: flags.map(({ id: fid, kind, status, resolution, createdAt }) => ({ id: fid, kind, status, resolution, createdAt })),
    sanctions: sanctions.map(sanctionDto),
  });
});

// ---------- İtirazlar
adminModerationRouter.post('/appeals/:id/decide', MOD, async (req, res) => {
  const { accept, answer } = z.object({ accept: z.boolean(), answer: z.string().trim().min(5).max(2000) }).parse(req.body);
  const a = await prisma.appeal.findUnique({ where: { id: req.params.id }, include: { user: true, sanction: true } });
  if (!a) throw new HttpError(404, 'not_found');
  if (a.status !== 'OPEN') throw new HttpError(409, 'already_answered');
  const by = await adminEmailOf(req);
  await prisma.appeal.update({ where: { id: a.id }, data: { status: accept ? 'ACCEPTED' : 'REJECTED', answer, decidedBy: by, decidedAt: new Date() } });
  if (accept) await revokeSanction(a.sanctionId);
  const tr = a.user.locale === 'tr';
  await sendMail(
    a.user.email,
    tr ? 'MeetPoint: itirazının sonucu' : 'MeetPoint: result of your appeal',
    tr
      ? `Merhaba,\n\nİtirazın ${accept ? 'kabul edildi ve yaptırım kaldırıldı' : 'incelendi ve reddedildi'}.\n\n${answer}`
      : `Hi,\n\nYour appeal was ${accept ? 'accepted and the decision was lifted' : 'reviewed and rejected'}.\n\n${answer}`,
  ).catch((e) => console.error('appeal mail', e));
  await audit(req, accept ? 'appeal.accept' : 'appeal.reject', 'user', a.userId, { appealId: a.id, sanctionId: a.sanctionId, level: a.sanction.level });
  res.json({ ok: true });
});

// ---------- Resmi talepler (5651 kaldırma, kolluk/savcılık, mahkeme kararı)
const DEFAULT_DUE_HOURS: Record<string, number> = { takedown: 24, court_order: 24, information: 72, other: 72 };

adminModerationRouter.get('/legal-requests', SUPER, async (req, res) => {
  const { status } = z.object({ status: z.enum(['OPEN', 'DONE', 'REJECTED']).default('OPEN') }).parse(req.query);
  const list = await prisma.legalRequest.findMany({ where: { status }, orderBy: status === 'OPEN' ? { dueAt: 'asc' } : { closedAt: 'desc' }, take: 100 });
  res.json(list.map((r) => ({ ...r, overdue: r.status === 'OPEN' && r.dueAt < new Date() })));
});

adminModerationRouter.post('/legal-requests', SUPER, async (req, res) => {
  const q = z
    .object({
      kind: z.enum(['takedown', 'information', 'court_order', 'other']),
      authority: z.string().trim().min(2).max(200),
      referenceNo: z.string().trim().max(100).default(''),
      description: z.string().trim().min(5).max(5000),
      subjectUsers: z.array(z.string()).max(100).default([]),
      receivedAt: z.coerce.date().default(() => new Date()),
      dueAt: z.coerce.date().optional(),
    })
    .parse(req.body);
  const r = await prisma.legalRequest.create({
    data: { ...q, dueAt: q.dueAt ?? new Date(q.receivedAt.getTime() + DEFAULT_DUE_HOURS[q.kind] * HOUR), createdBy: await adminEmailOf(req) },
  });
  await audit(req, 'legal_request.create', 'legal_request', r.id, { kind: r.kind, authority: r.authority, referenceNo: r.referenceNo });
  res.status(201).json(r);
});

adminModerationRouter.post('/legal-requests/:id/close', SUPER, async (req, res) => {
  const { status, actions } = z.object({ status: z.enum(['DONE', 'REJECTED']), actions: z.string().trim().min(5).max(5000) }).parse(req.body);
  const r = await prisma.legalRequest.findUnique({ where: { id: req.params.id } });
  if (!r) throw new HttpError(404, 'not_found');
  if (r.status !== 'OPEN') throw new HttpError(409, 'already_answered');
  await prisma.legalRequest.update({ where: { id: r.id }, data: { status, actions, handledBy: await adminEmailOf(req), closedAt: new Date() } });
  await audit(req, `legal_request.${status.toLowerCase()}`, 'legal_request', r.id, { onTime: r.dueAt >= new Date() });
  res.json({ ok: true });
});

// ---------- 5651 trafik kaydı: resmi talep için CSV (en fazla 50.000 satır) ve zincir doğrulama
adminModerationRouter.get('/traffic', SUPER, async (req, res) => {
  const q = z
    .object({
      userId: z.string().max(40).optional(),
      ip: z.string().max(64).optional(),
      from: z.coerce.date(),
      to: z.coerce.date(),
      legalRequestId: z.string().max(40).optional(),
    })
    .refine((v) => v.userId || v.ip, 'user_or_ip_required')
    .parse(req.query);
  const rows = await prisma.trafficLog.findMany({
    where: { ...(q.userId ? { userId: q.userId } : {}), ...(q.ip ? { ip: q.ip } : {}), createdAt: { gte: q.from, lte: q.to } },
    orderBy: { id: 'asc' },
    take: 50_000,
  });
  await audit(req, 'traffic.export', 'user', q.userId ?? '', { ip: q.ip ?? '', from: q.from.toISOString(), to: q.to.toISOString(), rows: rows.length, legalRequestId: q.legalRequestId ?? '' });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="trafik-${q.from.toISOString().slice(0, 10)}.csv"`);
  res.type('text/csv; charset=utf-8').send(trafficCsv(rows));
});

adminModerationRouter.get('/traffic/verify', SUPER, async (req, res) => {
  const result = await verifyTrafficChain();
  await audit(req, 'traffic.verify', '', '', { ok: result.ok, batches: result.batches });
  res.json(result);
});
