// Faz 7: hata takibi (uygulama hataları gruplanır, yönetimde listelenir, çözülünce kapanır)
import { describe, it } from 'vitest';
import { B, call, check, registerVerified, sleep } from '../helpers';

describe('Hata takibi (Faz 7)', () => {
  it('senaryo', async () => {
    const tag = Date.now();
    const admin = (await call(null, 'POST', '/auth/login', { email: 'admin@meetpoint.dev', password: 'password123' })).token;
    // Hata kayıtları toplu yazılır (testte 100 ms aralıkla): okumadan önce kısa bekleme
    const adminGet = async (p: string) => {
      await sleep(300);
      return call(admin, 'GET', p);
    };
    const u = await registerVerified(`err${tag}@test.com`);

    const send = (body, token?: string) =>
      fetch(`${B}/client-errors`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });

    const msg = `Null check operator used on a null value #${tag}`;
    const stack = (line) => `#0      _DiscoverState.build (package:meetpoint/features/discover/discover_screen.dart:${line}:12)\n#1      StatefulElement.build`;

    const r1 = await send({ message: msg, stack: stack(120), platform: 'android', appVersion: '1.0.0', context: '/discover' });
    check('anonymous report accepted', r1.status === 204);
    await send({ message: msg, stack: stack(121), platform: 'ios', appVersion: '1.0.1', context: '/discover' }, u.t);
    const bad = await send({ stack: 'x' });
    check('report without message rejected', bad.status === 400);

    let list = await adminGet('/admin/api/errors');
    let row = list._arr?.find((e) => e.message === msg);
    check('same error grouped (line numbers ignored)', row?.count === 2, `count=${row?.count}`);
    check('latest platform/version/user kept', row?.platform === 'ios' && row?.appVersion === '1.0.1' && row?.lastUserId === u.id);

    await send({ message: `Other error ${tag}`, stack: 'x', platform: 'web' });
    list = await adminGet('/admin/api/errors');
    check('different error separate', list._arr?.some((e) => e.message === `Other error ${tag}`));

    const stats = await adminGet('/admin/api/stats');
    check('stats count open errors', stats.openErrors >= 2);

    await call(admin, 'POST', `/admin/api/errors/${row.id}/resolve`);
    list = await adminGet('/admin/api/errors');
    check('resolved error leaves open list', !list._arr?.some((e) => e.id === row.id));
    const resolved = await adminGet('/admin/api/errors?resolved=1');
    check('resolved list has it', resolved._arr?.some((e) => e.id === row.id));

    await send({ message: msg, stack: stack(130), platform: 'android' });
    list = await adminGet('/admin/api/errors');
    row = list._arr?.find((e) => e.id === row.id);
    check('recurring error reopens', row?.count === 3 && row?.resolvedAt === null);

    const nonAdmin = await call(u.t, 'GET', '/admin/api/errors');
    check('errors need admin', nonAdmin.http === 403);
  });
});
