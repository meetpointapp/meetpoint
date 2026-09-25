import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth';
import { adminEmailOf, audit } from '../audit';
import { listCallDisputes, resolveCallDispute } from '../calls';
import { HttpError, prisma } from '../db';
import { decryptField } from '../fieldCrypto';
import { decideKyc, kycDocument, kycView } from '../finance/kyc';
import { financeReport, reportCsv } from '../finance/report';
import { getFinance, invalidateFinance, packReport } from '../finance/settings';
import { markPayoutPaid } from '../payouts';

// Finans (/admin/api/finance): kimlik doğrulama, toplu EFT, ödeme belgesi, aylık rapor (finans rolü);
// ekonomi ayarları ve paketler (sadece süper yönetici değiştirir)
export const adminFinanceRouter = Router();
const FIN = requireRole('finance');
const SUPER = requireRole();

// ---------- Ekonomi ayarları ve paket kârlılığı
adminFinanceRouter.get('/settings', FIN, async (_req, res) => {
  res.json({ settings: await getFinance(), packs: await packReport() });
});

adminFinanceRouter.put('/settings', SUPER, async (req, res) => {
  const data = z
    .object({
      storeFeeRate: z.number().min(0).max(0.5),
      vatRate: z.number().min(0).max(0.5),
      cashoutUsdPerCoin: z.number().positive().max(0.1),
      cashoutMinCoins: z.number().int().min(100).max(1_000_000),
      withholdingRate: z.number().min(0).max(0.5),
      maturityDays: z.number().int().min(0).max(180),
      monthlyPayoutCapUsd: z.number().min(0).max(1_000_000),
      usdTryRate: z.number().min(0).max(10_000),
    })
    .partial()
    .parse(req.body);
  const before = await getFinance();
  const after = await prisma.financeSettings.update({ where: { id: 1 }, data: { ...data, updatedBy: await adminEmailOf(req) } });
  invalidateFinance();
  const changed = Object.fromEntries(Object.keys(data).map((k) => [k, `${before[k as keyof typeof before]} → ${after[k as keyof typeof after]}`]));
  await audit(req, 'finance.settings', '', '', changed);
  res.json({ settings: after, packs: await packReport() });
});

const packSchema = z.object({
  coins: z.number().int().positive().max(1_000_000),
  usd: z.number().positive().max(10_000),
  tryPrice: z.number().min(0).max(1_000_000).default(0),
  popular: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

// Paket ekle/güncelle. Mağazadaki ürün kimliği (id) ile aynı olmalı. En fazla bir "en popüler".
adminFinanceRouter.put('/packs/:id', SUPER, async (req, res) => {
  const id = z.string().regex(/^[a-z0-9_.]{3,60}$/).parse(req.params.id);
  const data = packSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    if (data.popular) await tx.coinPack.updateMany({ where: { id: { not: id } }, data: { popular: false } });
    await tx.coinPack.upsert({ where: { id }, create: { id, ...data }, update: data });
  });
  invalidateFinance();
  await audit(req, 'finance.pack', 'pack', id, data);
  res.json({ packs: await packReport() });
});

// ---------- Kimlik doğrulama
adminFinanceRouter.get('/kyc', FIN, async (req, res) => {
  const { status } = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }).parse(req.query);
  const list = await prisma.kycSubmission.findMany({
    where: { status },
    orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    take: 100,
    include: { user: { select: { email: true, verificationStatus: true, profile: { select: { displayName: true } } } } },
  });
  res.json(
    list.map((s) => ({
      ...kycView(s),
      email: s.user.email,
      displayName: s.user.profile?.displayName ?? '',
      blueCheck: s.user.verificationStatus === 'approved',
      hasDocument: !!s.documentPath,
    })),
  );
});

adminFinanceRouter.get('/kyc/:id/document', FIN, async (req, res) => {
  const image = await kycDocument(req.params.id);
  await audit(req, 'kyc.view_document', 'kyc', req.params.id);
  res.setHeader('Cache-Control', 'no-store');
  res.type('image/webp').send(image);
});

adminFinanceRouter.post('/kyc/:id/decide', FIN, async (req, res) => {
  const { approve, note } = z.object({ approve: z.boolean(), note: z.string().trim().max(300).default('') }).parse(req.body);
  if (!approve && note.length < 3) throw new HttpError(400, 'validation');
  await decideKyc(req.params.id, approve, note, await adminEmailOf(req));
  await audit(req, approve ? 'kyc.approve' : 'kyc.reject', 'kyc', req.params.id, { note });
  res.json({ ok: true });
});

// ---------- Toplu EFT dosyası: bekleyen IBAN ödemeleri (net tutar, TL'ye çevrilmiş)
adminFinanceRouter.get('/eft', FIN, async (req, res) => {
  const s = await getFinance();
  const { rate } = z.object({ rate: z.coerce.number().positive().max(10_000).optional() }).parse(req.query);
  const usdTry = rate ?? s.usdTryRate;
  if (!usdTry) throw new HttpError(400, 'rate_required');
  const list = await prisma.payout.findMany({ where: { status: 'PENDING', method: 'iban' }, orderBy: { createdAt: 'asc' } });
  const esc = (v: string) => (/[;",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['Alici Adi;IBAN;Tutar TL;Tutar USD (net);Aciklama;Talep No'];
  for (const p of list) {
    const net = p.netUsd || p.usd;
    lines.push([esc(decryptField(p.accountName)), decryptField(p.accountValue), (net * usdTry).toFixed(2), net.toFixed(2), `MeetPoint kazanc odemesi ${p.id.slice(-8)}`, p.id].join(';'));
  }
  await prisma.payout.updateMany({ where: { id: { in: list.map((p) => p.id) } }, data: { exportedAt: new Date() } });
  await audit(req, 'payout.eft_export', 'payout', '', { count: list.length, usdTry, ids: list.map((p) => p.id).join(',') });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="eft-${new Date().toISOString().slice(0, 10)}.csv"`);
  // Excel ve banka sistemleri Türkçe karakterleri doğru okusun (UTF-8 BOM)
  res.type('text/csv; charset=utf-8').send(`﻿${lines.join('\r\n')}`);
});

// Banka toplu ödemeyi yaptıktan sonra: hepsini tek dekont/işlem numarasıyla "ödendi" işaretle
adminFinanceRouter.post('/payouts/bulk-paid', FIN, async (req, res) => {
  const { ids, reference } = z.object({ ids: z.array(z.string()).min(1).max(500), reference: z.string().trim().min(3).max(100) }).parse(req.body);
  const done: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await markPayoutPaid(id, reference);
      done.push(id);
    } catch {
      failed.push(id);
    }
  }
  await audit(req, 'payout.bulk_paid', 'payout', '', { reference, done: done.length, failed: failed.join(',') });
  res.json({ done: done.length, failed });
});

// Ödeme belgesi taslağı (yazdırılabilir). Resmî belge biçimi muhasebeciyle netleşecek (Faz 17).
adminFinanceRouter.get('/payouts/:id/receipt', FIN, async (req, res) => {
  const p = await prisma.payout.findUnique({ where: { id: req.params.id }, include: { user: { select: { kycName: true } } } });
  if (!p || p.status !== 'PAID') throw new HttpError(404, 'not_found');
  const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const name = esc(p.user?.kycName ? decryptField(p.user.kycName) : decryptField(p.accountName));
  await audit(req, 'payout.receipt', 'payout', p.id);
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Ödeme belgesi ${esc(p.id)}</title>
<style>body{font:14px/1.5 sans-serif;max-width:640px;margin:32px auto;padding:0 16px}td{padding:6px 10px;border-bottom:1px solid #ddd}.draft{color:#a60}</style></head><body>
<h2>Ödeme belgesi</h2><p class="draft">TASLAK: resmî biçim ve stopaj muhasebeciyle netleşecek.</p>
<table>
<tr><td>Ödeyen</td><td>[Şirket Unvanı] · [Vergi No]</td></tr>
<tr><td>Alıcı</td><td>${name}</td></tr>
<tr><td>Hesap</td><td>${esc(p.accountHint)}</td></tr>
<tr><td>Ödeme tarihi</td><td>${p.processedAt?.toLocaleDateString('tr-TR') ?? ''}</td></tr>
<tr><td>Açıklama</td><td>${p.coins.toLocaleString('tr-TR')} jeton kazanç ödemesi</td></tr>
<tr><td>Brüt tutar</td><td>$${p.usd.toFixed(2)}</td></tr>
<tr><td>Stopaj</td><td>$${p.withholdingUsd.toFixed(2)}</td></tr>
<tr><td>Net ödenen</td><td><b>$${(p.netUsd || p.usd).toFixed(2)}</b></td></tr>
<tr><td>İşlem / dekont no</td><td>${esc(p.reference)}</td></tr>
<tr><td>Belge no</td><td>${esc(p.id)}</td></tr>
</table></body></html>`);
});

// ---------- Arama itirazları (Faz 15)
adminFinanceRouter.get('/disputes', FIN, async (req, res) => {
  const { status } = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }).parse(req.query);
  res.json(await listCallDisputes(status));
});

adminFinanceRouter.post('/disputes/:id/resolve', FIN, async (req, res) => {
  const { approve, note } = z.object({ approve: z.boolean(), note: z.string().trim().max(300).default('') }).parse(req.body);
  if (!approve && note.length < 3) throw new HttpError(400, 'validation');
  const result = await resolveCallDispute(req.params.id, approve, note);
  await audit(req, approve ? 'dispute.approve' : 'dispute.reject', 'call_dispute', req.params.id, { note, refund: result.refund });
  res.json(result);
});

// ---------- Aylık finans raporu
adminFinanceRouter.get('/report', FIN, async (req, res) => {
  const q = z
    .object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).default(() => new Date().toISOString().slice(0, 7)), format: z.enum(['json', 'csv']).default('json') })
    .parse(req.query);
  const r = await financeReport(q.month);
  if (q.format === 'csv') {
    await audit(req, 'finance.report_export', '', '', { month: q.month });
    res.setHeader('Content-Disposition', `attachment; filename="finans-${q.month}.csv"`);
    return res.type('text/csv; charset=utf-8').send(`﻿${reportCsv(r)}`);
  }
  res.json(r);
});
