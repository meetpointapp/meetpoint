import type { Payout } from '@prisma/client';
import { decryptField, encryptField } from './fieldCrypto';
import { HttpError, prisma } from './db';
import { namesMatch } from './finance/kyc';
import { getFinance } from './finance/settings';
import { maskAccount, normalizeIban } from './iban';
import { notify } from './notify';
import { emitToUser } from './realtime';
import { credit, debitCashable, lockWallet } from './wallet';

// Para çekme: kullanıcı talep eder, kazanılmış jetonları hemen düşülür (CASHOUT).
// Yönetim ödemeyi elle yapıp "ödendi" işaretler; reddedilen ya da kullanıcının iptal ettiği
// talepte jetonlar CASHOUT_REFUND ile geri gelir ve yine bozdurulabilir kalır.
//
// Faz 13: kimlik doğrulaması (ad-soyad + TC + belge) zorunlu, IBAN sahibi kimlikteki adla aynı olmalı.
// Sadece olgunlaşmış kazanç bozdurulur. Brüt − stopaj = net. Aylık tavanı aşan ve şüpheli talepler
// engellenmez ama risk işaretiyle incelemeye düşer.

export type PayoutMethod = 'iban' | 'paypal';

export const payoutDto = (p: Payout) => ({
  id: p.id,
  coins: p.coins,
  usd: p.usd,
  withholdingUsd: p.withholdingUsd,
  netUsd: p.netUsd || p.usd,
  method: p.method,
  accountName: decryptField(p.accountName),
  accountHint: p.accountHint || maskAccount(p.method, decryptField(p.accountValue)),
  status: p.status,
  reference: p.reference,
  adminNote: p.adminNote,
  createdAt: p.createdAt,
  processedAt: p.processedAt,
});

const DAY = 86_400_000;
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

// Dolandırıcılık sinyalleri: kazancı gönderenlerle aynı cihaz/IP (kendi kendine para döngüsü),
// yeni hesap, aylık tavan. Sonuç yönetimin ekranında işaret olarak görünür.
export async function payoutRiskFlags(userId: string, usd: number) {
  const s = await getFinance();
  const flags: string[] = [];
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const month = await prisma.payout.aggregate({
    where: { userId, status: { in: ['PENDING', 'PAID'] }, createdAt: { gte: monthStart() } },
    _sum: { usd: true },
  });
  if ((month._sum.usd ?? 0) + usd > s.monthlyPayoutCapUsd) flags.push('monthly_cap');
  if (Date.now() - user.createdAt.getTime() < 30 * DAY) flags.push('new_account');

  // Son 60 günde kazanç gönderenler
  const payers = await prisma.walletEntry.findMany({
    where: { userId, counterpartyId: { not: null }, earned: { gt: 0 }, createdAt: { gt: new Date(Date.now() - 60 * DAY) } },
    distinct: ['counterpartyId'],
    select: { counterpartyId: true },
  });
  const payerIds = payers.map((p) => p.counterpartyId!).filter((id) => id !== userId);
  if (payerIds.length) {
    if (user.registeredDeviceId && (await prisma.user.count({ where: { id: { in: payerIds }, registeredDeviceId: user.registeredDeviceId } }))) {
      flags.push('same_device');
    }
    // Aynı cihaz kimliği veya IP'den açılmış oturumlar (son 60 gün)
    const mine = await prisma.session.findMany({ where: { userId, createdAt: { gt: new Date(Date.now() - 60 * DAY) } }, select: { deviceId: true, ip: true } });
    const devices = [...new Set(mine.map((m) => m.deviceId).filter(Boolean))];
    const ips = [...new Set(mine.map((m) => m.ip).filter(Boolean))];
    const shared = await prisma.session.findFirst({
      where: { userId: { in: payerIds }, OR: [{ deviceId: { in: devices } }, { ip: { in: ips } }] },
      select: { deviceId: true, ip: true },
    });
    if (shared) flags.push(shared.deviceId && devices.includes(shared.deviceId) ? 'same_device' : 'same_ip');
    // Tek kişiden gelen kazanç (tamamı bir hesaptan): para aktarma belirtisi olabilir
    if (payerIds.length === 1) flags.push('single_payer');
  }
  return [...new Set(flags)];
}

export async function requestPayout(
  userId: string,
  input: { coins: number; method: PayoutMethod; accountName: string; accountValue: string },
) {
  const s = await getFinance();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  // Dolandırıcılığa karşı: sadece mavi tikli (selfie ile doğrulanmış) hesaplar para çekebilir
  if (user.verificationStatus !== 'approved') throw new HttpError(403, 'verification_required');
  // Kimlik doğrulaması (ad-soyad + TC + belge) zorunlu
  if (user.kycStatus !== 'approved') throw new HttpError(403, 'kyc_required');
  if (input.coins < s.cashoutMinCoins) throw new HttpError(400, 'below_minimum');

  let accountValue = input.accountValue.trim();
  let accountName = input.accountName.trim();
  if (input.method === 'iban') {
    const iban = normalizeIban(accountValue);
    if (!iban) throw new HttpError(400, 'invalid_iban');
    if (accountName.length < 3) throw new HttpError(400, 'account_name_required');
    // IBAN sahibi, kimliği doğrulanan kişi olmalı (başkasının hesabına ödeme yapılmaz)
    if (!namesMatch(accountName, decryptField(user.kycName))) throw new HttpError(400, 'account_name_mismatch');
    accountValue = iban;
  } else {
    accountValue = accountValue.toLowerCase();
    accountName = accountName || decryptField(user.kycName);
  }

  const usd = +(input.coins * s.cashoutUsdPerCoin).toFixed(2);
  const withholdingUsd = +(usd * s.withholdingRate).toFixed(2);
  const riskFlags = await payoutRiskFlags(userId, usd);

  const payout = await prisma.$transaction(async (tx) => {
    // Kilit önce: eşzamanlı iki talep "bekleyen talep yok" kontrolünü birlikte geçemez
    await lockWallet(tx, userId);
    if (await tx.payout.count({ where: { userId, status: 'PENDING' } })) throw new HttpError(409, 'payout_pending');
    const p = await tx.payout.create({
      data: {
        userId,
        email: user.email,
        coins: input.coins,
        usd,
        withholdingUsd,
        netUsd: +(usd - withholdingUsd).toFixed(2),
        riskFlags,
        method: input.method,
        // IBAN/PayPal adresi ve hesap sahibi veritabanında şifreli; kullanıcıya maskeli hâli gösterilir
        accountName: encryptField(accountName),
        accountValue: encryptField(accountValue),
        accountHint: maskAccount(input.method, accountValue),
      },
    });
    await debitCashable(tx, userId, input.coins, 'CASHOUT', { note: `payout:${p.id}` });
    return p;
  });
  emitToUser(userId, 'wallet:updated', {});
  return payoutDto(payout);
}

// Bekleyen talebi kapat: iptal (kullanıcı) veya red (yönetim) → jetonlar geri
export async function closePayout(id: string, status: 'CANCELLED' | 'REJECTED', adminNote = '') {
  const payout = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payout.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, adminNote, processedAt: new Date() },
    });
    if (count !== 1) throw new HttpError(409, 'payout_not_pending');
    const p = await tx.payout.findUniqueOrThrow({ where: { id } });
    if (p.userId) await credit(tx, p.userId, { earned: p.coins }, 'CASHOUT_REFUND', { note: `payout:${id}` });
    return p;
  });
  if (payout.userId) {
    emitToUser(payout.userId, 'wallet:updated', {});
    if (status === 'REJECTED') void notify(payout.userId, 'payout', payout.userId, 'REJECTED');
  }
  return payoutDto(payout);
}

// Yönetim ödemeyi yaptı: işlem numarasıyla "ödendi" işaretle
export async function markPayoutPaid(id: string, reference: string) {
  const { count } = await prisma.payout.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'PAID', reference, processedAt: new Date() },
  });
  if (count !== 1) throw new HttpError(409, 'payout_not_pending');
  const payout = await prisma.payout.findUniqueOrThrow({ where: { id } });
  if (payout.userId) {
    emitToUser(payout.userId, 'wallet:updated', {});
    void notify(payout.userId, 'payout', payout.userId, 'PAID');
  }
  return payoutDto(payout);
}
