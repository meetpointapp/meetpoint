// Lokal test verisi: npm run db:seed
// Giriş: test@meetpoint.dev / password123 (1000 jeton, gelen istekler, seni beğenmiş profiller)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';

// Bağımlılıksız basit PNG üretici: iki renk arası dikey gradyan (yer tutucu fotoğraf)
function gradientPng(file: string, top: [number, number, number], bottom: [number, number, number], dir = uploadDir) {
  const w = 480;
  const h = 640;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 3;
      raw[i] = Math.round(top[0] + (bottom[0] - top[0]) * t);
      raw[i + 1] = Math.round(top[1] + (bottom[1] - top[1]) * t);
      raw[i + 2] = Math.round(top[2] + (bottom[2] - top[2]) * t);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(dir, file), png);
}

type Rgb = [number, number, number];
const palettes: [Rgb, Rgb][] = [
  [[255, 94, 98], [255, 153, 102]],
  [[127, 90, 240], [44, 182, 125]],
  [[0, 180, 219], [0, 131, 176]],
  [[247, 151, 30], [255, 210, 0]],
  [[238, 9, 121], [255, 106, 0]],
  [[17, 153, 142], [56, 239, 125]],
  [[142, 45, 226], [74, 0, 224]],
  [[252, 70, 107], [63, 94, 251]],
];

// Şehir koordinatları (~1 km'ye yuvarlanmış; sunucu da böyle saklar)
const cityCoords: Record<string, { latitude: number; longitude: number }> = {
  'İstanbul': { latitude: 41.01, longitude: 28.98 },
  'İzmir': { latitude: 38.42, longitude: 27.14 },
  'Ankara': { latitude: 39.93, longitude: 32.86 },
  'Antalya': { latitude: 36.9, longitude: 30.7 },
  'London': { latitude: 51.51, longitude: -0.13 },
  'Bursa': { latitude: 40.19, longitude: 29.06 },
  'Eskişehir': { latitude: 39.78, longitude: 30.52 },
};

const demoUsers = [
  {
    name: 'Ayşe', gender: 'female', interestedIn: 'male', city: 'İstanbul', likesTest: true,
    bio: 'Kahve, kitap ve uzun yürüyüşler. Hafta sonları Kadıköy.',
    interests: ['coffee', 'books', 'hiking', 'photography', 'cooking'],
    prompts: [
      { id: 'perfect_sunday', answer: 'Moda sahilinde kahvaltı, sonra bir sahaf turu.' },
      { id: 'green_flag', answer: 'Garsona nazik davranan insanlar.' },
    ],
    details: { lookingFor: 'relationship', heightCm: 168, job: 'Grafik tasarımcı', education: 'bachelor', zodiac: 'libra', smoking: 'no', drinking: 'sometimes' },
  },
  {
    name: 'Zeynep', gender: 'female', interestedIn: 'male', city: 'İzmir', likesTest: false,
    bio: 'Deniz kenarında gün batımı olmazsa olmaz.',
    interests: ['beach', 'music', 'dancing', 'travel'],
    prompts: [{ id: 'travel_dream', answer: 'Lizbon’da bir ay yaşamak.' }],
    details: { lookingFor: 'unsure', heightCm: 172, job: 'Öğretmen', education: 'master', zodiac: 'pisces', smoking: 'no', drinking: 'sometimes' },
  },
  {
    name: 'Elif', gender: 'female', interestedIn: 'everyone', city: 'Ankara', likesTest: true,
    bio: 'Mimar. Seyahat etmeyi ve yeni yerler keşfetmeyi seviyorum.',
    interests: ['travel', 'art', 'photography', 'wine'],
    prompts: [
      { id: 'unpopular_opinion', answer: 'Ankara aslında çok güzel bir şehir.' },
      { id: 'first_date', answer: 'Bir sergi, ardından uzun bir yürüyüş.' },
    ],
    details: { lookingFor: 'relationship', heightCm: 165, job: 'Mimar', education: 'master', zodiac: 'gemini', smoking: 'no', drinking: 'yes' },
  },
  {
    name: 'Selin', gender: 'female', interestedIn: 'male', city: 'Antalya', likesTest: false,
    bio: 'Yoga eğitmeni. Pozitif enerji arıyorum.',
    interests: ['yoga', 'meditation', 'nature', 'beach', 'running'],
    prompts: [{ id: 'simple_pleasures', answer: 'Sabah 7’de boş bir plaj.' }],
    details: { lookingFor: 'friendship', heightCm: 170, job: 'Yoga eğitmeni', education: 'bachelor', zodiac: 'leo', smoking: 'no', drinking: 'no' },
  },
  {
    name: 'Emma', gender: 'female', interestedIn: 'male', city: 'London', likesTest: false,
    bio: 'Photographer. Coffee snob. Let’s talk films.',
    interests: ['photography', 'coffee', 'movies', 'art'],
    prompts: [{ id: 'song', answer: 'Anything by Fleetwood Mac.' }],
    details: { lookingFor: 'chat', heightCm: 175, job: 'Photographer', education: 'bachelor', zodiac: 'aquarius', smoking: 'sometimes', drinking: 'sometimes' },
  },
  {
    name: 'Deniz', gender: 'female', interestedIn: 'male', city: 'Bursa', likesTest: false,
    bio: 'Müzik, konserler, gitar.',
    interests: ['music', 'concerts', 'series', 'gaming'],
    prompts: [{ id: 'laugh', answer: 'Kötü kelime esprileri. Evet, gerçekten.' }],
    details: { lookingFor: 'casual', heightCm: null, job: '', education: '', zodiac: '', smoking: '', drinking: '' },
  },
  {
    name: 'Mert', gender: 'male', interestedIn: 'female', city: 'İstanbul', likesTest: false,
    bio: 'Yazılımcı, bisiklet tutkunu.',
    interests: ['tech', 'cycling', 'coffee'],
    prompts: [],
    details: { lookingFor: 'relationship', heightCm: 182, job: 'Yazılımcı', education: 'bachelor', zodiac: '', smoking: 'no', drinking: 'sometimes' },
  },
  {
    name: 'Can', gender: 'male', interestedIn: 'female', city: 'Eskişehir', likesTest: false,
    bio: 'Fotoğrafçılık ve kamp.',
    interests: ['camping', 'photography', 'nature'],
    prompts: [],
    details: { lookingFor: 'unsure', heightCm: 178, job: '', education: '', zodiac: '', smoking: '', drinking: '' },
  },
];

async function main() {
  fs.mkdirSync(uploadDir, { recursive: true });
  const passwordHash = await bcrypt.hash('password123', 10);

  // Önceki demo ve otomatik test verisini temizle (@meetpoint.dev ve @test.com hesapları)
  await prisma.user.deleteMany({
    where: { OR: [{ email: { endsWith: '@meetpoint.dev' } }, { email: { endsWith: '@test.com' } }] },
  });
  // Silinen test hesaplarının para çekme kayıtları (muhasebe için hesap silinse de kalır) ve hata kayıtları
  await prisma.payout.deleteMany({
    where: { OR: [{ email: { endsWith: '@meetpoint.dev' } }, { email: { endsWith: '@test.com' } }] },
  });
  await prisma.errorLog.deleteMany();

  const test = await prisma.user.create({
    data: {
      email: 'test@meetpoint.dev',
      passwordHash,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      profile: {
        create: {
          displayName: 'Test',
          birthDate: new Date('1998-06-15'),
          gender: 'male',
          interestedIn: 'female',
          city: 'İstanbul',
          country: 'Türkiye',
          bio: 'Test hesabı',
          interests: ['coffee', 'travel', 'tech'],
          lookingFor: 'relationship',
          latitude: 41.04,
          longitude: 29.0,
        },
      },
    },
  });
  gradientPng(`seed-${test.id}.png`, [52, 58, 64], [134, 142, 150]);
  await prisma.photo.create({ data: { userId: test.id, path: `seed-${test.id}.png`, position: 0 } });
  await prisma.walletEntry.create({ data: { userId: test.id, amount: 1000, type: 'GRANT', note: 'seed' } });

  const created: { id: string; name: string }[] = [];
  for (const [i, u] of demoUsers.entries()) {
    const user = await prisma.user.create({
      data: {
        email: `${u.name.toLowerCase().replace(/[^a-z]/g, '')}${i}@meetpoint.dev`,
        passwordHash,
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        // Ayşe ve Elif mavi tikli
        ...(u.name === 'Ayşe' || u.name === 'Elif' ? { verificationStatus: 'approved', verifiedAt: new Date() } : {}),
        profile: {
          create: {
            displayName: u.name,
            birthDate: new Date(1990 + (i % 9), i % 12, 10 + i),
            gender: u.gender,
            interestedIn: u.interestedIn,
            city: u.city,
            country: u.city === 'London' ? 'UK' : 'Türkiye',
            bio: u.bio,
            interests: u.interests,
            prompts: u.prompts,
            ...u.details,
            ...cityCoords[u.city],
          },
        },
      },
    });
    for (let p = 0; p < 2; p++) {
      const [a, b] = palettes[(i + p * 3) % palettes.length];
      const file = `seed-${user.id}-${p}.png`;
      gradientPng(file, p === 0 ? a : b, p === 0 ? b : a);
      await prisma.photo.create({ data: { userId: user.id, path: file, position: p } });
    }
    await prisma.walletEntry.create({ data: { userId: user.id, amount: 2000, type: 'GRANT', note: 'seed' } });
    if (u.likesTest) {
      await prisma.swipe.create({ data: { fromId: user.id, toId: test.id, direction: 'like' } });
    }
    created.push({ id: user.id, name: u.name });
  }

  // Test hesabına gelen bekleyen mesaj istekleri
  const expiresAt = new Date(Date.now() + 24 * 3600_000);
  const incoming = [
    { from: 'Zeynep', kind: 'MESSAGE', price: 50, note: 'Selam! Profilin çok ilgimi çekti, tanışalım mı? 😊' },
    { from: 'Emma', kind: 'MESSAGE', price: 50, note: 'Hi! Your travel photos are amazing ✈️ Where was the last one?' },
  ];
  for (const r of incoming) {
    const from = created.find((c) => c.name === r.from)!;
    const req = await prisma.contactRequest.create({
      data: { fromId: from.id, toId: test.id, kind: r.kind, price: r.price, note: r.note, expiresAt },
    });
    await prisma.walletEntry.create({ data: { userId: from.id, amount: -r.price, type: 'HOLD', requestId: req.id } });
  }

  // Örnek arama geçmişi (Aramalar ekranı boş görünmesin)
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  const byName = (n: string) => created.find((c) => c.name === n)!.id;
  await prisma.call.create({
    data: {
      callerId: test.id, calleeId: byName('Selin'), kind: 'VIDEO', ratePerMin: 30, status: 'ENDED', endReason: 'hangup',
      billedMinutes: 4, totalCoins: 120, callerRating: 5, createdAt: ago(185), answeredAt: ago(184), endedAt: ago(180),
    },
  });
  await prisma.call.create({
    data: { callerId: byName('Emma'), calleeId: test.id, kind: 'VOICE', ratePerMin: 15, status: 'MISSED', createdAt: ago(60), endedAt: ago(59) },
  });

  // Deniz test hesabını süper beğendi: keşfette en önde ve yıldızlı görünür
  const deniz = created.find((c) => c.name === 'Deniz')!;
  await prisma.swipe.create({ data: { fromId: deniz.id, toId: test.id, direction: 'superlike' } });

  // Yönetim paneli hesabı (profili yok, uygulamada görünmez)
  await prisma.user.create({
    data: { email: 'admin@meetpoint.dev', passwordHash, isAdmin: true, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() },
  });

  // Panel demosu: Zeynep'in bekleyen mavi tik başvurusu (selfie özel klasörde)
  const privateDir = process.env.PRIVATE_UPLOAD_DIR ?? 'private-uploads';
  fs.mkdirSync(privateDir, { recursive: true });
  const zeynep = created.find((c) => c.name === 'Zeynep')!;
  const selfie = `seed-selfie-${zeynep.id}.png`;
  gradientPng(selfie, [127, 90, 240], [44, 182, 125], privateDir);
  await prisma.verificationRequest.create({ data: { userId: zeynep.id, pose: 'peace_sign', selfiePath: selfie } });
  await prisma.user.update({ where: { id: zeynep.id }, data: { verificationStatus: 'pending' } });

  // Panel demosu: açık şikayet (Selin -> Can)
  const selin = created.find((c) => c.name === 'Selin')!;
  const can = created.find((c) => c.name === 'Can')!;
  await prisma.report.create({
    data: { fromId: selin.id, toId: can.id, reason: 'fake_profile', details: 'Fotoğraflar internetten alınmış gibi görünüyor.' },
  });

  console.log(`Seed tamam: ${created.length + 1} kullanıcı. Giriş: test@meetpoint.dev / password123 · Panel: admin@meetpoint.dev / password123`);
}

main().finally(() => prisma.$disconnect());
