import fs from 'node:fs';

// Gömülü PostgreSQL: bilgisayara kurulum gerektirmeden proje içinden açılıp kapanan veritabanı.
// Geliştirme (npm run db) ve testler (ayrı, geçici kopya) bunu kullanır. Yayında gerçek PostgreSQL.
export type PgOptions = {
  dataDir: string;
  port: number;
  database: string;
  persistent: boolean; // false: durunca veri silinir (testler)
  log?: boolean;
};

export const PG_USER = 'meetpoint';
export const PG_PASSWORD = 'meetpoint-dev';

export const databaseUrl = (port: number, database: string) =>
  `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${port}/${database}`;

export async function startPostgres(o: PgOptions) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({
    databaseDir: o.dataDir,
    port: o.port,
    user: PG_USER,
    password: PG_PASSWORD,
    persistent: o.persistent,
    // Windows'un Türkçe yerel ayar adı ("Turkish_Türkiye.1254") ASCII dışı karakter içerdiği için
    // initdb reddediyor: nötr C yerel ayarı + UTF-8. Veri Türkçe karakterleri sorunsuz saklar.
    initdbFlags: ['--locale=C', '--encoding=UTF8'],
    onLog: o.log ? (m: string) => console.log(`[pg] ${m.trim()}`) : () => {},
    onError: (e: unknown) => console.error('[pg]', e),
  });
  const fresh = !fs.existsSync(`${o.dataDir}/PG_VERSION`);
  if (fresh) await pg.initialise();
  await pg.start();

  // Veritabanı yoksa oluştur
  const client = pg.getPgClient('postgres');
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [o.database]);
  await client.end();
  if (!exists.rowCount) await pg.createDatabase(o.database);

  return { pg, url: databaseUrl(o.port, o.database), fresh };
}
