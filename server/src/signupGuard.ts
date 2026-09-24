import { accountsPerDevice, turnstile } from './config';
import { HttpError, prisma } from './db';

// Kayıtta sahte hesap çiftliğine karşı iki katman:
// 1) Cloudflare Turnstile (görünmez bot doğrulaması). TURNSTILE_SECRET yoksa kapalı.
// 2) Cihaz başına hesap sınırı: aynı cihazdan son 30 günde en fazla N hesap (X-Device-Id).

export async function verifyCaptcha(token: string | undefined, ip: string | undefined) {
  if (!turnstile.secret) return;
  if (!token) throw new HttpError(400, 'captcha_required');
  let ok = false;
  try {
    const body = new URLSearchParams({ secret: turnstile.secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch(turnstile.verifyUrl, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    ok = res.ok && ((await res.json()) as { success?: boolean }).success === true;
  } catch (e) {
    // Doğrulama servisine ulaşılamazsa kayıt reddedilir (bot koruması açıkken kapıyı açık bırakmayız)
    console.error('turnstile', e);
    throw new HttpError(503, 'captcha_unavailable');
  }
  if (!ok) throw new HttpError(400, 'captcha_failed');
}

export async function assertDeviceQuota(deviceId: string) {
  if (!deviceId) return;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const count = await prisma.user.count({ where: { registeredDeviceId: deviceId, createdAt: { gte: since } } });
  if (count >= accountsPerDevice) throw new HttpError(429, 'too_many_accounts');
}
