import { type ChildProcess, execSync, spawn } from 'node:child_process';
import type { TestProject } from 'vitest/node';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { databaseUrl, startPostgres } from '../scripts/postgres';
import { TEST_PG_PORT, TEST_PORT, testEnv } from './env';

// API testlerinden önce: testlere özel geçici PostgreSQL'i aç, migration + seed uygula,
// test sunucusunu başlat. Bitince hepsi kapanır ve veriler silinir. Geliştirme veritabanına dokunulmaz.
const root = path.resolve(__dirname, '..');
const dataRoot = path.join(root, 'test-data');
let server: ChildProcess | undefined;
let pg: { stop: () => Promise<void> } | undefined;
let pgDir = '';

const isFree = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });

async function freePort(from: number) {
  for (let p = from; p < from + 30; p++) if (await isFree(p)) return p;
  throw new Error('Test veritabanı için boş port bulunamadı');
}

async function waitForHealth(timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/health`);
      if (res.ok) return;
    } catch {
      // henüz ayağa kalkmadı
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Test sunucusu zamanında başlamadı');
}

// Önceki çalıştırmadan kalmış test PostgreSQL'lerini kapat (postmaster.pid ile) ve klasörlerini sil
function cleanupStale() {
  if (!fs.existsSync(dataRoot)) return;
  for (const dir of fs.readdirSync(dataRoot).filter((d) => d.startsWith('pg-'))) {
    const pidFile = path.join(dataRoot, dir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      const pid = Number(fs.readFileSync(pidFile, 'utf8').split('\n')[0]);
      try {
        process.kill(pid);
      } catch {
        // zaten kapanmış
      }
    }
  }
  fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

// Test dosyalarının ek sunucu başlatabilmesi için gerçek veritabanı adresi (port her çalıştırmada değişebilir)
declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

// Testlerin başlattığı ek sunucuların kayıt dosyası: bitişte hepsi kapatılır
export const EXTRA_PIDS = path.join(dataRoot, 'extra-pids.txt');

// Aynı test veritabanına ek sunucu örneği (çok sunuculu senaryolar için)
export function spawnServer(port: number, logName: string, databaseUrl = testEnv.DATABASE_URL, extraEnv: Record<string, string> = {}) {
  const env = { ...process.env, ...testEnv, DATABASE_URL: databaseUrl, PORT: String(port), ...extraEnv };
  // Sunucuyu başlatan test süreci bitince sunucu yaşamaya devam etmeli: çıktı doğrudan dosyaya (boru
  // değil) ve "detached" (Windows'ta aksi halde ebeveyn süreç kapanınca çocuk da kapatılır).
  // Kapatma garantisi: süreç kimlikleri EXTRA_PIDS'te, teardown hepsini kapatır.
  const log = fs.openSync(path.join(dataRoot, logName), 'a');
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: root,
    env,
    stdio: ['ignore', log, log],
    detached: true,
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(log);
  if (child.pid) fs.appendFileSync(EXTRA_PIDS, `${child.pid}\n`);
  return child;
}

export async function setup(project?: TestProject) {
  cleanupStale();
  fs.mkdirSync(dataRoot, { recursive: true });

  // Her çalıştırma kendi klasörü ve ilk boş port ile: yarım kalmış bir önceki çalıştırma engel olmaz
  const port = await freePort(TEST_PG_PORT);
  pgDir = path.join(dataRoot, `pg-${Date.now()}`);
  const started = await startPostgres({ dataDir: pgDir, port, database: 'meetpoint_test', persistent: false });
  pg = started.pg;
  testEnv.DATABASE_URL = databaseUrl(port, 'meetpoint_test');

  const env = { ...process.env, ...testEnv };
  execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: root, env, stdio: 'pipe' });

  server = spawnServer(TEST_PORT, 'server.log');
  await waitForHealth(60_000);
  project?.provide('databaseUrl', testEnv.DATABASE_URL);
}

export async function teardown() {
  server?.kill();
  // Testlerin başlattığı ek sunucular
  if (fs.existsSync(EXTRA_PIDS)) {
    for (const pid of fs.readFileSync(EXTRA_PIDS, 'utf8').split('\n').filter(Boolean)) {
      try {
        process.kill(Number(pid));
      } catch {
        // zaten kapanmış
      }
    }
  }
  // Son denetim: testler boyunca yapılan tüm para hareketlerinden sonra her cüzdan defterle eşleşmeli
  let ledgerError: unknown;
  try {
    execSync('npx tsx scripts/verify-ledger.ts', { cwd: root, env: { ...process.env, ...testEnv }, stdio: 'pipe' });
  } catch (e) {
    ledgerError = new Error(`Cüzdan defteri tutarsız: ${String((e as { stderr?: Buffer }).stderr ?? e)}`);
  }
  await new Promise((r) => setTimeout(r, 300));
  // PostgreSQL 10 sn içinde kapanmazsa zorla kapat
  await Promise.race([pg?.stop(), new Promise((r) => setTimeout(r, 10_000))]).catch(() => {});
  const pidFile = path.join(pgDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      process.kill(Number(fs.readFileSync(pidFile, 'utf8').split('\n')[0]));
    } catch {
      // kapanmış
    }
  }
  if (ledgerError) throw ledgerError;
}
