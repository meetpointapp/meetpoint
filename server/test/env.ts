// Test sunucusunun ortamı: geliştirme verisinden tamamen ayrı veritabanı, dosya ve e-posta klasörleri.
// Zamanlamalar kısaltılmıştır (1 "dakika" = 3 sn) ki arama testleri hızlı çalışsın.
export const TEST_PORT = 4010;
export const FAKE_REVENUECAT_PORT = 4100;

export const testEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(TEST_PORT),
  DATABASE_URL: 'file:./test.db?connection_limit=1',
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
  // Testte bu servisler kapalı (varsa geliştiricinin .env değerleri devralınmasın)
  SMTP_HOST: '',
  FIREBASE_SERVICE_ACCOUNT: '',
  AGORA_APP_ID: '',
  AGORA_APP_CERT: '',
};
