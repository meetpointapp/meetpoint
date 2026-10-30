// Faz 25: yük testi için toplu sahte kullanıcı + oturum jetonu üretir (SADECE test/staging veritabanında!).
//   npm run load:users -- 5000        5000 kullanıcı oluşturur, jetonları tools/loadtest/tokens.json'a yazar
//   npm run load:users -- --cleanup   üretilenlerin hepsini siler (e-posta @load.vibeupme.test)
// Hesaplar doğrulanmış, yasal metinleri onaylamış, 3 fotoğraf kaydı ve doldurulmuş profille gelir (keşfet destesi gerçekçi olsun).
// Gerçek fotoğraf dosyası yazmaz: fotoğraf adresleri 404 döner, bu yük testi için sorun değil.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const DOMAIN = '@load.vibeupme.test';
const OUT = path.resolve(__dirname, '..', '..', 'tools', 'loadtest', 'tokens.json');

const CITIES: [string, number, number][] = [
  ['İstanbul', 41.01, 28.97], ['Ankara', 39.93, 32.86], ['İzmir', 38.42, 27.14], ['Bursa', 40.19, 29.06],
  ['Antalya', 36.9, 30.7], ['Adana', 37.0, 35.32], ['Konya', 37.87, 32.48], ['Gaziantep', 37.07, 37.38],
];
const INTERESTS = ['coffee', 'travel', 'books', 'music', 'movies', 'sports', 'cooking', 'photography', 'gaming', 'nature', 'yoga', 'art'];
const pick = <T>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);

async function main() {
  if (process.argv.includes('--cleanup')) {
    const r = await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    console.log(`${r.count} yük testi kullanıcısı silindi`);
    return;
  }
  if (config.isProduction && process.env.ALLOW_LOAD_USERS !== 'yes') {
    throw new Error('NODE_ENV=production: canlı veritabanına sahte kullanıcı yazılmaz (bilerek yapacaksanız ALLOW_LOAD_USERS=yes)');
  }
  const total = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 1000);
  const now = new Date();
  const tokens: { userId: string; token: string }[] = [];
  const BATCH = 1000;

  for (let start = 0; start < total; start += BATCH) {
    const n = Math.min(BATCH, total - start);
    const users: object[] = [];
    const profiles: object[] = [];
    const photos: object[] = [];
    const sessions: object[] = [];
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      const id = `ld${crypto.randomBytes(10).toString('hex')}`;
      const sid = `ls${crypto.randomBytes(10).toString('hex')}`;
      const female = idx % 2 === 0;
      const [city, lat, lng] = CITIES[idx % CITIES.length];
      users.push({
        id,
        email: `u${idx}${DOMAIN}`,
        passwordHash: 'x',
        emailVerifiedAt: now,
        termsAcceptedAt: now,
        termsVersion: config.termsVersion,
        privacyVersion: config.privacyVersion,
        consentSpecialAt: now,
        consentOverseasAt: now,
      });
      profiles.push({
        userId: id,
        displayName: `Yük${idx}`,
        birthDate: new Date(Date.UTC(1990 + (idx % 12), idx % 12, 1 + (idx % 27))),
        gender: female ? 'female' : 'male',
        interestedIn: 'everyone',
        bio: 'Yük testi hesabı',
        city,
        country: 'TR',
        interests: pick(INTERESTS, 3 + (idx % 3)),
        lookingFor: ['relationship', 'friendship', 'chat', 'casual'][idx % 4],
        latitude: lat + (Math.random() - 0.5) * 0.4,
        longitude: lng + (Math.random() - 0.5) * 0.4,
      });
      for (let p = 0; p < 3; p++) photos.push({ userId: id, path: `load/${id}-${p}`, position: p });
      sessions.push({
        id: sid,
        userId: id,
        refreshHash: crypto.randomBytes(24).toString('hex'),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      });
      // Yük testi süresince geçerli kalsın diye 3 saatlik erişim jetonu (normal ömür 15 dk)
      tokens.push({ userId: id, token: jwt.sign({ sub: id, v: 0, sid }, config.jwtSecret, { expiresIn: '3h' }) });
    }
    await prisma.user.createMany({ data: users as never });
    await prisma.profile.createMany({ data: profiles as never });
    await prisma.photo.createMany({ data: photos as never });
    await prisma.session.createMany({ data: sessions as never });
    console.log(`${start + n}/${total}`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(tokens));
  console.log(`jetonlar yazıldı: ${OUT} (3 saat geçerli)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
