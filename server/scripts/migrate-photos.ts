// Tek seferlik: eski sürümde yüklenmiş fotoğrafları yeni biçime çevirir.
//   npx tsx scripts/migrate-photos.ts
// Profil fotoğrafları → 3 boy WebP (üst veri/GPS silinir); selfie ve açılmamış sohbet fotoğrafları →
// üst verisi temizlenmiş tek WebP. Eski dosyalar silinir. Tekrar çalıştırmak güvenlidir.
import { prisma } from '../src/db';
import { sanitizePrivatePhoto, storeProfilePhoto } from '../src/images';
import { privateStore, publicStore, randomKey } from '../src/storage';

const legacy = (p: string) => /\.[a-z0-9]+$/i.test(p) && !p.includes('/');

async function main() {
  let profile = 0;
  let missing = 0;
  for (const photo of await prisma.photo.findMany()) {
    if (!legacy(photo.path)) continue;
    const data = await publicStore.read(photo.path);
    if (!data) {
      missing++;
      continue;
    }
    const base = await storeProfilePhoto(data);
    await prisma.photo.update({ where: { id: photo.id }, data: { path: base } });
    await publicStore.remove(photo.path);
    profile++;
  }

  let selfies = 0;
  for (const v of await prisma.verificationRequest.findMany()) {
    if (!legacy(v.selfiePath)) continue;
    const data = await privateStore.read(v.selfiePath);
    if (!data) continue;
    const key = randomKey('selfie', 'webp');
    await privateStore.put(key, await sanitizePrivatePhoto(data));
    await prisma.verificationRequest.update({ where: { id: v.id }, data: { selfiePath: key } });
    await privateStore.remove(v.selfiePath);
    selfies++;
  }

  let chats = 0;
  for (const m of await prisma.message.findMany({ where: { kind: 'photo', photoPath: { not: null } } })) {
    if (!m.photoPath || !legacy(m.photoPath)) continue;
    const data = await privateStore.read(m.photoPath);
    if (!data) continue;
    const key = randomKey('chat', 'webp');
    await privateStore.put(key, await sanitizePrivatePhoto(data));
    await prisma.message.update({ where: { id: m.id }, data: { photoPath: key } });
    await privateStore.remove(m.photoPath);
    chats++;
  }

  console.log(`Profil: ${profile} çevrildi${missing ? `, ${missing} dosyası bulunamadı` : ''} · Selfie: ${selfies} · Sohbet: ${chats}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
