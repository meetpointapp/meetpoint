import pg from 'pg';
import './config'; // .env yüklensin

// Prisma dışında doğrudan PostgreSQL bağlantısı gereken işler için küçük havuz:
// Socket.IO adaptörü (LISTEN/NOTIFY) ve zamanlayıcı liderlik kilidi (advisory lock).
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

pool.on('error', (e) => console.error('[pg pool]', e.message));
