import { type ChildProcess, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TEST_PORT, testEnv } from './env';

// API testlerinden önce: test veritabanını sıfırla, seed'le ve test sunucusunu başlat.
// Testler bitince sunucu kapanır. Geliştirme veritabanına (dev.db) ve dosyalarına dokunulmaz.
const root = path.resolve(__dirname, '..');
let server: ChildProcess | undefined;

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

export async function setup() {
  const env = { ...process.env, ...testEnv };
  fs.rmSync(path.join(root, 'test-data'), { recursive: true, force: true });
  // Sadece test veritabanı dosyası silinir ve migration'larla sıfırdan kurulur (dev.db'ye dokunulmaz)
  for (const f of ['test.db', 'test.db-journal']) fs.rmSync(path.join(root, 'prisma', f), { force: true });
  execSync('npx prisma migrate deploy', { cwd: root, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: root, env, stdio: 'pipe' });

  fs.mkdirSync(path.join(root, 'test-data'), { recursive: true });
  server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  // Sunucu çıktısı dosyaya: test başarısız olursa bakılabilir
  const log = fs.createWriteStream(path.join(root, 'test-data', 'server.log'));
  server.stdout?.pipe(log);
  server.stderr?.pipe(log);
  await waitForHealth(60_000);
}

export async function teardown() {
  server?.kill();
}
