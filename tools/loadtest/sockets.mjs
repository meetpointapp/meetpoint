// Faz 25 yük testi (Socket.IO): çok sayıda eşzamanlı açık bağlantıyı ve olay iletim süresini ölçer.
// Hazırlık: cd server && npm run load:users -- 5000
// Çalıştır:  node tools/loadtest/sockets.mjs https://staging-api.vibeupme.com 5000
// (socket.io-client için: cd server && npm i yeterli; betik server/node_modules'tan okur)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.resolve('server/package.json'));
const { io } = require('socket.io-client');

const BASE = process.argv[2] ?? 'http://localhost:4000';
const COUNT = Number(process.argv[3] ?? 1000);
const tokens = JSON.parse(fs.readFileSync(new URL('./tokens.json', import.meta.url)));
if (tokens.length < COUNT) throw new Error(`tokens.json'da ${tokens.length} hesap var, ${COUNT} istendi`);

let connected = 0;
let failed = 0;
const connectMs = [];
const sockets = [];
const started = Date.now();

// Bağlantıları dalga dalga aç (saniyede ~200): gerçek kullanıcılar da aynı anda gelmez
for (let i = 0; i < COUNT; i++) {
  const t0 = performance.now();
  const s = io(BASE, { transports: ['websocket'], auth: { token: tokens[i].token }, reconnection: false });
  s.on('connect', () => {
    connected++;
    connectMs.push(performance.now() - t0);
  });
  s.on('connect_error', () => failed++);
  sockets.push(s);
  if (i % 200 === 199) await new Promise((r) => setTimeout(r, 1000));
}

const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)] ?? 0;
const report = () =>
  console.log(
    `bağlı ${connected}/${COUNT}  hata ${failed}  bağlanma p50 ${pct(connectMs, 0.5).toFixed(0)} ms  p95 ${pct(connectMs, 0.95).toFixed(0)} ms  süre ${((Date.now() - started) / 1000).toFixed(0)} sn`,
  );
const timer = setInterval(report, 5000);

// Bağlantılar açık kalsın: Ctrl+C ile ya da HOLD sn sonra kapanır
await new Promise((r) => setTimeout(r, Number(process.env.HOLD ?? 60) * 1000));
clearInterval(timer);
report();
for (const s of sockets) s.close();
process.exit(failed > COUNT * 0.01 ? 1 : 0);
