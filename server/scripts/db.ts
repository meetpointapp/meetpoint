import path from 'node:path';
import { startPostgres } from './postgres';

// Geliştirme veritabanı: npm run db
// Ayrı bir terminalde açık kalır; Ctrl+C ile kapanır. Veriler server/.pgdata klasöründe kalıcıdır.
const PORT = Number(process.env.DEV_PG_PORT ?? 5433);

async function main() {
  const { pg, url, fresh } = await startPostgres({
    dataDir: path.resolve(__dirname, '..', '.pgdata'),
    port: PORT,
    database: 'meetpoint',
    persistent: true,
  });
  console.log(`PostgreSQL hazır: ${url}`);
  if (fresh) console.log('İlk kurulum: şimdi "npx prisma migrate deploy" ve "npm run db:seed" çalıştır.');

  const stop = async () => {
    console.log('PostgreSQL kapanıyor...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

void main();
