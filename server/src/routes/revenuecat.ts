import crypto from 'node:crypto';
import { Router } from 'express';
import { revenueCat } from '../config';
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

  if (type === 'NON_RENEWING_PURCHASE' || type === 'INITIAL_PURCHASE') {
    const store = STORES[String(event.store ?? '')];
    if (!store || !userId || !transactionId) return res.json({ ok: true, ignored: 'missing_fields' });
    const result = await creditPurchase({
      userId,
      productId: String(event.product_id ?? ''),
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
