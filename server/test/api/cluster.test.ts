// Çok sunuculu çalışma ve sunucu çökmesi: aynı veritabanına bağlı ikinci bir sunucu açılır.
//  1. Olaylar sunucular arasında taşınır (arayan A'ya, aranan B'ye bağlı).
//  2. Lider sunucu arama ortasında çöker: diğer sunucu zamanlayıcıyı devralır, ücretlendirme
//     kaldığı yerden devam eder; hiçbir dakika kaybolmaz ya da iki kez alınmaz.
import { describe, inject, it } from 'vitest';
import { spawnServer } from '../globalSetup';
import { B, call, check, listen, makeUser, sleep, waitFor } from '../helpers';

const A = B; // globalSetup'ın açtığı sunucu (4010)
const B2 = 'http://localhost:4011';
const health = (base: string) => fetch(`${base}/health`).then((r) => r.json()).catch(() => null);

describe('Çok sunuculu çalışma ve çökme (Faz 9)', () => {
  it('senaryo', async () => {
    const dbUrl = inject('databaseUrl');
    spawnServer(4011, 'server-b.log', dbUrl);
    const hb = await waitFor(() => health(B2), (h) => h?.ok === true, 60_000, 250);
    check('second server up', hb?.ok === true);
    check('first server is scheduler leader, second follows', (await health(A))?.scheduler === 'leader' && hb?.scheduler === 'follower');

    const x = await makeUser('Xcaller', 'male', 'female');
    const y = await makeUser('Ycallee', 'female', 'male');
    await call(x.t, 'POST', '/wallet/dev-topup', { packId: 'coins_1000' });
    const before = {
      x: (await call(x.t, 'GET', '/wallet')).balance as number,
      y: (await call(y.t, 'GET', '/wallet')).balance as number,
    };

    // --- 1. Sunucular arası olaylar
    const xs = await listen(x.t, A);
    const ys = await listen(y.t, B2);
    const c = await call(x.t, 'POST', '/calls', { toId: y.id, kind: 'VOICE' }, A);
    check('incoming call reaches callee on the other server', await waitFor(() => ys.events.some((e) => e.name === 'call:incoming' && e.payload.id === c.id), Boolean, 3000));
    const acc = await call(y.t, 'POST', `/calls/${c.id}/accept`, undefined, B2);
    check('accepted on server B', acc.status === 'ACTIVE');
    check('caller on server A notified', await waitFor(() => xs.has('call:accepted'), Boolean, 3000));
    await call(y.t, 'POST', `/calls/${c.id}/gifts`, { giftId: 'rose' }, B2).catch(() => null); // Y'nin 50 hediye jetonu var
    check('gift event crosses servers', await waitFor(() => xs.events.some((e) => e.name === 'call:gift'), Boolean, 3000));

    // --- 2. Lider çöker (arama sürerken)
    const minuteBefore = (await waitFor(() => call(x.t, 'GET', `/calls/${c.id}`, undefined, B2), (v) => v.billedMinutes >= 2)).billedMinutes;
    const pidA = (await health(A))?.pid as number;
    process.kill(pidA); // ani ölüm (düzgün kapanma yok)
    // Arayan uygulaması diğer sunucuya yeniden bağlanır (bekleme süresi içinde)
    await sleep(300);
    const xs2 = await listen(x.t, B2);
    const takeover = await waitFor(() => health(B2), (h) => h?.scheduler === 'leader', 10_000, 200);
    check('server B takes over scheduling', takeover?.scheduler === 'leader');
    const later = await waitFor(() => call(x.t, 'GET', `/calls/${c.id}`, undefined, B2), (v) => v.billedMinutes >= minuteBefore + 2, 12_000);
    check('billing continues after leader crash', later.status === 'ACTIVE' && later.billedMinutes >= minuteBefore + 2, `${later.status} ${minuteBefore}→${later.billedMinutes}`);

    // Çöken sunucu yeniden açılır: artık takipçi
    spawnServer(4010, 'server-a-restarted.log', dbUrl);
    const ha = await waitFor(() => health(A), (h) => h?.ok === true, 60_000, 250);
    check('restarted server joins as follower', ha?.scheduler === 'follower');

    // --- Bitiş: her dakika tam bir kez ve iki taraf arasında birebir
    const end = await call(x.t, 'POST', `/calls/${c.id}/hangup`, undefined, A);
    check('hangup through restarted server', end.status === 'ENDED' && end.endReason === 'hangup', `${end.status}/${end.endReason}`);
    const info = await call(x.t, 'GET', `/calls/${c.id}`);
    const dx = (await call(x.t, 'GET', '/wallet')).balance - before.x;
    const dy = (await call(y.t, 'GET', '/wallet')).balance - before.y;
    const gifts = info.giftCoins as number;
    check('caller paid exactly the billed minutes (minus gift received)', dx === -info.totalCoins + gifts, `dx=${dx} total=${info.totalCoins} gift=${gifts}`);
    check('callee received exactly the billed minutes (minus gift sent)', dy === info.totalCoins - gifts, `dy=${dy}`);
    const elapsedMinutes = Math.floor((new Date(info.endedAt).getTime() - new Date(info.answeredAt).getTime()) / 3000) + 1;
    check('no minute lost or double-charged during failover', Math.abs(info.billedMinutes - elapsedMinutes) <= 1, `billed=${info.billedMinutes} elapsed=${elapsedMinutes}`);

    xs.s.disconnect();
    xs2.s.disconnect();
    ys.s.disconnect();
  });
});
