import http2 from 'node:http2';
import jwt from 'jsonwebtoken';

// Faz 15 · yerel gelen arama ekranı (iOS). Normal FCM bildirimleri uygulama kapalıyken iOS'u
// güvenilir şekilde uyandırmaz; CallKit'in gerektirdiği PushKit (VoIP push), Apple'ın ayrı bir
// APNs uç noktasından (apns-push-type: voip) gönderilir. Token tabanlı kimlik doğrulama (.p8
// anahtar) kullanılır: sertifika dosyası gerekmez. Ayarlı değilse sessizce hiçbir şey yapmaz
// (aynı agora.appId gibi — gerçek Apple hesabı Faz 17'de açılınca devreye girer).
export const voip = {
  keyId: process.env.APNS_KEY_ID ?? '',
  teamId: process.env.APNS_TEAM_ID ?? '',
  // .p8 anahtar dosyasının İÇERİĞİ (PEM), dosya yolu değil — ortam değişkenine \n kaçışlarıyla girilir
  authKey: (process.env.APNS_AUTH_KEY ?? '').replace(/\\n/g, '\n'),
  bundleId: process.env.APNS_BUNDLE_ID ?? '',
  // Geliştirme sertifikası mı, yayın mı (farklı APNs sunucusu)
  production: process.env.APNS_PRODUCTION === 'true',
};

export const voipConfigured = () => !!(voip.keyId && voip.teamId && voip.authKey && voip.bundleId);

let cachedToken: { token: string; exp: number } | null = null;

// APNs sağlayıcı JWT'si en fazla 1 saat geçerli; yeniden kullanmak için 50 dakikada bir yenilenir
function providerToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now) return cachedToken.token;
  const token = jwt.sign({ iss: voip.teamId, iat: now }, voip.authKey, { algorithm: 'ES256', keyid: voip.keyId });
  cachedToken = { token, exp: now + 50 * 60 };
  return token;
}

// Gelen arama için VoIP push gönderir. Uygulama bunu PushKit ile sessizce alır ve CallKit'e
// bildirir (kullanıcıya görünen bir bildirim metni YOKTUR, apns-push-type: voip böyle çalışır).
export async function sendVoipPush(deviceToken: string, payload: { id: string; nameCaller: string; handle: string; isVideo: boolean }) {
  if (!voipConfigured()) return false;
  const host = voip.production ? 'api.push.apple.com' : 'api.development.push.apple.com';
  const client = http2.connect(`https://${host}`);
  try {
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken()}`,
      'apns-topic': `${voip.bundleId}.voip`,
      'apns-push-type': 'voip',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
    });
    req.write(JSON.stringify(payload));
    req.end();
    const ok = await new Promise<boolean>((resolve) => {
      req.on('response', (headers) => resolve(headers[':status'] === 200));
      req.on('error', () => resolve(false));
    });
    return ok;
  } finally {
    client.close();
  }
}
