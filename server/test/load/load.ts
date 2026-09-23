// Yük ve eşzamanlılık testi: npm run test:load
// Ayrı test sunucusu ve veritabanı üzerinde çok sayıda kullanıcıyla kayıt, keşfet, eşleşme,
// mesajlaşma ve arama senaryolarını eşzamanlı çalıştırır. Hız (p50/p95) ölçer ve para tutarlılığını
// denetler: aynı anda gelen harcamalar bakiyeyi eksiye düşürmemeli, arama ücretleri kuruşu kuruşuna
// taraflar arasında el değiştirmeli.
//
// Ayarlar (ortam değişkeni): LOAD_USERS (200), LOAD_CALL_PAIRS (40), LOAD_MESSAGES (10)
import fs from 'node:fs';
import path from 'node:path';
import { testEnv } from '../env';

const USERS = Number(process.env.LOAD_USERS ?? 200);
const CALL_PAIRS = Number(process.env.LOAD_CALL_PAIRS ?? 40);
const MESSAGES = Number(process.env.LOAD_MESSAGES ?? 10);

// Tek IP'den yüzlerce kayıt: IP hız sınırları bu test için gevşetilir (kullanıcı bazlı sınırlar aynen geçerli)
testEnv.RATE_LIMIT_SCALE = '1000';

type Stat = { name: string; ms: number[]; errors: number };
const stats = new Map<string, Stat>();
const failures: string[] = [];

function record(name: string, ms: number, ok: boolean) {
  const s = stats.get(name) ?? { name, ms: [], errors: 0 };
  stats.set(name, s);
  s.ms.push(ms);
  if (!ok) s.errors++;
}

async function timed<T>(name: string, fn: () => Promise<T>, ok: (r: T) => boolean = () => true): Promise<T> {
  const t = performance.now();
  try {
    const r = await fn();
    record(name, performance.now() - t, ok(r));
    return r;
  } catch (e) {
    record(name, performance.now() - t, false);
    throw e;
  }
}

// En fazla `limit` iş aynı anda
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

function expectTrue(cond: boolean, msg: string) {
  if (!cond) failures.push(msg);
}

async function main() {
  const { setup, teardown } = await import('../globalSetup');
  const c = await import('../client');
  console.log(`Test sunucusu hazırlanıyor... (${USERS} kullanıcı, ${CALL_PAIRS} arama çifti, çift başı ${MESSAGES} mesaj)`);
  await setup();
  const started = Date.now();
  const sockets: { s: { disconnect: () => void } }[] = [];
  try {
    // 1. Kayıt + profil + fotoğraf
    const users = await pool(Array.from({ length: USERS }, (_, i) => i), 20, (i) =>
      timed('Kayıt + doğrulama + profil + foto', () =>
        c.makeUser(`Load${i}`, i % 2 === 0 ? 'male' : 'female', i % 2 === 0 ? 'female' : 'male'),
      ),
    );

    // 2. Anlık bağlantılar
    const live = await pool(users, 50, (u) => timed('Socket bağlantısı', () => c.listen(u.t)));
    sockets.push(...live);

    // 3. Keşfet
    await pool(users, 50, (u) => timed('GET /discover', () => c.call(u.t, 'GET', '/discover'), (r) => r.http === 200));

    // 4. Eşleşmeler (0-1, 2-3, ...)
    const pairs: { a: number; b: number; conv: string }[] = [];
    await pool(Array.from({ length: Math.floor(USERS / 2) }, (_, k) => k), 50, async (k) => {
      const a = 2 * k;
      const b = a + 1;
      await timed('POST /swipes', () => c.call(users[a].t, 'POST', '/swipes', { toId: users[b].id, direction: 'like' }), (r) => r.http < 300);
      const m = await timed('POST /swipes', () => c.call(users[b].t, 'POST', '/swipes', { toId: users[a].id, direction: 'like' }), (r) => r.http < 300);
      expectTrue(m.match === true, `çift ${k} eşleşmedi`);
      if (m.conversationId) pairs.push({ a, b, conv: m.conversationId });
    });

    // 5. Mesajlaşma: gönderim süresi ve karşı tarafa ulaşma gecikmesi
    const sentAt = new Map<string, number>();
    live.forEach((l) =>
      (l.s as unknown as { on: (e: string, f: (p: { body: string }) => void) => void }).on('message:new', (p) => {
        const t0 = sentAt.get(p.body);
        if (t0 !== undefined) record('Mesaj ulaşma gecikmesi (socket)', performance.now() - t0, true);
      }),
    );
    const jobs = pairs.flatMap((p) => Array.from({ length: MESSAGES }, (_, j) => ({ ...p, j })));
    await pool(jobs, 50, async ({ a, b, conv, j }) => {
      const from = j % 2 === 0 ? users[a] : users[b];
      const body = `load-${conv}-${j}`;
      sentAt.set(body, performance.now());
      await timed('POST mesaj', () => c.call(from.t, 'POST', `/conversations/${conv}/messages`, { body }), (r) => r.http === 201);
    });
    await c.sleep(1500);
    const delivered = stats.get('Mesaj ulaşma gecikmesi (socket)')?.ms.length ?? 0;
    expectTrue(delivered >= jobs.length * 0.99, `mesajların %99'u anlık ulaşmalı (${delivered}/${jobs.length})`);

    // 6. Eşzamanlı aramalar: 2+ dakika ücretlendirme, sonra tutarlılık denetimi
    const callPairs = pairs.slice(0, CALL_PAIRS);
    const before = new Map<string, number>();
    await pool(callPairs, 20, async ({ a, b }) => {
      await c.call(users[a].t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
      for (const i of [a, b]) before.set(users[i].id, (await c.call(users[i].t, 'GET', '/wallet')).balance);
    });
    const calls = await pool(callPairs, 20, async ({ a, b }) => {
      const call = await timed('POST /calls', () => c.call(users[a].t, 'POST', '/calls', { toId: users[b].id, kind: 'VOICE' }), (r) => r.http === 201);
      await timed('Arama kabul', () => c.call(users[b].t, 'POST', `/calls/${call.id}/accept`), (r) => r.http === 200);
      return { id: call.id, a, b };
    });
    await c.sleep(Number(testEnv.CALL_BILLING_SECONDS) * 1000 * 2 + 800);
    await pool(calls, 20, ({ id, a }) => timed('Arama bitir', () => c.call(users[a].t, 'POST', `/calls/${id}/hangup`), (r) => r.http === 200));
    await pool(calls, 20, async ({ id, a, b }) => {
      const info = await c.call(users[a].t, 'GET', `/calls/${id}`);
      const da = (await c.call(users[a].t, 'GET', '/wallet')).balance - before.get(users[a].id)!;
      const db = (await c.call(users[b].t, 'GET', '/wallet')).balance - before.get(users[b].id)!;
      expectTrue(info.billedMinutes >= 2, `arama ${id}: en az 2 dakika ücretlenmeli (${info.billedMinutes})`);
      expectTrue(-da === info.totalCoins && db === info.totalCoins, `arama ${id}: arayan ${da}, aranan +${db}, kayıt ${info.totalCoins}`);
    });

    // 7. Çift harcama yarışı: tam 1 mesaj isteğine yetecek bakiyeyle 10 eşzamanlı istek
    const racer = await c.makeUser('Racer', 'male', 'female'); // 50 jeton kayıt hediyesi = 1 istek
    const targets = users.filter((_, i) => i % 2 === 1).slice(0, 10);
    const results = await Promise.all(
      targets.map((t) => c.call(racer.t, 'POST', '/requests', { toId: t.id, kind: 'MESSAGE', note: 'yarış' })),
    );
    const ok = results.filter((r) => r.http === 201).length;
    const racerBal = (await c.call(racer.t, 'GET', '/wallet')).balance;
    expectTrue(ok <= 1 && racerBal >= 0, `çift harcama: ${ok} istek geçti, bakiye ${racerBal} (en fazla 1 ve ≥0 olmalı)`);

    // 8. Hediye yarışı: aktif aramada bakiyenin yettiğinden fazla eşzamanlı hediye
    const [g1, g2] = [users[USERS - 2], users[USERS - 1]];
    await c.call(g1.t, 'POST', '/wallet/dev-topup', { packId: 'coins_500' }); // yeterli bakiye ama sınırlı
    const gc = await c.call(g1.t, 'POST', '/calls', { toId: g2.id, kind: 'VOICE' });
    await c.call(g2.t, 'POST', `/calls/${gc.id}/accept`);
    const gBefore = (await c.call(g1.t, 'GET', '/wallet')).balance;
    const gifts = await Promise.all(Array.from({ length: 20 }, () => c.call(g1.t, 'POST', `/calls/${gc.id}/gifts`, { giftId: 'diamond' })));
    const giftOk = gifts.filter((r) => r.http === 200).length;
    const gAfter = (await c.call(g1.t, 'GET', '/wallet')).balance;
    await c.call(g1.t, 'POST', `/calls/${gc.id}/hangup`);
    expectTrue(gAfter >= 0, `hediye yarışı: bakiye eksiye düştü (${gAfter})`);
    expectTrue(giftOk <= Math.floor(gBefore / 250), `hediye yarışı: ${giftOk} hediye geçti, bakiye en fazla ${Math.floor(gBefore / 250)} hediyeye yeterdi`);

    // 9. Genel: hiçbir bakiye eksi değil
    const balances = await pool(users, 50, async (u) => (await c.call(u.t, 'GET', '/wallet')).balance as number);
    expectTrue(balances.every((b) => b >= 0), 'eksi bakiyeli kullanıcı var');
  } finally {
    sockets.forEach((l) => l.s.disconnect());
    await teardown();
  }

  // Rapor
  const rows = [...stats.values()].map((s) => ({
    İşlem: s.name,
    Adet: s.ms.length,
    Hata: s.errors,
    'p50 ms': Math.round(pct(s.ms, 50)),
    'p95 ms': Math.round(pct(s.ms, 95)),
    'maks ms': Math.round(Math.max(...s.ms)),
  }));
  console.table(rows);
  const totalOps = rows.reduce((n, r) => n + r.Adet, 0);
  const totalErr = rows.reduce((n, r) => n + r.Hata, 0);
  console.log(`Toplam ${totalOps} işlem, ${totalErr} hata, ${((Date.now() - started) / 1000).toFixed(1)} sn`);
  if (failures.length) console.log(`\nTUTARLILIK SORUNLARI (${failures.length}):\n- ${failures.slice(0, 30).join('\n- ')}`);
  else console.log('Tutarlılık denetimleri: hepsi geçti');

  const report = path.resolve(__dirname, '..', '..', 'test-data', 'load-report.json');
  fs.writeFileSync(report, JSON.stringify({ config: { USERS, CALL_PAIRS, MESSAGES }, rows, failures }, null, 2));
  console.log(`Rapor: ${report}`);
  if (failures.length || totalErr > totalOps * 0.01) process.exitCode = 1;
}

void main();
