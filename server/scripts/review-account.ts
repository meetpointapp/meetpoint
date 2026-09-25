// Mağaza incelemesi (Apple App Review / Google Play) için demo hesap. Yayın sunucusunda bir kez çalıştırılır;
// tekrar çalıştırılırsa hesabı sıfırlar (şifre, bakiye, rızalar). İki hesap açar:
//   REVIEW_ACCOUNT_EMAIL (varsayılan review@meetpoint.app): incelemecinin gireceği hesap
//   review-partner+<aynı alan>: onunla eşleşmiş, sohbet geçmişi olan demo profil
// Kullanım:
//   REVIEW_ACCOUNT_PASSWORD='en-az-12-karakter' npm run review:account
// Şifre mağaza formundaki "inceleme notları" alanına yazılır (docs/magaza-formlari.md).
import sharp from 'sharp';
import { consumer } from '../src/config';
import { prisma } from '../src/db';
import { storeProfilePhoto } from '../src/images';
import { hashPassword } from '../src/passwords';
import { acceptLegal, recordConsent } from '../src/privacy/consents';
import { credit } from '../src/wallet';

const password = process.env.REVIEW_ACCOUNT_PASSWORD ?? '';
if (password.length < 12) {
  console.error('REVIEW_ACCOUNT_PASSWORD en az 12 karakter olmalı');
  process.exit(1);
}

// Düz renk geçişli yer tutucu fotoğraf (gerçek yüklemelerle aynı işlemden geçer)
async function photo(top: number[], bottom: number[]) {
  const w = 480;
  const h = 640;
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) raw[(y * w + x) * 3 + c] = Math.round(top[c] + (bottom[c] - top[c]) * t);
  }
  return storeProfilePhoto(await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer());
}

async function upsertUser(email: string, profile: { displayName: string; gender: string; interestedIn: string; bio: string }, colors: [number[], number[]]) {
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, bannedAt: null, deletionRequestedAt: null, deleteAfter: null, restrictedUntil: null, tokenVersion: { increment: 1 } },
      })
    : await prisma.user.create({ data: { email, passwordHash, emailVerifiedAt: new Date(), locale: 'en' } });
  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...profile,
      birthDate: new Date('1995-05-20'),
      city: 'İstanbul',
      country: 'Türkiye',
      interests: ['coffee', 'travel', 'music'],
      lookingFor: 'relationship',
      latitude: 41.01,
      longitude: 28.98,
    },
    update: profile,
  });
  if (!(await prisma.photo.count({ where: { userId: user.id } }))) {
    await prisma.photo.create({ data: { userId: user.id, path: await photo(colors[0], colors[1]), position: 0 } });
  }
  await prisma.$transaction(async (tx) => {
    await acceptLegal(tx, user.id, 'review');
    await recordConsent(tx, user.id, 'special_category', true, 'review');
    await recordConsent(tx, user.id, 'overseas_transfer', true, 'review');
    await tx.consent.create({ data: { userId: user.id, kind: 'sales_terms', version: consumer.salesTermsVersion, granted: true, source: 'review' } });
    await tx.user.update({ where: { id: user.id }, data: { salesTermsVersion: consumer.salesTermsVersion, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
  });
  return user;
}

async function main() {
  const email = consumer.reviewAccountEmail.toLowerCase();
  const [local, domain] = email.split('@');
  const reviewer = await upsertUser(email, { displayName: 'Alex', gender: 'male', interestedIn: 'everyone', bio: 'App review demo account' }, [[255, 94, 98], [255, 153, 102]]);
  const partner = await upsertUser(`${local}-partner@${domain}`, { displayName: 'Mia', gender: 'female', interestedIn: 'everyone', bio: 'Demo profile for app review 👋' }, [[127, 90, 240], [44, 182, 125]]);

  // Eşleşme + örnek sohbet (sohbet, arama, hediye ve şikayet/engelleme incelenebilsin)
  const [a, b] = [reviewer.id, partner.id].sort();
  const conv = await prisma.conversation.upsert({ where: { userAId_userBId: { userAId: a, userBId: b } }, create: { userAId: a, userBId: b, origin: 'MATCH' }, update: {} });
  if (!(await prisma.message.count({ where: { conversationId: conv.id } }))) {
    await prisma.message.create({ data: { conversationId: conv.id, senderId: partner.id, body: 'Hi Alex! Welcome to MeetPoint 👋' } });
  }
  for (const [from, to] of [[reviewer.id, partner.id], [partner.id, reviewer.id]]) {
    await prisma.swipe.upsert({ where: { fromId_toId: { fromId: from, toId: to } }, create: { fromId: from, toId: to, direction: 'like' }, update: {} });
  }

  // Ücretli özellikler (istek, arama, hediye) mağaza satın alması gerektirmeden denenebilsin
  const balance = await prisma.wallet.findUnique({ where: { userId: reviewer.id } });
  const total = (balance?.paid ?? 0) + (balance?.promo ?? 0) + (balance?.earned ?? 0) + (balance?.earnedPromo ?? 0);
  if (total < 1000) await prisma.$transaction((tx) => credit(tx, reviewer.id, { promo: 1000 - total }, 'GRANT', { note: 'app review' }));

  console.log(`İnceleme hesabı hazır: ${email} (eşleşmesi: ${local}-partner@${domain}). Şifre: REVIEW_ACCOUNT_PASSWORD`);
}

main().finally(() => prisma.$disconnect());
