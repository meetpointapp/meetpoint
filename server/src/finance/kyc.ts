import { HttpError, prisma } from '../db';
import { decryptBuffer, decryptField, encryptBuffer, encryptField, keyedHash } from '../fieldCrypto';
import { sanitizePrivatePhoto } from '../images';
import { sendMail } from '../mailer';
import { privateStore } from '../storage';

// Para çekme için kimlik doğrulama: ad-soyad, TC kimlik no ve kimlik belgesi fotoğrafı. Hepsi şifreli
// saklanır; belge panelden elle incelenir (her görüntüleme işlem kaydına yazılır). Doğrulama sağlayıcısı
// (ör. e-Devlet/NFC kimlik okuma) sonradan decideKyc'yi otomatik çağıracak şekilde takılabilir.
// Aynı TC ile ikinci bir hesap doğrulanamaz (TC'nin anahtarlı özeti tekil).

// TC kimlik numarası algoritması: 11 hane, ilk hane 0 değil, 10. ve 11. haneler sağlama
export function validTc(tc: string) {
  if (!/^[1-9]\d{10}$/.test(tc)) return false;
  const d = [...tc].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d[9] === d10 && d[10] === d11;
}

// İsim karşılaştırması: büyük/küçük harf, Türkçe karakter ve boşluk farkı yok sayılır
export function normalizeName(name: string) {
  return name
    .toLocaleUpperCase('tr')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const namesMatch = (a: string, b: string) => normalizeName(a) === normalizeName(b);

export async function submitKyc(userId: string, input: { fullName: string; tcNo: string; document: Buffer }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.kycStatus === 'approved') throw new HttpError(409, 'kyc_already_approved');
  if (user.kycStatus === 'pending') throw new HttpError(409, 'kyc_pending');
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (normalizeName(fullName).split(' ').length < 2) throw new HttpError(400, 'full_name_required');
  if (!validTc(input.tcNo)) throw new HttpError(400, 'invalid_tc');
  const tcHash = keyedHash(`tc:${input.tcNo}`);
  const other = await prisma.user.findFirst({ where: { kycTcHash: tcHash, id: { not: userId } } });
  if (other) throw new HttpError(409, 'tc_in_use');

  // Belge: yeniden kodlanır (üst veri silinir), şifrelenip özel depoya yazılır
  const image = await sanitizePrivatePhoto(input.document, 2000);
  const sub = await prisma.kycSubmission.create({
    data: { userId, fullName: encryptField(fullName), tcNo: encryptField(input.tcNo), tcHash, documentPath: '' },
  });
  const key = `kyc/${sub.id}.bin`;
  await privateStore.put(key, encryptBuffer(image));
  await prisma.kycSubmission.update({ where: { id: sub.id }, data: { documentPath: key } });
  await prisma.user.update({ where: { id: userId }, data: { kycStatus: 'pending' } });
  return sub;
}

export async function kycDocument(id: string) {
  const sub = await prisma.kycSubmission.findUnique({ where: { id } });
  if (!sub?.documentPath) throw new HttpError(404, 'not_found');
  const blob = await privateStore.read(sub.documentPath);
  if (!blob) throw new HttpError(404, 'not_found');
  return decryptBuffer(blob);
}

export const kycView = (s: { id: string; userId: string; fullName: string; tcNo: string; status: string; note: string; createdAt: Date; reviewedAt: Date | null; reviewedBy: string }) => ({
  id: s.id,
  userId: s.userId,
  fullName: decryptField(s.fullName),
  // Panelde TC'nin sadece son 4 hanesi görünür
  tcMasked: `•••••••${decryptField(s.tcNo).slice(-4)}`,
  status: s.status,
  note: s.note,
  createdAt: s.createdAt,
  reviewedAt: s.reviewedAt,
  reviewedBy: s.reviewedBy,
});

export async function decideKyc(id: string, approve: boolean, note: string, by: string) {
  const sub = await prisma.kycSubmission.findUnique({ where: { id }, include: { user: true } });
  if (!sub) throw new HttpError(404, 'not_found');
  if (sub.status !== 'PENDING') throw new HttpError(409, 'already_answered');
  if (approve) {
    const other = await prisma.user.findFirst({ where: { kycTcHash: sub.tcHash, id: { not: sub.userId } } });
    if (other) throw new HttpError(409, 'tc_in_use');
    await prisma.user.update({
      where: { id: sub.userId },
      data: { kycStatus: 'approved', kycName: sub.fullName, kycTcHash: sub.tcHash, kycVerifiedAt: new Date() },
    });
  } else {
    await prisma.user.update({ where: { id: sub.userId }, data: { kycStatus: 'rejected' } });
    // Reddedilen başvurunun belgesi saklanmaz (veri minimizasyonu)
    await privateStore.remove(sub.documentPath).catch(() => {});
  }
  await prisma.kycSubmission.update({
    where: { id },
    data: { status: approve ? 'APPROVED' : 'REJECTED', note, reviewedBy: by, reviewedAt: new Date(), ...(approve ? {} : { documentPath: '' }) },
  });
  const tr = sub.user.locale === 'tr';
  await sendMail(
    sub.user.email,
    tr ? 'MeetPoint: kimlik doğrulaman' : 'MeetPoint: your identity verification',
    tr
      ? approve
        ? 'Merhaba,\n\nKimliğin doğrulandı; artık kazancını çekebilirsin.'
        : `Merhaba,\n\nKimlik doğrulaman onaylanmadı.${note ? `\n\nSebep: ${note}` : ''}\n\nBilgilerini kontrol edip uygulamadan yeniden gönderebilirsin.`
      : approve
        ? 'Hi,\n\nYour identity has been verified; you can now cash out your earnings.'
        : `Hi,\n\nYour identity verification was not approved.${note ? `\n\nReason: ${note}` : ''}\n\nPlease check your details and submit again in the app.`,
  ).catch((e) => console.error('kyc mail', e));
}
