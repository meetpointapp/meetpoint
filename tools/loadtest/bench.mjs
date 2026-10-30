// Basit HTTP yük ölçümü (k6 olmadan): node tools/loadtest/bench.mjs <eşzamanlı> <saniye> <yol>  (Git Bash: MSYS_NO_PATHCONV=1)
// Önce: cd server && npm run load:users -- 300
import fs from 'node:fs';
const tokens = JSON.parse(fs.readFileSync('tools/loadtest/tokens.json'));
const conc = Number(process.argv[2] ?? 30), secs = Number(process.argv[3] ?? 10);
const lat = []; let err = 0; const end = Date.now() + secs * 1000;
await Promise.all(Array.from({ length: conc }, async (_, w) => {
  let i = w;
  while (Date.now() < end) {
    const t0 = performance.now();
    try { const r = await fetch('http://localhost:4000'+(process.argv[4]??'/discover'), { headers: { Authorization: `Bearer ${tokens[i % tokens.length].token}` } }); await r.arrayBuffer(); if (r.status !== 200) err++; } catch { err++; }
    lat.push(performance.now() - t0); i += conc;
  }
}));
lat.sort((a, b) => a - b);
console.log(`eşzamanlı ${conc}: ${(lat.length / secs).toFixed(0)} istek/sn, p50 ${lat[Math.floor(lat.length*.5)].toFixed(0)} ms, p95 ${lat[Math.floor(lat.length*.95)].toFixed(0)} ms, hata ${err}`);
