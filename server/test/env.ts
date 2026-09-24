// Test sunucusunun ortamı: geliştirme verisinden tamamen ayrı veritabanı, dosya ve e-posta klasörleri.
// Zamanlamalar kısaltılmıştır (1 "dakika" = 3 sn) ki arama testleri hızlı çalışsın.
export const TEST_PORT = 4010;
export const FAKE_REVENUECAT_PORT = 4100;
// Sahte şifre sızıntısı (HIBP) ve bot doğrulama (Turnstile) servisi: auth testi açar
export const FAKE_SECURITY_PORT = 4101;
// Testlerin kendi geçici PostgreSQL'i (geliştirme veritabanından ayrı, test bitince silinir)
export const TEST_PG_PORT = 5434;

export const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(TEST_PORT),
  DATABASE_URL: `postgresql://meetpoint:meetpoint-dev@localhost:${TEST_PG_PORT}/meetpoint_test`,
  JWT_SECRET: 'test-only-secret-at-least-32-characters-long',
  UPLOAD_DIR: 'test-data/uploads',
  PRIVATE_UPLOAD_DIR: 'test-data/private-uploads',
  DEV_MAIL_DIR: 'test-data/dev-mails',
  RATE_LIMIT_SCALE: '25',
  REVENUECAT_WEBHOOK_AUTH: 'Bearer test-webhook-secret',
  REVENUECAT_SECRET_KEY: 'sk_test_local',
  REVENUECAT_API_BASE: `http://localhost:${FAKE_REVENUECAT_PORT}`,
  CALL_BILLING_SECONDS: '3',
  CALL_RING_SECONDS: '4',
  CALL_DISCONNECT_GRACE_SECONDS: '2',
  // Hata kayıtları testte hızlı yazılsın
  ERROR_FLUSH_MS: '100',
  // Zamanlayıcı testte sık döner: 100 ms tur, liderlik 0,5 sn'de devralınır, bağlantı taraması 1 sn
  SCHEDULER_TICK_MS: '100',
  LEADER_RETRY_MS: '500',
  PRESENCE_SWEEP_MS: '1000',
  // 5651 trafik kaydı partileri testte hızlı yazılsın
  TRAFFIC_FLUSH_MS: '200',
  // Şifre sızıntı kontrolü sahte servise gider (kapalıysa kontrol atlanır, kayıt engellenmez)
  PWNED_API_BASE: `http://localhost:${FAKE_SECURITY_PORT}`,
  // Testte bu servisler kapalı (varsa geliştiricinin .env değerleri devralınmasın)
  TURNSTILE_SECRET: '',
  SMTP_HOST: '',
  FIREBASE_SERVICE_ACCOUNT: '',
  AGORA_APP_ID: '',
  AGORA_APP_CERT: '',
};
