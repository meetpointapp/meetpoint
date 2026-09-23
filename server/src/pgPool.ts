import pg from 'pg';
import './config'; // .env yüklensin

// Prisma dışında doğrudan PostgreSQL bağlantısı gereken işler için havuz:
// Socket.IO adaptörü (LISTEN/NOTIFY) ve zamanlayıcı liderlik kilidi (advisory lock).
// Adaptör her anlık olayı yerel teslimattan ÖNCE diğer sunuculara yayınlar (NOTIFY): havuz dar
// olursa yoğunlukta olaylar kuyrukta bekler. 1 bağlantı liderlik kilidi, 1 bağlantı dinleme, kalanı yayın.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX ?? 12) });

pool.on('error', (e) => console.error('[pg pool]', e.message));
