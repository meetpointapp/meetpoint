// Faz 13: para akışı güvenliği — kimlik doğrulama, olgunlaşma ve iadede geri alma, risk işaretleri,
// toplu EFT, stopaj, ödeme belgesi, yıllık döküm, ekonomi ayarları, aylık rapor
import fs from 'node:fs';
import { describe, it } from 'vitest';
import {
  ageEarnings,
  B,
  call,
  check,
  makeAdmin,
  makeUser,
  png,
  PRIVATE_DIR,
  testDb,
  uniqueTag,
  upload,
  validTc,
  verifyIdentity,
  type TestUser,
} from '../helpers';

const AUTH = 'Bearer test-webhook-secret';
const hook = async (event: Record<string, unknown>) => {
  const res = await fetch(`${B}/webhooks/revenuecat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: AUTH },
    body: JSON.stringify({ event }),
  });
  return res.json();
};

async function submitKyc(u: TestUser, fullName: string, tcNo: string) {
  const fd = new FormData();
  fd.append('fullName', fullName);
  fd.append('tcNo', tcNo);
  fd.append('document', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'kimlik.png');
  const res = await fetch(`${B}/me/kyc`, { method: 'POST', headers: { authorization: `Bearer ${u.t}` }, body: fd });
  return { ...(await res.json()), http: res.status };
}

// Ödeyen, arama + hediyelerle karşı tarafa kazanç geçirir. Promosyon jetonları (bonus) önce harcanır.
// Kapatma tam dakika sınırında olmayabilir: son ücretlendirilen dakikanın kullanılmayan kısmı
// saniye bazlı iade edilir (Faz 15). Bu yüzden dönen totalCoins gerçek harcanan miktardır.
async function spendOn(payer: TestUser, earner: TestUser, diamonds: number) {
  const c = await call(payer.t, 'POST', '/calls', { toId: earner.id, kind: 'VIDEO' });
  await call(earner.t, 'POST', `/calls/${c.id}/accept`);
  for (let i = 0; i < diamonds; i++) await call(payer.t, 'POST', `/calls/${c.id}/gifts`, { giftId: 'diamond' });
  await call(payer.t, 'POST', `/calls/${c.id}/hangup`);
  const info = await call(payer.t, 'GET', `/calls/${c.id}`);
  return (info.totalCoins as number) + (info.giftCoins as number);
}

const wallet = (u: TestUser) => call(u.t, 'GET', '/wallet');

describe('Para akışı ve finans (Faz 13)', () => {
  it('kimlik doğrulama: TC algoritması, şifreli saklama, belge inceleme, red ve tekil TC', async () => {
    const u = await makeUser('Kimlik', 'female', 'male');
    const tc = validTc();
    check('invalid TC rejected', (await submitKyc(u, 'Ayşe Kaya', '12345678901')).error === 'invalid_tc');
    check('full name required', (await submitKyc(u, 'Madonnaa', tc)).error === 'full_name_required');
    const sub = await submitKyc(u, 'Ayşe Kaya', tc);
    check('submitted', sub.http === 201 && sub.status === 'pending');
    check('cannot submit twice while pending', (await submitKyc(u, 'Ayşe Kaya', tc)).error === 'kyc_pending');
    check('status visible to user', (await call(u.t, 'GET', '/me/kyc')).status === 'pending');

    const db = await testDb();
    const row = await db.kycSubmission.findUniqueOrThrow({ where: { id: sub.id } });
    check('name and TC encrypted at rest', row.fullName.startsWith('v1:') && row.tcNo.startsWith('v1:') && !row.tcNo.includes(tc));
    const file = fs.readFileSync(`${PRIVATE_DIR}/${row.documentPath}`);
    check('document encrypted at rest', file.subarray(0, 4).toString() !== 'RIFF' && file.length > 28);

    const mod = await makeAdmin('moderator');
    check('moderator cannot see KYC', (await call(mod.t, 'GET', '/admin/api/finance/kyc')).http === 403);
    const fin = await makeAdmin('finance');
    const list = await call(fin.t, 'GET', '/admin/api/finance/kyc');
    const item = list._arr?.find((k) => k.id === sub.id);
    check('finance sees masked TC and name', item?.fullName === 'Ayşe Kaya' && item.tcMasked.endsWith(tc.slice(-4)) && !JSON.stringify(item).includes(tc));
    const doc = await fetch(`${B}/admin/api/finance/kyc/${sub.id}/document`, { headers: { authorization: `Bearer ${fin.t}` } });
    check('document decrypted for reviewer', doc.status === 200 && (await doc.arrayBuffer()).byteLength > 0);
    const audit = await db.adminAudit.count({ where: { action: 'kyc.view_document', targetId: sub.id } });
    check('document view audited', audit === 1);

    const noNote = await call(fin.t, 'POST', `/admin/api/finance/kyc/${sub.id}/decide`, { approve: false });
    check('rejection needs a reason', noNote.http === 400);
    await call(fin.t, 'POST', `/admin/api/finance/kyc/${sub.id}/decide`, { approve: false, note: 'Belge okunmuyor' });
    check('rejected', (await call(u.t, 'GET', '/me/kyc')).status === 'rejected');
    check('rejected document deleted', !fs.existsSync(`${PRIVATE_DIR}/${row.documentPath}`));

    const again = await submitKyc(u, 'Ayşe Kaya', tc);
    await call(fin.t, 'POST', `/admin/api/finance/kyc/${again.id}/decide`, { approve: true });
    check('approved on resubmit', (await call(u.t, 'GET', '/me/kyc')).status === 'approved');
    const other = await makeUser('Baska', 'male', 'female');
    check('same TC cannot verify another account', (await submitKyc(other, 'Ayşe Kaya', tc)).error === 'tc_in_use');
  });

  it('iade: olgunlaşmamış kazanç alıcıdan geri alınır, olgunlaşmış kazanca dokunulmaz', async () => {
    const tag = uniqueTag();
    const buyer = await makeUser('Alici', 'male', 'female');
    const earner = await makeUser('Kazanan', 'female', 'male');
    // 1000 jeton + %50 ilk alım bonusu (500) + 50 kayıt hediyesi = 550 promosyon
    await hook({ id: `evt-p-${tag}`, type: 'NON_RENEWING_PURCHASE', app_user_id: buyer.id, product_id: 'coins_1000', transaction_id: `t-${tag}`, store: 'APP_STORE', price: 18.99 });
    await spendOn(buyer, earner, 6); // 30 (1. dakika, ~980 satın alınmıştan) + 1500 = ~1530 → ~550 promosyon
    let w = await wallet(earner);
    // Faz 15: kapanış tam dakika sınırında olmayabilir, son (bonustan ödenen) dakikanın kullanılmayan
    // kısmı orantılı iade edilir; o yüzden 980 yerine ölçülen (980'e yakın) tutar kullanılır.
    const cashableEarned = w.maturingEarnings as number;
    check('earner has maturing earnings', cashableEarned >= 950 && cashableEarned <= 980 && w.cashable === 0, `maturing=${cashableEarned}`);
    const buyerBalanceBeforeRefund = (await wallet(buyer)).balance as number;

    const r = await hook({ id: `evt-r-${tag}`, type: 'CANCELLATION', app_user_id: buyer.id, transaction_id: `t-${tag}` });
    check('refund processed', r.refunded === true);
    w = await wallet(earner);
    // Kalan: bozdurulamaz kazanç (bonustan, refundCallCharge'ın dokunmadığı kısım) + 50 kayıt hediyesi
    check('immature earnings reclaimed from earner', w.maturingEarnings === 0, `maturing=${w.maturingEarnings}`);
    const reclaimed = w.entries?.filter((e) => e.type === 'REFUND_CLAWBACK').reduce((a, e) => a + e.amount, 0);
    check('reclaim visible in history (one entry per gift)', reclaimed === -cashableEarned, `reclaimed=${reclaimed} expected=${-cashableEarned}`);
    const bw = await wallet(buyer);
    // 1000 satın alınmış jetonun geri alınamayan (zaten olgunlaşmamış kazançtan geri alınan) kısmı + 500 bonus
    const expectedBuyer = buyerBalanceBeforeRefund - (1000 - cashableEarned) - 500;
    check('buyer charged only the rest', bw.balance === expectedBuyer, `buyer=${bw.balance} expected=${expectedBuyer}`);

    // Olgunlaşmış kazanç: iade gelse de geri alınmaz (bozdurulmuş olabilir; risk olgunlaşma süresiyle sınırlı)
    const buyer2 = await makeUser('Alici2', 'male', 'female');
    const earner2 = await makeUser('Kazanan2', 'female', 'male');
    await hook({ id: `evt-p2-${tag}`, type: 'NON_RENEWING_PURCHASE', app_user_id: buyer2.id, product_id: 'coins_1000', transaction_id: `t2-${tag}`, store: 'APP_STORE', price: 18.99 });
    await spendOn(buyer2, earner2, 6);
    const cashableEarned2 = (await wallet(earner2)).maturingEarnings as number;
    const buyer2BalanceBeforeRefund = (await wallet(buyer2)).balance as number;
    await ageEarnings(earner2.id);
    await hook({ id: `evt-r2-${tag}`, type: 'CANCELLATION', app_user_id: buyer2.id, transaction_id: `t2-${tag}` });
    const w2 = await wallet(earner2);
    check('matured earnings untouched', w2.cashable === cashableEarned2, `cashable=${w2.cashable} expected=${cashableEarned2}`);
    // Olgunlaşmış kazanç geri alınamadı: geri alınan = 0, buyer tüm 1000 + 500 bonusu üstlenir
    const expectedBuyer2 = buyer2BalanceBeforeRefund - 1000 - 500;
    check('buyer carries the debt', (await wallet(buyer2)).balance === expectedBuyer2, `buyer2=${(await wallet(buyer2)).balance} expected=${expectedBuyer2}`);
  });

  it('para çekme: risk işaretleri, stopaj, toplu EFT, ödeme belgesi ve yıllık döküm', async () => {
    const sup = await makeAdmin('super');
    const fin = await makeAdmin('finance');
    const payer = await makeUser('Oder', 'male', 'female');
    const earner = await makeUser('Cekici', 'female', 'male');
    const db = await testDb();
    // Aynı cihazdan açılmış iki hesap: kendi kendine para döngüsü şüphesi
    await db.user.updateMany({ where: { id: { in: [payer.id, earner.id] } }, data: { registeredDeviceId: `ortak-${uniqueTag()}` } });
    await call(payer.t, 'POST', '/wallet/dev-topup', { packId: 'coins_6000' });
    await spendOn(payer, earner, 21);
    await ageEarnings(earner.id);
    await call(earner.t, 'PUT', '/me/consents', { kind: 'selfie', granted: true, source: 'verification' });
    await call(earner.t, 'POST', '/me/verification/start');
    await upload(earner.t, '/me/verification', 'selfie');
    const q = await call(sup.t, 'GET', '/admin/api/verifications');
    await call(sup.t, 'POST', `/admin/api/verifications/${q._arr.find((v) => v.user?.id === earner.id).id}/approve`, {});
    await verifyIdentity(earner, 'Zeynep Çelik', fin);

    const before = await call(sup.t, 'GET', '/admin/api/finance/settings');
    try {
      // %10 stopaj ve düşük aylık tavan (tavan engellemez, işaretler)
      await call(sup.t, 'PUT', '/admin/api/finance/settings', { withholdingRate: 0.1, monthlyPayoutCapUsd: 10 });
      const p = await call(earner.t, 'POST', '/payouts', { coins: 2000, method: 'iban', accountName: 'ZEYNEP CELIK', accountValue: 'TR33 0006 1005 1978 6457 8413 26' });
      check('payout created (name match ignores Turkish letters/case)', p.http === 201, p.error);
      check('withholding applied', p.usd === 20 && p.withholdingUsd === 2 && p.netUsd === 18, JSON.stringify(p));
      const adminList = await call(fin.t, 'GET', '/admin/api/payouts');
      const row = adminList._arr?.find((x) => x.id === p.id);
      check('risk flags for review', ['monthly_cap', 'new_account', 'same_device', 'single_payer'].every((f) => row?.riskFlags?.includes(f)), JSON.stringify(row?.riskFlags));

      const noRate = await call(fin.t, 'GET', '/admin/api/finance/eft');
      check('EFT needs exchange rate', noRate.http === 400 && noRate.error === 'rate_required');
      const eft = await fetch(`${B}/admin/api/finance/eft?rate=40`, { headers: { authorization: `Bearer ${fin.t}` } });
      const csv = await eft.text();
      const line = csv.split('\r\n').find((l) => l.includes(p.id));
      check('EFT file with decrypted IBAN and TL amount', !!line && line.includes('TR330006100519786457841326') && line.includes('720.00') && line.includes('ZEYNEP CELIK'), line);
      check('marked exported', !!(await db.payout.findUniqueOrThrow({ where: { id: p.id } })).exportedAt);

      const bulk = await call(fin.t, 'POST', '/admin/api/finance/payouts/bulk-paid', { ids: [p.id, 'yok'], reference: 'TOPLU-EFT-001' });
      check('bulk marked paid', bulk.done === 1 && bulk.failed.length === 1);
      const receipt = await fetch(`${B}/admin/api/finance/payouts/${p.id}/receipt`, { headers: { authorization: `Bearer ${fin.t}` } });
      const html = await receipt.text();
      check('receipt shows gross, withholding, net', receipt.status === 200 && html.includes('$20.00') && html.includes('$2.00') && html.includes('$18.00') && html.includes('Zeynep Çelik'));

      const st = await call(earner.t, 'GET', `/me/earnings?year=${new Date().getUTCFullYear()}`);
      check('annual statement', st.totals?.count === 1 && st.totals.grossUsd === 20 && st.totals.withholdingUsd === 2 && st.totals.netUsd === 18 && st.earnedCoins > 0, JSON.stringify(st.totals));
    } finally {
      const s = before.settings;
      await call(sup.t, 'PUT', '/admin/api/finance/settings', { withholdingRate: s.withholdingRate, monthlyPayoutCapUsd: s.monthlyPayoutCapUsd });
    }
  });

  it('ekonomi ayarları: sadece süper yönetici değiştirir, zarar eden paket işaretlenir', async () => {
    const fin = await makeAdmin('finance');
    const sup = await makeAdmin('super');
    const s = await call(fin.t, 'GET', '/admin/api/finance/settings');
    const p6000 = s.packs?.find((p) => p.id === 'coins_6000');
    check('profitable at 15%, flagged at 30%', p6000?.now.profitable === true && p6000.at30.profitable === false, JSON.stringify(p6000));
    check('finance cannot change settings', (await call(fin.t, 'PUT', '/admin/api/finance/settings', { vatRate: 0.1 })).http === 403);
    check('invalid value rejected', (await call(sup.t, 'PUT', '/admin/api/finance/settings', { storeFeeRate: 0.9 })).http === 400);

    const id = `coins_test_${uniqueTag()}`;
    const add = await call(sup.t, 'PUT', `/admin/api/finance/packs/${id}`, { coins: 100, usd: 0.99, active: false, sortOrder: 99 });
    check('pack added (inactive)', add.packs?.some((p) => p.id === id && !p.active));
    const shop = await call((await makeUser('Musteri', 'male', 'female')).t, 'GET', '/wallet');
    check('inactive pack hidden from shop', shop.packs?.length >= 4 && !shop.packs.some((p) => p.id === id));
    const audit = await call(sup.t, 'GET', '/admin/api/audit?action=finance.');
    check('changes audited', audit._arr?.some((a) => a.action === 'finance.pack' && a.targetId === id));
    await (await testDb()).coinPack.delete({ where: { id } });
  });

  it('aylık finans raporu ve mutabakat', async () => {
    const fin = await makeAdmin('finance');
    const month = new Date().toISOString().slice(0, 7);
    const r = await call(fin.t, 'GET', `/admin/api/finance/report?month=${month}`);
    check('report sections', r.sales && r.refunds && r.liability && r.payouts && r.reconciliation);
    check('sales counted with VAT and store fee split', r.sales.count >= 1 && Math.abs(r.sales.grossUsd - (r.sales.vatUsd + r.sales.storeFeeUsd + r.sales.netUsd)) < 0.05, JSON.stringify(r.sales));
    check('coins reconcile with sales records', r.reconciliation.matches === true && r.reconciliation.inconsistentWallets === 0, JSON.stringify(r.reconciliation));

    // Hesabı kalıcı silinen kullanıcının satışı muhasebede kalır ama mutabakatı bozmaz
    const gone = await makeUser('Silinecek', 'male', 'female');
    await call(gone.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' });
    const db = await testDb();
    await db.user.update({ where: { id: gone.id }, data: { deletionRequestedAt: new Date(), deleteAfter: new Date(Date.now() - 1000) } });
    await call((await makeAdmin('super')).t, 'POST', '/admin/api/privacy/retention/run');
    const r2 = await call(fin.t, 'GET', `/admin/api/finance/report?month=${month}`);
    check('deleted account sales listed separately, reconciliation still matches', r2.reconciliation.matches === true && r2.reconciliation.deletedAccountSales >= 1, JSON.stringify(r2.reconciliation));
    check('cash liability from earned coins', r.liability.maxCashUsd === +(r.liability.earnedCoins * r.settings.cashoutUsdPerCoin).toFixed(2));
    const csv = await fetch(`${B}/admin/api/finance/report?month=${month}&format=csv`, { headers: { authorization: `Bearer ${fin.t}` } });
    const text = await csv.text();
    check('CSV export for accountant', csv.status === 200 && text.includes('bolum,kalem,deger') && text.includes('satis,grossUsd'));
    check('bad month rejected', (await call(fin.t, 'GET', '/admin/api/finance/report?month=2026-13')).http === 400);
  });
});
