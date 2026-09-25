import { Router } from 'express';
import { z } from 'zod';
import { authedUser, requireRole } from '../auth';
import { audit, adminEmailOf } from '../audit';
import { COMPANY_FIELDS, getCompany, invalidateCompany, missingCompanyFields } from '../consumer/company';
import { HttpError, prisma } from '../db';
import { getBalance } from '../wallet';
import { HELP_CATEGORIES } from '../support/help';
import { readAttachment, staffClose, staffReply, supportMetrics, ticketSummary } from '../support/tickets';

// Yönetim paneli: destek talepleri (moderatör + finans), yardım merkezi (moderatör), künye (süper yönetici)
export const adminSupportRouter = Router();

// ---------- Destek talepleri
const tickets = Router();
tickets.use(requireRole('moderator', 'finance'));

tickets.get('/metrics', async (_req, res) => {
  res.json(await supportMetrics());
});

tickets.get('/', async (req, res) => {
  const { status } = z.object({ status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']).default('OPEN') }).parse(req.query);
  const list = await prisma.supportTicket.findMany({
    where: { status },
    // Sıra bizde olanlar: en acil (hedefi en yakın) önce
    orderBy: status === 'OPEN' ? { dueAt: 'asc' } : { lastMessageAt: 'desc' },
    take: 100,
    include: { user: { select: { email: true } }, _count: { select: { messages: true } } },
  });
  const now = new Date();
  res.json(
    list.map((t) => ({
      ...ticketSummary(t),
      email: t.user.email,
      userId: t.userId,
      dueAt: t.dueAt,
      overdue: t.status === 'OPEN' && t.dueAt < now,
      messageCount: t._count.messages,
      platform: t.platform,
    })),
  );
});

// İlgili işlemin özeti (panelde talep yanında görünür)
async function relatedSummary(type: string, id: string) {
  if (!type || !id) return null;
  if (type === 'purchase') {
    const p = await prisma.purchase.findUnique({ where: { id } });
    return p && { type, id, text: `${p.coins} jeton (+${p.bonusCoins} bonus) · ${p.store} · ${p.status}`, createdAt: p.createdAt, transactionId: p.transactionId };
  }
  if (type === 'payout') {
    const p = await prisma.payout.findUnique({ where: { id } });
    return p && { type, id, text: `${p.coins} jeton · $${p.usd.toFixed(2)} · ${p.status}`, createdAt: p.createdAt };
  }
  if (type === 'call') {
    const c = await prisma.call.findUnique({ where: { id } });
    return c && { type, id, text: `${c.kind} · ${c.status} · ${c.billedMinutes} dk · ${c.totalCoins} jeton`, createdAt: c.createdAt };
  }
  const w = await prisma.walletEntry.findUnique({ where: { id } });
  return w && { type, id, text: `${w.type} · ${w.amount} jeton${w.note ? ` · ${w.note}` : ''}`, createdAt: w.createdAt };
}

tickets.get('/:id', async (req, res) => {
  const t = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, email: true, locale: true, createdAt: true, bannedAt: true, kycStatus: true, verificationStatus: true, profile: { select: { displayName: true } } } },
    },
  });
  if (!t) throw new HttpError(404, 'not_found');
  const staffIds = [...new Set(t.messages.map((m) => m.staffId).filter(Boolean))];
  const staff = await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, email: true } });
  const staffEmail = Object.fromEntries(staff.map((s) => [s.id, s.email]));
  res.json({
    ...ticketSummary(t),
    dueAt: t.dueAt,
    firstResponseAt: t.firstResponseAt,
    platform: t.platform,
    appVersion: t.appVersion,
    user: {
      id: t.user.id,
      email: t.user.email,
      name: t.user.profile?.displayName ?? '',
      locale: t.user.locale,
      createdAt: t.user.createdAt,
      banned: t.user.bannedAt !== null,
      kycStatus: t.user.kycStatus,
      verificationStatus: t.user.verificationStatus,
      balance: await getBalance(t.user.id),
    },
    related: await relatedSummary(t.relatedType, t.relatedId),
    messages: t.messages.map((m) => ({
      id: m.id,
      fromStaff: m.fromStaff,
      staff: m.staffId ? (staffEmail[m.staffId] ?? '') : '',
      body: m.body,
      hasAttachment: m.attachment !== '',
      createdAt: m.createdAt,
    })),
  });
});

tickets.post('/:id/reply', async (req, res) => {
  const { body, close } = z.object({ body: z.string().trim().min(2).max(5000), close: z.boolean().default(false) }).parse(req.body);
  await staffReply(authedUser(req).id, req.params.id, body, close);
  await audit(req, close ? 'support.reply_close' : 'support.reply', 'support', req.params.id);
  res.json({ ok: true });
});

tickets.post('/:id/close', async (req, res) => {
  await staffClose(req.params.id);
  await audit(req, 'support.close', 'support', req.params.id);
  res.json({ ok: true });
});

// Ek dosyası (ekran görüntüsü): görüntüleme işlem kaydına yazılır
tickets.get('/attachments/:messageId', async (req, res) => {
  const { file, ticketUserId } = await readAttachment(req.params.messageId, null);
  await audit(req, 'support.attachment_view', 'user', ticketUserId, { messageId: req.params.messageId });
  res.setHeader('Cache-Control', 'no-store');
  res.type('image/webp').send(file);
});

adminSupportRouter.use('/tickets', tickets);

// ---------- Yardım merkezi (SSS)
const help = Router();
help.use(requireRole('moderator'));

const articleSchema = z.object({
  locale: z.enum(['tr', 'en']),
  category: z.enum(HELP_CATEGORIES),
  question: z.string().trim().min(5).max(200),
  answer: z.string().trim().min(10).max(4000),
  position: z.number().int().min(0).max(999).default(0),
  published: z.boolean().default(true),
});

help.get('/', async (req, res) => {
  const { locale } = z.object({ locale: z.enum(['tr', 'en']).default('tr') }).parse(req.query);
  res.json(await prisma.helpArticle.findMany({ where: { locale }, orderBy: [{ category: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] }));
});

help.post('/', async (req, res) => {
  const data = articleSchema.parse(req.body);
  const a = await prisma.helpArticle.create({ data: { ...data, updatedBy: await adminEmailOf(req) } });
  await audit(req, 'help.create', 'help', a.id, { locale: a.locale, question: a.question });
  res.status(201).json(a);
});

help.put('/:id', async (req, res) => {
  const data = articleSchema.partial().parse(req.body);
  const exists = await prisma.helpArticle.findUnique({ where: { id: req.params.id } });
  if (!exists) throw new HttpError(404, 'not_found');
  const a = await prisma.helpArticle.update({ where: { id: req.params.id }, data: { ...data, updatedBy: await adminEmailOf(req) } });
  await audit(req, 'help.update', 'help', a.id, { question: a.question, published: a.published });
  res.json(a);
});

help.delete('/:id', async (req, res) => {
  const a = await prisma.helpArticle.findUnique({ where: { id: req.params.id } });
  if (!a) throw new HttpError(404, 'not_found');
  await prisma.helpArticle.delete({ where: { id: a.id } });
  await audit(req, 'help.delete', 'help', a.id, { question: a.question });
  res.json({ ok: true });
});

adminSupportRouter.use('/help', help);

// ---------- Künye (şirket bilgileri): herkes görür, sadece süper yönetici değiştirir
adminSupportRouter.get('/company', async (_req, res) => {
  const c = await getCompany();
  res.json({ ...c, missing: missingCompanyFields(c) });
});

adminSupportRouter.put('/company', requireRole(), async (req, res) => {
  const data = z.object(Object.fromEntries(COMPANY_FIELDS.map((f) => [f, z.string().trim().max(300).optional()]))).parse(req.body) as Record<string, string | undefined>;
  const before = await getCompany();
  await prisma.companyInfo.update({ where: { id: 1 }, data: { ...data, updatedBy: await adminEmailOf(req) } });
  invalidateCompany();
  const changed = Object.keys(data).filter((k) => data[k] !== undefined && data[k] !== before[k as keyof typeof before]);
  await audit(req, 'company.update', 'company', '1', { changed });
  const c = await getCompany();
  res.json({ ...c, missing: missingCompanyFields(c) });
});
