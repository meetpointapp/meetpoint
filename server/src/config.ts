import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  // Herkese açık olmayan dosyalar (doğrulama selfie'leri): statik olarak sunulmaz
  privateUploadDir: process.env.PRIVATE_UPLOAD_DIR ?? 'private-uploads',
  // SMTP yokken e-postaların yazıldığı klasör (testler ayrı klasör kullanır)
  devMailDir: process.env.DEV_MAIL_DIR ?? 'dev-mails',
  // IP bazlı hız sınırlarının çarpanı: yayında 1; lokalde testler tek IP'den geldiği için gevşek
  rateLimitScale: Number(process.env.RATE_LIMIT_SCALE ?? (process.env.NODE_ENV === 'production' ? 1 : 25)),
  maxPhotos: 6,
  minAge: 18,

  // Yasal metin sürümleri: değişince uygulama kullanıcıdan yeniden onay ister (Faz 11)
  termsVersion: '2026-09-24',
  privacyVersion: '2026-09-24',

  // Sunucunun dışarıdan görünen adresi (e-postadaki indirme bağlantıları için)
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,

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

  // Satış paketleri, bozdurma kuru, en düşük çekim, stopaj, olgunlaşma süresi ve aylık tavan veritabanında
  // (FinanceSettings, CoinPack): panelden değişir. Bkz. src/finance/settings.ts.

  // Teşvikler: e-posta doğrulanınca hediye, ilk satın almada ek jeton. İkisi de "promo" kovasına girer:
  // harcanabilir ama karşı tarafta bozdurulamaz kazanca dönüşür (platform zarar edemez).
  signupBonus: 50,
  firstPurchaseBonusPct: 50,

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
  // Faz 15: Agora ayarlıysa, kabulden sonra iki taraf da gerçekten kanala bu süre içinde katılmalı;
  // katılamazsa arama "bağlantı kurulamadı" sayılıp tüm ücret iade edilir.
  mediaConfirmSeconds: Number(process.env.CALL_MEDIA_CONFIRM_SECONDS ?? 20),
};

// Şifre kuralı: yaygın şifre listesi her zaman; sızıntı veritabanı kontrolü (Have I Been Pwned) açıkken
export const passwordPolicy = {
  breachCheck: process.env.PASSWORD_BREACH_CHECK !== 'off',
  pwnedApiBase: process.env.PWNED_API_BASE ?? 'https://api.pwnedpasswords.com',
};

// Oturumlar: erişim jetonu ömrü ve hareketsizlikte oturumun düşme süresi
export const sessionPolicy = {
  accessTokenSeconds: Number(process.env.ACCESS_TOKEN_SECONDS ?? 15 * 60),
  idleDays: Number(process.env.SESSION_IDLE_DAYS ?? 60),
};

// Kayıtta bot koruması (Cloudflare Turnstile). Gizli anahtar yoksa kapalı.
export const turnstile = {
  secret: process.env.TURNSTILE_SECRET ?? '',
  verifyUrl: process.env.TURNSTILE_VERIFY_URL ?? 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
};

// Cihaz başına hesap sınırı: bir cihazdan son 30 günde en fazla bu kadar hesap açılabilir
export const accountsPerDevice = Number(process.env.ACCOUNTS_PER_DEVICE ?? 3);

// Tarayıcıdan erişime izin verilen adresler (yayında web uygulaması ve panel). Boşsa geliştirmede herkes.
export const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// KVKK (Faz 11): açık rıza metinlerinin sürümleri ve saklama süreleri. Avukat görüşüne göre buradan değiştirilir.
export const privacy = {
  consentVersions: {
    special_category: '2026-09-24',
    overseas_transfer: '2026-09-24',
    selfie: '2026-09-24',
    marketing: '2026-09-25',
    marketing_push: '2026-09-25',
    analytics: '2026-09-25',
  },
  // Yurt dışı aktarım için ayrı rıza iste ("off": standart sözleşme yeterli görülürse kapatılır, herkes izinli sayılır)
  overseasConsentRequired: process.env.OVERSEAS_CONSENT !== 'off',
  // İlgili kişi başvurusu yanıt süresi (KVKK md. 13: en geç 30 gün)
  dsrResponseDays: 30,
};

export const retention = {
  deletionGraceDays: Number(process.env.DELETION_GRACE_DAYS ?? 30), // silme talebinden kalıcı silmeye
  inactiveDays: Number(process.env.INACTIVE_DAYS ?? 730), // bu kadar gün girilmeyen hesap silinir
  inactiveWarnDays: 30, // silmeden bu kadar gün önce e-posta uyarısı
  exportTtlDays: 7, // indirme bağlantısının geçerliliği
  exportCooldownDays: 30, // "verilerimi indir" ayda bir
  closedSessionDays: 30, // kapanmış/süresi dolmuş oturum kayıtları
  emailCodeDays: 1, // kullanılmış/süresi dolmuş e-posta kodları
  unopenedViewOnceDays: 30, // açılmamış tek seferlik fotoğraflar
  resolvedErrorDays: 180, // çözülmüş hata kayıtları
  trafficLogDays: Number(process.env.TRAFFIC_LOG_DAYS ?? 730), // 5651 trafik kayıtları (2 yıl)
  supportClosedDays: 730, // kapanmış destek talepleri (tüketici şikayeti kanıtı: 2 yıl)
  intervalMs: Number(process.env.RETENTION_INTERVAL_MS ?? 60 * 60_000), // imha işi ne sıklıkla çalışır
};

// Tüketici ve destek (Faz 14)
export const consumer = {
  // Ön bilgilendirme + mesafeli satış sözleşmesi + cayma hakkı istisnası metinlerinin sürümü.
  // Değişince kullanıcı bir sonraki satın almadan önce yeniden onaylar.
  salesTermsVersion: '2026-09-25',
  supportFirstResponseHours: Number(process.env.SUPPORT_SLA_HOURS ?? 48), // ilk yanıt hedefi
  supportMaxOpenTickets: 5, // aynı anda açık talep sınırı (kötüye kullanıma karşı)
  // Mağaza incelemesi için demo hesabın e-postası (scripts/review-account.ts)
  reviewAccountEmail: process.env.REVIEW_ACCOUNT_EMAIL ?? 'review@meetpoint.app',
};

// Zamanlayıcı (scheduler.ts): tur aralığı, liderlik deneme aralığı, bağlantı taraması aralığı
export const scheduler = {
  tickMs: Number(process.env.SCHEDULER_TICK_MS ?? 1000),
  leaderRetryMs: Number(process.env.LEADER_RETRY_MS ?? 5000),
  presenceSweepMs: Number(process.env.PRESENCE_SWEEP_MS ?? 10_000),
  // "off": bu sunucu liderliğe hiç aday olmaz (ör. sadece API hizmeti veren ek sunucu)
  enabled: process.env.SCHEDULER !== 'off',
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
  if (!process.env.FIELD_ENCRYPTION_KEY) problems.push('FIELD_ENCRYPTION_KEY yok: IBAN ve 2FA anahtarları şifrelenemez');
  if (!process.env.MEDIA_URL_SECRET) problems.push('MEDIA_URL_SECRET yok: fotoğraf adresleri imzalanamaz');
  if (!process.env.PUBLIC_URL) problems.push('PUBLIC_URL yok: e-postadaki veri indirme bağlantıları çalışmaz');
  if (corsOrigins.length === 0) problems.push('CORS_ORIGINS yok: hangi web adreslerine izin verileceği belirtilmeli');
  if (problems.length) {
    throw new Error(`Yayın ayarları eksik:\n- ${problems.join('\n- ')}`);
  }
  if (!agora.appId) console.warn('UYARI: AGORA_APP_ID yok, aramalar test modunda (ses/görüntü yok)');
  if (!firebaseServiceAccount) console.warn('UYARI: FIREBASE_SERVICE_ACCOUNT yok, push bildirimleri kapalı');
  if (!turnstile.secret) console.warn('UYARI: TURNSTILE_SECRET yok, kayıtta bot koruması kapalı');
}
