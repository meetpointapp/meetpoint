// Sohbet geçmişi sayfalama: uzun sohbette hiçbir mesaj kaybolmaz ya da tekrarlanmaz
// (aynı milisaniyede yazılmış mesajlar dahil).
import { describe, inject, it } from 'vitest';
import { call, check, makeUser } from '../helpers';

describe('Sohbet geçmişi sayfalama (Faz 9)', () => {
  it('senaryo', async () => {
    process.env.DATABASE_URL = inject('databaseUrl');
    const { PrismaClient } = await import('@prisma/client');
    const db = new PrismaClient();

    const a = await makeUser('Pager', 'male', 'female');
    const b = await makeUser('Pagee', 'female', 'male');
    await call(a.t, 'POST', '/swipes', { toId: b.id, direction: 'like' });
    const m = await call(b.t, 'POST', '/swipes', { toId: a.id, direction: 'like' });

    // 130 mesaj; 10'arlı gruplar aynı zaman damgasını paylaşıyor (sayfa sınırı zorlanır)
    const base = Date.now() - 3600_000;
    await db.message.createMany({
      data: Array.from({ length: 130 }, (_, i) => ({
        conversationId: m.conversationId,
        senderId: i % 2 ? a.id : b.id,
        body: `m${String(i).padStart(3, '0')}`,
        createdAt: new Date(base + Math.floor(i / 10) * 1000),
      })),
    });

    const seen: string[] = [];
    let page = await call(a.t, 'GET', `/conversations/${m.conversationId}/messages?limit=50`);
    let pages = 0;
    while (page._arr?.length) {
      pages++;
      seen.unshift(...page._arr.map((x) => x.id));
      if (page._arr.length < 50) break;
      page = await call(a.t, 'GET', `/conversations/${m.conversationId}/messages?limit=50&beforeId=${page._arr[0].id}`);
    }
    check('all 130 messages reached', seen.length === 130, `got=${seen.length}`);
    check('no duplicates', new Set(seen).size === seen.length);
    check('3 pages (50+50+30)', pages === 3, `pages=${pages}`);
    const all = await call(a.t, 'GET', `/conversations/${m.conversationId}/messages?limit=100`);
    check('each page chronological (old → new)', all._arr?.every((x, i, arr) => i === 0 || x.createdAt >= arr[i - 1].createdAt));

    // Başka sohbetin mesajı imleç olarak kullanılamaz; yabancı sohbete erişilemez
    const c = await makeUser('Outsider', 'female', 'male');
    const foreign = await call(c.t, 'GET', `/conversations/${m.conversationId}/messages`);
    check('outsider cannot page a conversation', foreign.http === 404);
    const badCursor = await call(a.t, 'GET', `/conversations/${m.conversationId}/messages?beforeId=nope`);
    check('unknown cursor → 404', badCursor.http === 404);
    const tooBig = await call(a.t, 'GET', `/conversations/${m.conversationId}/messages?limit=5000`);
    check('page size capped', tooBig.http === 400);
    await db.$disconnect();
  });
});
