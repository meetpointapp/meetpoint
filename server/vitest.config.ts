import { defineConfig } from 'vitest/config';

// İki proje:
//  unit: saf fonksiyonlar, sunucu gerekmez (hızlı)
//  api:  test sunucusuna HTTP/Socket.IO ile senaryo testleri (ayrı test veritabanı)
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'api',
          include: ['test/api/**/*.test.ts'],
          globalSetup: ['test/globalSetup.ts'],
          // Tek test sunucusu ve zamanlamaya bağlı arama testleri: dosyalar sırayla çalışır
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
