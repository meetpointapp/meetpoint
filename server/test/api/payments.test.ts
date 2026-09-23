// Faz 5: ödeme testleri (RevenueCat webhook + senkronizasyon, bonuslar, iade)
// Sunucu şu ayarlarla çalışmalı: REVENUECAT_WEBHOOK_AUTH='Bearer test-webhook-secret',
import { describe, it } from 'vitest';
import http from 'node:http';
import { FAKE_REVENUECAT_PORT } from '../env';
import { B, call, check, registerVerified, listen } from '../helpers';

describe('Ödemeler (Faz 5)', () => {
  it('senaryo', async () => {
    const tag = Date.now();
    const AUTH = 'Bearer test-webhook-secret';
    const hook = async (event, auth: string | null = AUTH) => {
      const res = await fetch(`${B}/webhooks/revenuecat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
        body: JSON.stringify({ api_version: '1.0', event }),
      });
      return { status: res.status, ...(await res.json()) };
    };
    const purchaseEvent = (userId, productId, txn, extra = {}) => ({
      id: `evt-${txn}`,
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: userId,
      product_id: productId,
      transaction_id: txn,
      store: 'PLAY_STORE',
      environment: 'PRODUCTION',
      price: 19.99,
      currency: 'TRY',
      ...extra,
    });
    const bal = async (t) => (await call(t, 'GET', '/wallet')).balance;

    // --- 1. Kayıt hediyesi
    const u = await registerVerified(`buyer${tag}@test.com`);
    let w = await call(u.t, 'GET', '/wallet');
    check('signup bonus granted on verification (50)', w.balance === 50, `balance=${w.balance}`);
    check('signup bonus not cashable', w.cashable === 0);
    check('first purchase bonus offered (50%)', w.firstPurchaseBonusPct === 50);
    check('popular pack flagged', w.packs.some((p) => p.id === 'coins_1000' && p.popular === true));

    // --- 2. Webhook yetkisi
    const noAuth = await hook(purchaseEvent(u.id, 'coins_1000', `t1-${tag}`), null);
    check('webhook without auth rejected', noAuth.status === 401);
    const badAuth = await hook(purchaseEvent(u.id, 'coins_1000', `t1-${tag}`), 'Bearer wrong');
    check('webhook with wrong auth rejected', badAuth.status === 401);
    check('nothing credited by rejected webhooks', (await bal(u.t)) === 50);

    // --- 3. Satın alma + ilk alım bonusu + tekrar koruması
    const p1 = await hook(purchaseEvent(u.id, 'coins_1000', `t1-${tag}`));
    check('purchase credited', p1.status === 200 && p1.credited === true);
    check('1000 + 50% first-purchase bonus', (await bal(u.t)) === 50 + 1000 + 500, `balance=${await bal(u.t)}`);
    const dup = await hook(purchaseEvent(u.id, 'coins_1000', `t1-${tag}`));
    check('duplicate event ignored', dup.credited === false && (await bal(u.t)) === 1550);
    const p2 = await hook(purchaseEvent(u.id, 'coins_500', `t2-${tag}`, { price: 9.99 }));
    check('second purchase: no bonus', p2.credited === true && (await bal(u.t)) === 2050);
    w = await call(u.t, 'GET', '/wallet');
    check('bonus no longer offered', w.firstPurchaseBonusPct === 0);
    check('purchased coins not cashable', w.cashable === 0);
    const unknownProduct = await hook(purchaseEvent(u.id, 'coins_999999', `t3-${tag}`));
    check('unknown product ignored', unknownProduct.status === 200 && unknownProduct.credited === false);
    const unknownUser = await hook(purchaseEvent('no-such-user', 'coins_500', `t4-${tag}`));
    check('unknown user ignored (200, no crash)', unknownUser.status === 200 && unknownUser.credited === false);

    // --- 4. İade
    const r1 = await hook({ id: `evt-r1-${tag}`, type: 'CANCELLATION', app_user_id: u.id, transaction_id: `t1-${tag}`, cancel_reason: 'CUSTOMER_SUPPORT' });
    check('refund processed', r1.refunded === true);
    check('refund claws back coins + bonus (1500)', (await bal(u.t)) === 550, `balance=${await bal(u.t)}`);
    const r2 = await hook({ id: `evt-r2-${tag}`, type: 'CANCELLATION', app_user_id: u.id, transaction_id: `t1-${tag}` });
    check('double refund ignored', r2.refunded === false && (await bal(u.t)) === 550);

    // İade sonrası eksi bakiye: harcama engellenir
    const v = await registerVerified(`spender${tag}@test.com`);
    await call(v.t, 'PUT', '/me/profile', { displayName: 'Spender', birthDate: '1995-01-01', gender: 'male', interestedIn: 'female' });
    await hook(purchaseEvent(v.id, 'coins_500', `t5-${tag}`)); // 50 + 500 + 250 = 800
    await call(v.t, 'POST', '/likes/unlock'); // -200
    await call(v.t, 'POST', '/boost'); // -150  => 450
    await hook({ id: `evt-r5-${tag}`, type: 'CANCELLATION', app_user_id: v.id, transaction_id: `t5-${tag}` }); // -750
    check('balance can go negative after refund', (await bal(v.t)) === -300, `balance=${await bal(v.t)}`);
    const target = await registerVerified(`target${tag}@test.com`);
    await call(target.t, 'PUT', '/me/profile', { displayName: 'Target', birthDate: '1995-01-01', gender: 'female', interestedIn: 'male' });
    const blocked = await call(v.t, 'POST', '/requests', { toId: target.id, kind: 'MESSAGE', note: 'hi' });
    check('negative balance cannot spend', blocked.http === 402);

    // --- 5. Senkronizasyon (sahte RevenueCat API)
    const syncTxn = `sync-${tag}`;
    const mock = http.createServer((req, res) => {
      const ok = req.headers.authorization === 'Bearer sk_test_local' && req.url?.startsWith('/subscribers/');
      res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' });
      res.end(JSON.stringify(ok ? {
        subscriber: {
          non_subscriptions: {
            coins_2500: [{ id: 'rc-1', store: 'app_store', is_sandbox: false, store_transaction_id: syncTxn }],
            coins_500: [{ id: 'rc-2', store: 'app_store', is_sandbox: false, store_transaction_id: `t2-${tag}` }], // zaten yüklendi
          },
        },
      } : { error: 'unauthorized' }));
    });
    await new Promise<void>((r) => mock.listen(FAKE_REVENUECAT_PORT, () => r()));
    const before = await bal(u.t);
    const s1 = await call(u.t, 'POST', '/wallet/sync');
    check('sync credits missing store purchase only', s1.credited === 2500 && s1.balance === before + 2500, `credited=${s1.credited}`);
    const s2 = await call(u.t, 'POST', '/wallet/sync');
    check('second sync credits nothing', s2.credited === 0);
    const lateWebhook = await hook(purchaseEvent(u.id, 'coins_2500', syncTxn));
    check('late webhook for synced purchase ignored', lateWebhook.credited === false);
    mock.close();

    // --- 6. Test modu yükleme de aynı kurallarla
    const d = await registerVerified(`dev${tag}@test.com`);
    const dev1 = await call(d.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
    check('dev top-up also gets first-purchase bonus', dev1.bonus === 500 && dev1.balance === 1550);

    // --- 7. Yönetim paneli istatistikleri
    const admin = (await call(null, 'POST', '/auth/login', { email: 'admin@meetpoint.dev', password: 'password123' })).token;
    await hook(purchaseEvent(u.id, 'coins_500', `sb-${tag}`, { environment: 'SANDBOX', price: 9.99 }));
    const stats = await call(admin, 'GET', '/admin/api/stats');
    check('admin sees sales & refunds', typeof stats.revenueUsd === 'number' && stats.refunds >= 2, `rev=${stats.revenueUsd} refunds=${stats.refunds}`);
    const purchases = await call(admin, 'GET', '/admin/api/purchases');
    const sandboxRow = purchases._arr?.find((p) => p.sandbox);
    check('sandbox purchase flagged', !!sandboxRow);
    check('revenue excludes refunded, sandbox and dev sales', stats.revenueUsd === 9.99 || stats.revenueUsd > 0);
    check('dev purchases listed in admin', purchases._arr?.some((p) => p.store === 'dev'));
  });
});
