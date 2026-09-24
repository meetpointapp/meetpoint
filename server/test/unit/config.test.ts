import { afterEach, describe, expect, it, vi } from 'vitest';

// config.ts ortam değişkenlerini yüklenirken okur: her testte modül yeniden yüklenir
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return import('../../src/config');
}

describe('yayın ayar kontrolü', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('geliştirmede eksik ayar sorun değil', async () => {
    const { assertProductionConfig } = await loadConfig({ NODE_ENV: 'development', SMTP_HOST: '' });
    expect(() => assertProductionConfig()).not.toThrow();
  });

  it('yayında zorunlu ayarlar eksikse sunucu açılmaz ve eksikler listelenir', async () => {
    const { assertProductionConfig } = await loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'kisa',
      SMTP_HOST: '',
      REVENUECAT_WEBHOOK_AUTH: '',
    });
    expect(() => assertProductionConfig()).toThrow(/JWT_SECRET[\s\S]*SMTP_HOST[\s\S]*REVENUECAT_WEBHOOK_AUTH[\s\S]*FIELD_ENCRYPTION_KEY/);
  });

  it('yayında tüm zorunlu ayarlar varsa açılır', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { assertProductionConfig } = await loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'x'.repeat(40),
      SMTP_HOST: 'smtp.example.com',
      REVENUECAT_WEBHOOK_AUTH: 'Bearer secret',
      FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      MEDIA_URL_SECRET: 'm'.repeat(40),
      CORS_ORIGINS: 'https://admin.meetpoint.app',
      PUBLIC_URL: 'https://api.meetpoint.app',
    });
    expect(() => assertProductionConfig()).not.toThrow();
    warn.mockRestore();
  });

  it('yayında IP hız sınırı çarpanı 1, geliştirmede gevşek', async () => {
    expect((await loadConfig({ NODE_ENV: 'production', RATE_LIMIT_SCALE: undefined })).config.rateLimitScale).toBe(1);
    expect((await loadConfig({ NODE_ENV: 'development', RATE_LIMIT_SCALE: undefined })).config.rateLimitScale).toBe(25);
  });
});
