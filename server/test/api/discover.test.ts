// Keşfet ölçekte doğru mu? 200+ aday varken eski süper beğenenler ve yakındakiler kaybolmamalı;
// mesafe/yaş/engel/kaydırma süzgeçleri veritabanında doğru uygulanmalı.
// Çok sayıda aday doğrudan veritabanına yazılır (kayıt akışı diğer testlerde).
import { afterAll, beforeAll, describe, inject, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { call, check, makeUser } from '../helpers';

let db: PrismaClient;
const created: string[] = [];

beforeAll(async () => {
  process.env.DATABASE_URL = inject('databaseUrl');
  const { PrismaClient } = await import('@prisma/client');
  db = new PrismaClient();
});

// Diğer test dosyalarının destelerini doldurmasın: bu testin adayları silinir
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

const yearsAgo = (y: number) => new Date(Date.UTC(new Date().getUTCFullYear() - y, 0, 15));
// Test veritabanında diğer testlerin ve seed'in (Türkiye'de) kullanıcıları da var: izleyici ve yakın
// adaylar onlardan uzak bir yerde (Yeni Zelanda), uzak adaylar Buenos Aires'te
const HOME = { latitude: -45.03, longitude: 168.66 };
const FAR = { latitude: -34.6, longitude: -58.38 };

// Doğrulanmış, fotoğraflı kadın aday (erkeklerle ilgilenen)
async function candidate(tag: string, o: { createdAt?: Date; age?: number; loc?: { latitude: number; longitude: number } | null } = {}) {
  const u = await db.user.create({
    data: {
      email: `${tag}-${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash: 'x',
      emailVerifiedAt: new Date(),
      consentSpecialAt: new Date(), // eşleştirme rızası (KVKK)
      createdAt: o.createdAt ?? new Date(),
      profile: {
        create: {
          displayName: tag,
          birthDate: yearsAgo(o.age ?? 28),
          gender: 'female',
          interestedIn: 'male',
          ...(o.loc === null ? {} : (o.loc ?? FAR)),
        },
      },
      photos: { create: { path: 'p/fake', position: 0 } },
    },
  });
  created.push(u.id);
  return u.id;
}

describe('Keşfet ölçekte (Faz 9)', () => {
  it('senaryo', async () => {
    const v = await makeUser('Viewer', 'male', 'female');
    await call(v.t, 'PUT', '/me/location', HOME);

    const long = new Date('2020-01-01');
    const oldSuper = await candidate('OldSuper', { createdAt: long, loc: null });
    await db.swipe.create({ data: { fromId: oldSuper, toId: v.id, direction: 'superlike' } });
    const oldNear = await candidate('OldNear', { createdAt: long, loc: { latitude: -45.04, longitude: 168.67 } });
    const swiped = await candidate('Swiped', { loc: HOME });
    await db.swipe.create({ data: { fromId: v.id, toId: swiped, direction: 'pass' } });
    const blocked = await candidate('Blocked', { loc: HOME });
    await db.block.create({ data: { fromId: blocked, toId: v.id } });
    const age32 = await candidate('Age32', { loc: { latitude: -45.06, longitude: 168.7 }, age: 32 });
    const noPhoto = await candidate('NoPhoto', { loc: HOME });
    await db.photo.deleteMany({ where: { userId: noPhoto } });
    // 210 yeni, uzak aday: eski uygulama sadece en yeni 200'e bakıyordu
    const farIds = new Set<string>();
    for (let i = 0; i < 210; i += 30) {
      const batch = await Promise.all(Array.from({ length: Math.min(30, 210 - i) }, (_, k) => candidate(`Far${i + k}`)));
      batch.forEach((id) => farIds.add(id));
    }

    let deck = await call(v.t, 'GET', '/discover');
    const ids = (deck._arr ?? []).map((p) => p.id);
    check('deck is 20 cards', ids.length === 20, `len=${ids.length}`);
    check('old super-liker first despite 210 newer users', ids[0] === oldSuper && deck._arr[0].superLikedMe === true);
    // Diğer testlerde öne çıkarılmış (boost) profiller süper beğenenden sonra, yakınlardan önce gelebilir:
    // sıra, bu testin adayları arasında denetlenir
    const mine = new Set([oldSuper, oldNear, age32]);
    const order = ids.filter((id) => mine.has(id));
    check('super-liker, then nearest (even old accounts) by distance', order.join() === [oldSuper, oldNear, age32].join(), order.join(','));
    // Uzak adaylar (bu testinkiler) yakınlardan sonra gelir. Başka testlerde öne çıkarılmış (boost)
    // profiller uzak olsa da önde olabilir; bu doğru davranış, o yüzden sadece kendi adaylarımız
    const firstFar = ids.findIndex((id) => farIds.has(id));
    check('nearby shown before any far candidate', firstFar === -1 || ids.indexOf(age32) < firstFar);
    check('already swiped excluded', !ids.includes(swiped));
    check('blocked excluded', !ids.includes(blocked));
    check('users without photos excluded', !ids.includes(noPhoto));
    check('distance shown, exact coords never exposed', deck._arr[1].distanceKm >= 1 && !('latitude' in deck._arr[1]));

    // Mesafe süzgeci: 50 km → uzaktakiler çıkar, konumu bilinmeyenler kalır
    await call(v.t, 'PUT', '/me/filters', { minAge: 18, maxAge: 80, maxKm: 50 });
    deck = await call(v.t, 'GET', '/discover');
    const near = deck._arr ?? [];
    check('50 km filter keeps nearby + unknown-location', [oldSuper, oldNear, age32].every((id) => near.some((p) => p.id === id)));
    check('50 km filter drops everyone farther', near.every((p) => p.distanceKm === null || p.distanceKm <= 50), near.map((p) => p.distanceKm).join(','));

    // Yaş süzgeci
    await call(v.t, 'PUT', '/me/filters', { minAge: 30, maxAge: 35, maxKm: 50 });
    deck = await call(v.t, 'GET', '/discover');
    const aged = deck._arr ?? [];
    check('age 30-35 filter', aged.some((p) => p.id === age32) && aged.every((p) => p.age >= 30 && p.age <= 35), aged.map((p) => p.age).join(','));

    // Hız: 200+ adayda tek sorgu
    await call(v.t, 'PUT', '/me/filters', { minAge: 18, maxAge: 80, maxKm: 0 });
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t = performance.now();
      await call(v.t, 'GET', '/discover');
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    check('discover fast with 200+ candidates (p90 < 300 ms)', times[8] < 300, `p90=${Math.round(times[8])}ms`);
  });
});
