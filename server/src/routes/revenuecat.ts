import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../db';
import { revenueCat, subscription } from '../config';
import { creditPurchase, refundPurchase, type Store } from '../purchases';

// RevenueCat webhook'u: satın alma ve iade olayları. Uygulamada Purchases.logIn(userId)
// kullanıldığı için app_user_id bizim kullanıcı kimliğimizdir.
// Her zaman 200 döner (RevenueCat 2xx dışını tekrar dener); işlenemeyen olaylar loglanır.
export const revenueCatRouter = Router();

const STORES: Record<string, Store> = { APP_STORE: 'app_store', PLAY_STORE: 'play_store' };

function authorized(header: string | undefined) {
  if (!revenueCat.webhookAuth || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(revenueCat.webhookAuth);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

revenueCatRouter.post('/', async (req, res) => {
  if (!authorized(req.headers.authorization)) return res.status(401).json({ error: 'unauthorized' });

  const event = req.body?.event;
  if (!event || typeof event !== 'object') return res.json({ ok: true, ignored: 'no_event' });

  const type = String(event.type ?? '');
  const userId = String(event.app_user_id ?? '');
  const transactionId = String(event.transaction_id ?? event.id ?? '');
  const productId = String(event.product_id ?? '');

  // Faz 16: VibeUpMe+ aylık abonelik. Jetonla alınan özelliklerden farklı — gerçek para,
  // creditPurchase()'a girmez. Süre RevenueCat'in bildirdiği expiration_at_ms'ten alınır.
  if (productId === subscription.productId) {
    if (!userId) return res.json({ ok: true, ignored: 'missing_user' });
    if (['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(type)) {
      const expiresAt = typeof event.expiration_at_ms === 'number' ? new Date(event.expiration_at_ms) : null;
      if (!expiresAt) return res.json({ ok: true, ignored: 'missing_expiration' });
      await prisma.user.update({ where: { id: userId }, data: { premiumUntil: expiresAt } });
      return res.json({ ok: true, premiumUntil: expiresAt });
    }
    if (type === 'EXPIRATION') {
      await prisma.user.update({ where: { id: userId }, data: { premiumUntil: null } });
      return res.json({ ok: true, expired: true });
    }
    // CANCELLATION: otomatik yenileme kapatıldı ama süre henüz dolmadı — erişim premiumUntil'e
    // kadar sürer, burada değiştirilecek bir şey yok. BILLING_ISSUE vb. de burada yok sayılır.
    return res.json({ ok: true, ignored: type || 'subscription_event' });
  }

  if (type === 'NON_RENEWING_PURCHASE' || type === 'INITIAL_PURCHASE') {
    const store = STORES[String(event.store ?? '')];
    if (!store || !userId || !transactionId) return res.json({ ok: true, ignored: 'missing_fields' });
    const result = await creditPurchase({
      userId,
      productId,
      transactionId,
      store,
      priceUsd: typeof event.price === 'number' ? event.price : null,
      currency: String(event.currency ?? ''),
      sandbox: event.environment === 'SANDBOX',
    });
    return res.json({ ok: true, credited: result.credited });
  }

  // İade (müşteri desteği / mağaza iadesi): jetonları geri al
  if (type === 'CANCELLATION' && transactionId) {
    const refunded = await refundPurchase(transactionId);
    return res.json({ ok: true, refunded });
  }

  res.json({ ok: true, ignored: type || 'unknown' });
});
