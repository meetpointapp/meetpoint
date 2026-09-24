import { Router } from 'express';
import { z } from 'zod';
import { authedUser, requireRole } from '../auth';
import { audit } from '../audit';
import { HttpError, prisma } from '../db';
import { sendMail } from '../mailer';
import { runRetention } from '../privacy/retention';

// Yönetim paneli KVKK bölümü (sadece süper yönetici = veri sorumlusu adına yetkili kişi):
// ilgili kişi başvuruları, veri ihlali kayıt defteri, imha kaydı
export const adminPrivacyRouter = Router();
adminPrivacyRouter.use(requireRole());

const adminEmail = async (id: string) => (await prisma.user.findUnique({ where: { id }, select: { email: true } }))?.email ?? '';

// ---------- İlgili kişi başvuruları
adminPrivacyRouter.get('/dsr', async (req, res) => {
  const { status } = z.object({ status: z.enum(['OPEN', 'ANSWERED', 'REJECTED']).default('OPEN') }).parse(req.query);
  const list = await prisma.dsrRequest.findMany({
    where: { status },
    orderBy: status === 'OPEN' ? { dueAt: 'asc' } : { answeredAt: 'desc' },
    take: 100,
  });
  res.json(list.map((r) => ({ ...r, overdue: r.status === 'OPEN' && r.dueAt < new Date() })));
});

adminPrivacyRouter.post('/dsr/:id/answer', async (req, res) => {
  const { status, answer } = z
    .object({ status: z.enum(['ANSWERED', 'REJECTED']), answer: z.string().trim().min(10).max(5000) })
    .parse(req.body);
  const r = await prisma.dsrRequest.findUnique({ where: { id: req.params.id }, include: { user: { select: { locale: true } } } });
  if (!r) throw new HttpError(404, 'not_found');
  if (r.status !== 'OPEN') throw new HttpError(409, 'already_answered');
  const by = await adminEmail(authedUser(req).id);
  await prisma.dsrRequest.update({ where: { id: r.id }, data: { status, answer, answeredAt: new Date(), answeredBy: by } });
  const tr = (r.user?.locale ?? 'tr') === 'tr';
  await sendMail(
    r.email,
    tr ? 'MeetPoint: KVKK başvurunun yanıtı' : 'MeetPoint: response to your data request',
    tr
      ? `Merhaba,\n\n${r.createdAt.toLocaleDateString('tr-TR')} tarihli başvurun ${status === 'ANSWERED' ? 'yanıtlandı' : 'reddedildi'}:\n\n${answer}\n\nYanıta itiraz etmek için Kişisel Verileri Koruma Kurulu'na 30 gün içinde şikayette bulunabilirsin.`
      : `Hi,\n\nYour request dated ${r.createdAt.toLocaleDateString('en-GB')} has been ${status === 'ANSWERED' ? 'answered' : 'rejected'}:\n\n${answer}\n\nIf you disagree, you may complain to the Turkish Personal Data Protection Authority within 30 days.`,
  ).catch((e) => console.error('dsr mail', e));
  await audit(req, `dsr.${status.toLowerCase()}`, 'dsr', r.id, { userId: r.userId ?? '', kind: r.kind });
  res.json({ ok: true });
});

// ---------- Veri ihlali kayıt defteri
const breachSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10_000),
  dataCategories: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  detectedAt: z.coerce.date(),
  occurredAt: z.coerce.date().nullable().default(null),
  affectedCount: z.number().int().min(0).default(0),
  measures: z.string().trim().max(10_000).default(''),
});

adminPrivacyRouter.get('/breaches', async (_req, res) => {
  res.json(await prisma.breachRecord.findMany({ orderBy: { detectedAt: 'desc' }, take: 100 }));
});

adminPrivacyRouter.post('/breaches', async (req, res) => {
  const data = breachSchema.parse(req.body);
  const b = await prisma.breachRecord.create({ data: { ...data, createdBy: await adminEmail(authedUser(req).id) } });
  await audit(req, 'breach.create', 'breach', b.id, { title: b.title });
  res.status(201).json(b);
});

// Güncelleme (tespit sonrası bilgiler netleşir) ve "Kurula bildirildi" işareti
adminPrivacyRouter.patch('/breaches/:id', async (req, res) => {
  const data = breachSchema.partial().extend({ authorityNotified: z.boolean().optional() }).parse(req.body);
  const { authorityNotified, ...rest } = data;
  const b = await prisma.breachRecord.update({
    where: { id: req.params.id },
    data: { ...rest, ...(authorityNotified ? { authorityNotifiedAt: new Date() } : {}) },
  }).catch(() => {
    throw new HttpError(404, 'not_found');
  });
  await audit(req, 'breach.update', 'breach', b.id, { fields: Object.keys(data) });
  res.json(b);
});

// Etkilenen kullanıcılara e-posta. Önce dryRun ile kaç kişiye gideceği görülür.
adminPrivacyRouter.post('/breaches/:id/notify', async (req, res) => {
  const q = z
    .object({
      scope: z.enum(['all', 'ids', 'registered_before']),
      ids: z.array(z.string()).max(10_000).default([]),
      before: z.coerce.date().optional(),
      subject: z.string().trim().min(5).max(200),
      message: z.string().trim().min(20).max(10_000),
      dryRun: z.boolean().default(true),
    })
    .parse(req.body);
  const breach = await prisma.breachRecord.findUnique({ where: { id: req.params.id } });
  if (!breach) throw new HttpError(404, 'not_found');
  if (q.scope === 'registered_before' && !q.before) throw new HttpError(400, 'validation');
  const where =
    q.scope === 'all' ? {} : q.scope === 'ids' ? { id: { in: q.ids } } : { createdAt: { lt: q.before } };
  const users = await prisma.user.findMany({ where, select: { email: true } });
  if (q.dryRun) return res.json({ recipients: users.length });

  let sent = 0;
  for (const u of users) {
    try {
      await sendMail(u.email, q.subject, q.message);
      sent++;
    } catch (e) {
      console.error('breach mail', e);
    }
  }
  await prisma.breachRecord.update({ where: { id: breach.id }, data: { usersNotifiedAt: new Date(), usersNotifiedCount: { increment: sent } } });
  await audit(req, 'breach.notify_users', 'breach', breach.id, { scope: q.scope, recipients: users.length, sent });
  res.json({ recipients: users.length, sent });
});

// ---------- İmha
adminPrivacyRouter.get('/destruction-log', async (_req, res) => {
  res.json(await prisma.destructionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
});

// Saklama/imha işini hemen çalıştır (normalde saatte bir kendiliğinden çalışır)
adminPrivacyRouter.post('/retention/run', async (req, res) => {
  const summary = await runRetention();
  await audit(req, 'retention.run', '', '', summary);
  res.json(summary);
});
