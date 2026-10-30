import { Redis } from 'ioredis';
import './config'; // .env yüklensin

// Faz 25 (ölçek): REDIS_URL tanımlıysa hız sınırlayıcı sayaçları, Socket.IO adaptörü ve çevrimiçi durumu
// Redis'te tutulur. Tanımlı değilse (geliştirme, tek sunucu) eski davranış korunur: sayaçlar ve anlık
// olaylar PostgreSQL üzerinden gider. Böylece Redis zorunlu bir bağımlılık değil, ölçeklenince açılan bir hızlandırıcıdır.
//
//   REDIS_URL=redis://127.0.0.1:6379      (şifreli: redis://:parola@host:6379, TLS: rediss://...)
export const redis: Redis | null = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      // Redis geçici kapanırsa istekler sonsuza dek beklemesin
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    })
  : null;

redis?.on('error', (e: Error) => console.error('[redis]', e.message));

export async function closeRedis() {
  await redis?.quit().catch(() => {});
}
