// Faz 25 duman testi: Redis kurulumunu sunucuda doğrular.   REDIS_URL=redis://... npm run redis:check
//   1) bağlantı  2) hız sınırı sayacı (rate-limit-redis)  3) çevrimiçi ZSET (ZMSCORE, Redis 6.2+)
//   4) iki ayrı Socket.IO sunucusu arasında olay iletimi (@socket.io/redis-adapter)
// Hepsi geçmeden yayına çıkmayın: Redis yoksa ya da sürümü eskiyse hangi adımda takıldığı yazılır.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';

const url = process.env.REDIS_URL;
if (!url) {
  console.error('REDIS_URL tanımlı değil');
  process.exit(1);
}

let failed = 0;
const ok = (label: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ` ${extra}` : ''}`);
  if (!cond) failed++;
};

async function main() {
  const redis = new Redis(url!, { maxRetriesPerRequest: 2 });
  const prefix = `vibeupme:check:${Date.now()}:`;

  // 1) bağlantı + sürüm
  const info = await redis.info('server');
  const version = /redis_version:(\S+)/.exec(info)?.[1] ?? '?';
  ok('Redis bağlantısı', (await redis.ping()) === 'PONG', `(sürüm ${version})`);
  const [major, minor] = version.split('.').map(Number);
  ok('Sürüm 6.2 veya üstü (ZMSCORE için)', major > 6 || (major === 6 && minor >= 2));

  // 2) hız sınırı sayacı
  const store = new RedisStore({ prefix: `${prefix}rl:`, sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<never> });
  store.init({ windowMs: 60_000 } as never);
  await store.increment('ip1');
  await store.increment('ip1');
  const third = await store.increment('ip1');
  ok('Hız sınırı sayacı artıyor', third.totalHits === 3, `(${third.totalHits})`);
  await store.resetKey('ip1');
  const again = await store.increment('ip1');
  ok('Sayaç sıfırlanıyor', again.totalHits === 1);
  await store.resetKey('ip1');

  // 3) çevrimiçi ZSET
  const key = `${prefix}presence`;
  await redis.zadd(key, Date.now(), 'u1');
  const scores = await redis.zmscore(key, 'u1', 'u2');
  ok('ZMSCORE: var olan skor, olmayan null', scores[0] !== null && scores[1] === null);
  await redis.del(key);

  // 4) iki Socket.IO sunucusu arasında olay iletimi
  const make = async () => {
    const http = createServer();
    const io = new Server(http);
    io.adapter(createAdapter(redis, redis.duplicate(), { key: `${prefix}io` }));
    await new Promise<void>((r) => http.listen(0, r));
    return { http, io, port: (http.address() as AddressInfo).port };
  };
  const a = await make();
  const b = await make();
  b.io.on('connection', (s) => s.join('user:x'));
  const client = connect(`http://localhost:${b.port}`, { transports: ['websocket'] });
  await new Promise<void>((r) => client.on('connect', () => r()));
  await new Promise((r) => setTimeout(r, 300));
  const got = new Promise<boolean>((resolve) => {
    client.on('merhaba', () => resolve(true));
    setTimeout(() => resolve(false), 3000);
  });
  a.io.to('user:x').emit('merhaba', {}); // A sunucusundan gönder, istemci B'ye bağlı
  ok('Socket.IO: olay sunucular arasında iletiliyor', await got);
  const sockets = await a.io.in('user:x').fetchSockets();
  ok('Socket.IO: fetchSockets tüm sunucuları görüyor', sockets.length === 1, `(${sockets.length})`);

  client.close();
  await a.io.close();
  await b.io.close();
  await redis.quit();
}

main()
  .catch((e) => {
    console.error('HATA:', e);
    failed++;
  })
  .finally(() => {
    console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
    process.exit(failed ? 1 : 0);
  });
