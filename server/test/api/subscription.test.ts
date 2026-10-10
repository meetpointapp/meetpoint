// Faz 16: VibeUpMe+ — RevenueCat üzerinden aylık abonelik (gerçek para, mevcut IAP altyapısına
// ek). Tek perk: "seni beğenenler" her zaman açık, jetonla açmaya gerek yok.
// Sunucu şu ayarlarla çalışmalı: REVENUECAT_WEBHOOK_AUTH='Bearer test-webhook-secret'
import { describe, it } from 'vitest';
import http from 'node:http';
import { FAKE_REVENUECAT_PORT } from '../env';
import { B, call, check, registerVerified } from '../helpers';
import { subscription } from '../../src/config';

const AUTH = 'Bearer test-webhook-secret';
const PRODUCT_ID = subscription.productId;

async function hook(event: object) {
  const res = await fetch(`${B}/webhooks/revenuecat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: AUTH },
    body: JSON.stringify({ api_version: '1.0', event }),
  });
  return { status: res.status, ...(await res.json()) };
}

const subEvent = (type: string, userId: string, extra: Record<string, unknown> = {}) => ({
  id: `evt-${Math.random().toString(36).slice(2)}`,
  type,
  app_user_id: userId,
  product_id: PRODUCT_ID,
  ...extra,
});

describe('VibeUpMe+ abonelik (Faz 16)', () => {
  it('RENEWAL/INITIAL_PURCHASE olayı premiumUntil ayarlar, GET /me yansıtır', async () => {
    const u = await registerVerified(`plus1${Date.now()}@test.com`);
    const me0 = await call(u.t, 'GET', '/me');
    check('başlangıçta abone değil', me0.premiumUntil === null);

    const expiresAt = Date.now() + 30 * 24 * 3600_000;
    const r = await hook(subEvent('INITIAL_PURCHASE', u.id, { expiration_at_ms: expiresAt }));
    check('webhook işlendi', r.status === 200 && typeof r.premiumUntil === 'string');

    const me1 = await call(u.t, 'GET', '/me');
    check('GET /me abone olduğunu yansıtır', me1.premiumUntil !== null);
    check('bitiş tarihi doğru', new Date(me1.premiumUntil).getTime() === expiresAt);

    // Yenileme: bitiş tarihi ileri alınır
    const renewedAt = Date.now() + 60 * 24 * 3600_000;
    await hook(subEvent('RENEWAL', u.id, { expiration_at_ms: renewedAt }));
    const me2 = await call(u.t, 'GET', '/me');
    check('yenilemede bitiş tarihi ilerler', new Date(me2.premiumUntil).getTime() === renewedAt);
  });

  it('EXPIRATION aboneliği kapatır; CANCELLATION süre dolana kadar erişimi korur', async () => {
    const u = await registerVerified(`plus2${Date.now()}@test.com`);
    await hook(subEvent('INITIAL_PURCHASE', u.id, { expiration_at_ms: Date.now() + 30 * 24 * 3600_000 }));
    check('abone oldu', (await call(u.t, 'GET', '/me')).premiumUntil !== null);

    // Otomatik yenileme kapatıldı ama süre dolmadı: erişim devam eder
    await hook(subEvent('CANCELLATION', u.id));
    check('iptal sonrası süre dolana kadar hâlâ abone', (await call(u.t, 'GET', '/me')).premiumUntil !== null);

    // Süre gerçekten doldu
    await hook(subEvent('EXPIRATION', u.id));
    check('süre dolunca abonelik biter', (await call(u.t, 'GET', '/me')).premiumUntil === null);
  });

  it('abone "seni beğenenler"i jetonsuz, her zaman açık görür', async () => {
    const a = await registerVerified(`plus3a${Date.now()}@test.com`);
    await call(a.t, 'PUT', '/me/profile', { displayName: 'Plus3a', birthDate: '1996-01-01', gender: 'male', interestedIn: 'female' });
    const b = await registerVerified(`plus3b${Date.now()}@test.com`);
    await call(b.t, 'PUT', '/me/profile', { displayName: 'Plus3b', birthDate: '1996-01-01', gender: 'female', interestedIn: 'male' });
    await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });

    const lockedLikes = await call(a.t, 'GET', '/likes');
    check('abone olmadan kilitli', lockedLikes.unlocked === false && lockedLikes.count === 1);

    await hook(subEvent('INITIAL_PURCHASE', a.id, { expiration_at_ms: Date.now() + 30 * 24 * 3600_000 }));
    const likes = await call(a.t, 'GET', '/likes');
    check('abonelikte otomatik açık', likes.unlocked === true && likes.premium === true);
    check('abonede kullanıcı listesi de gelir', likes.users?.some((u: { id: string }) => u.id === b.id));

    const balBefore = (await call(a.t, 'GET', '/wallet')).balance;
    const unlockResult = await call(a.t, 'POST', '/likes/unlock');
    check('abonede unlock çağrısı jeton harcamaz', unlockResult.unlockedUntil === null);
    check('bakiye değişmedi', (await call(a.t, 'GET', '/wallet')).balance === balBefore);
  });

  it('abone olmayan kullanıcı jetonla açmaya devam eder (mevcut davranış korunur)', async () => {
    const a = await registerVerified(`plus4a${Date.now()}@test.com`);
    await call(a.t, 'PUT', '/me/profile', { displayName: 'Plus4a', birthDate: '1996-01-01', gender: 'male', interestedIn: 'female' });
    const unlocked = await call(a.t, 'POST', '/likes/unlock');
    check('jetonla açma çalışır', unlocked.unlockedUntil !== null);
    const likes = await call(a.t, 'GET', '/likes');
    check('premium false', likes.premium === false);
  });

  it('/wallet/sync webhook kaçırılsa da RevenueCat sunucusundan abonelik durumunu yakalar', async () => {
    const u = await registerVerified(`plus6${Date.now()}@test.com`);
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000);
    const mock = http.createServer((req, res) => {
      const ok = req.headers.authorization === 'Bearer sk_test_local' && req.url?.startsWith('/subscribers/');
      res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' });
      res.end(JSON.stringify(ok ? {
        subscriber: {
          non_subscriptions: {},
          subscriptions: { [PRODUCT_ID]: { expires_date: expiresAt.toISOString() } },
        },
      } : { error: 'unauthorized' }));
    });
    await new Promise<void>((r) => mock.listen(FAKE_REVENUECAT_PORT, () => r()));
    check('senkronizasyondan önce abone değil', (await call(u.t, 'GET', '/me')).premiumUntil === null);
    await call(u.t, 'POST', '/wallet/sync');
    const me = await call(u.t, 'GET', '/me');
    check('senkronizasyon aboneliği yakalar', me.premiumUntil !== null);
    check('bitiş tarihi doğru', new Date(me.premiumUntil).getTime() === expiresAt.getTime());
    mock.close();
  });

  it('dev-subscribe test ucu aboneliği başlatır', async () => {
    const u = await registerVerified(`plus5${Date.now()}@test.com`);
    const r = await call(u.t, 'POST', '/wallet/dev-subscribe');
    check('dev-subscribe başarılı', r.http !== 404 && typeof r.premiumUntil === 'string');
    const me = await call(u.t, 'GET', '/me');
    check('GET /me abone olduğunu yansıtır', me.premiumUntil !== null);
  });
});
