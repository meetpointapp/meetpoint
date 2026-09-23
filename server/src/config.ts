import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  // Herkese açık olmayan dosyalar (doğrulama selfie'leri): statik olarak sunulmaz
  privateUploadDir: process.env.PRIVATE_UPLOAD_DIR ?? 'private-uploads',
  maxPhotos: 6,
  minAge: 18,

  // Kullanım koşulları sürümü: metin değişince artırılır, kullanıcıdan yeniden onay istenebilir
  termsVersion: '2026-09-22',

  // E-posta kodları
  codeTtlMinutes: 10,
  codeMaxAttempts: 5,
  codeResendCooldownSec: 60,

  // SMTP ayarlı değilse e-postalar dev-mails/ klasörüne yazılır ve konsola basılır
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'MeetPoint <no-reply@meetpoint.app>',
  },
};

// Ekonomi ayarları. Gelir sadece jeton satışından: kullanıcılar arası transferde
// kesinti yok; kâr, satış fiyatı ile bozdurma kuru arasındaki farktan gelir.
export const economy = {
  // İletişim isteği fiyatları (jeton). Aramalar istek değil, dakika başı ücretlidir (callRates).
  requestPrices: {
    MESSAGE: 50,
  } as Record<(typeof REQUEST_KINDS)[number], number>,

  // Arama: dakika başı jeton (dakikanın başında peşin alınır, tamamı arananın hesabına geçer)
  callRates: { VOICE: 15, VIDEO: 30 } as Record<CallKind, number>,

  // Arama içi hediyeler (jetonun tamamı alıcıya geçer)
  gifts: [
    { id: 'rose', emoji: '🌹', coins: 20 },
    { id: 'heart', emoji: '❤️', coins: 50 },
    { id: 'teddy', emoji: '🧸', coins: 100 },
    { id: 'diamond', emoji: '💎', coins: 250 },
  ],

  // Cevaplanmayan istek bu süre sonunda düşer ve jeton iade edilir
  requestTtlHours: 24,

  // Satış paketleri. id = mağazadaki ürün kimliği (App Store / Google Play / RevenueCat).
  // usd yalnızca referans: kullanıcı mağazanın yerel fiyatını görür.
  coinPacks: [
    { id: 'coins_500', coins: 500, usd: 9.99, popular: false },
    { id: 'coins_1000', coins: 1000, usd: 19.99, popular: true },
    { id: 'coins_2500', coins: 2500, usd: 44.99, popular: false },
    { id: 'coins_6000', coins: 6000, usd: 99.99, popular: false },
  ],

  // Teşvikler: e-posta doğrulanınca hediye (bozdurulamaz), ilk satın almada ek jeton
  signupBonus: 50,
  firstPurchaseBonusPct: 50,

  // Bozdurma kuru: kazanılan 1 jeton = 0.01 USD (satış ~0.02 USD).
  // Mağaza %15-30 kestiği için bu fark kârlılık için zorunlu.
  cashoutUsdPerCoin: 0.01,
  // En az bu kadar kazanılmış jeton birikince para çekilebilir (2000 jeton = $20)
  cashoutMinCoins: 2000,

  // Jetonla alınan özellikler (jeton kimseye geçmez: tamamı gelir)
  superLikePrice: 30,
  boostPrice: 150,
  boostMinutes: 30,
  likesUnlockPrice: 200,
  likesUnlockHours: 24,
};

// Firebase push: servis hesabı JSON dosyasının yolu. Boşsa bildirimler konsola yazılır.
export const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ?? '';

// RevenueCat: webhook yetki başlığı (panelde tanımlanan değer) ve REST API gizli anahtarı.
// Boşsa webhook kapalıdır; geliştirmede test yükleme ucu kullanılır.
export const revenueCat = {
  webhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH ?? '',
  secretKey: process.env.REVENUECAT_SECRET_KEY ?? '',
  apiBase: process.env.REVENUECAT_API_BASE ?? 'https://api.revenuecat.com/v1',
};

// Agora (ses/görüntü). Boşsa aramalar "simülasyon modunda" çalışır: akış ve ücretlendirme
// gerçek, ama ses/görüntü aktarılmaz (geliştirme ve test için).
export const agora = {
  appId: process.env.AGORA_APP_ID ?? '',
  appCertificate: process.env.AGORA_APP_CERT ?? '',
};

// Arama zamanlamaları (testlerde kısaltılabilir)
export const callTiming = {
  billingSeconds: Number(process.env.CALL_BILLING_SECONDS ?? 60), // dakika uzunluğu
  ringSeconds: Number(process.env.CALL_RING_SECONDS ?? 45), // cevapsız sayılma süresi
  disconnectGraceSeconds: Number(process.env.CALL_DISCONNECT_GRACE_SECONDS ?? 20),
};

// Sesli/görüntülü istekler eskiden istek üzerinden fiyatlanıyordu; yeni istek sadece MESSAGE.
// Eski kayıtlar (VOICE/VIDEO) okunabilir kalır.
export const REQUEST_KINDS = ['MESSAGE'] as const;
export type RequestKind = 'MESSAGE' | 'VOICE' | 'VIDEO';

export const CALL_KINDS = ['VOICE', 'VIDEO'] as const;
export type CallKind = (typeof CALL_KINDS)[number];

// Yayında eksik veya güvensiz ayarla açılmayı engelle (geliştirmede sadece uyarı yok)
export function assertProductionConfig() {
  if (!config.isProduction) return;
  const problems: string[] = [];
  if (!process.env.JWT_SECRET || config.jwtSecret.length < 32) problems.push('JWT_SECRET en az 32 karakter olmalı');
  if (!config.smtp.host) problems.push('SMTP_HOST yok: doğrulama kodları e-postayla gidemez');
  if (!revenueCat.webhookAuth) problems.push('REVENUECAT_WEBHOOK_AUTH yok: satın alımlar jetona dönüşmez');
  if (problems.length) {
    throw new Error(`Yayın ayarları eksik:\n- ${problems.join('\n- ')}`);
  }
  if (!agora.appId) console.warn('UYARI: AGORA_APP_ID yok, aramalar test modunda (ses/görüntü yok)');
  if (!firebaseServiceAccount) console.warn('UYARI: FIREBASE_SERVICE_ACCOUNT yok, push bildirimleri kapalı');
}
