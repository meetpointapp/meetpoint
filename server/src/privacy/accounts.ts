import { retention } from '../config';
import { HttpError, prisma } from '../db';
import { removeProfilePhoto } from '../images';
import { sendMail } from '../mailer';
import { closeAllPendingFor } from '../requestService';
import { revokeAllSessions } from '../sessions';
import { privateStore } from '../storage';

// Hesap silme (KVKK md. 7 + mağaza zorunluluğu). Talep edilince hesap hemen gizlenir ve oturumlar
// kapanır; bekleme süresi içinde giriş yapılırsa hesap geri gelir, süre dolunca kalıcı silinir.
// Yasal saklama gereken kayıtlar (ödenmiş para çekme, satın alma) hesaptan bağımsız kalır.

const fmtDate = (d: Date, locale: string) =>
  d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

export async function requestDeletion(userId: string) {
  // Bekleyen para çekme talebi varken silinemez (önce iptal edilmeli ya da sonuçlanmalı)
  if (await prisma.payout.count({ where: { userId, status: 'PENDING' } })) throw new HttpError(409, 'payout_pending');
  const deleteAfter = new Date(Date.now() + retention.deletionGraceDays * 86_400_000);
  const user = await prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date(), deleteAfter } });
  // Bekleyen istekler kapanır, bloke jetonlar gönderenlere iade edilir
  await closeAllPendingFor(userId);
  await revokeAllSessions(userId, 'account_deleted');
  const when = fmtDate(deleteAfter, user.locale);
  await sendMail(
    user.email,
    user.locale === 'tr' ? 'MeetPoint: hesabın silinecek' : 'MeetPoint: your account will be deleted',
    user.locale === 'tr'
      ? `Merhaba,\n\nHesap silme talebini aldık. Hesabın artık kimseye görünmüyor ve ${when} tarihinde kalıcı olarak silinecek.\n\nFikrini değiştirirsen bu tarihten önce uygulamaya giriş yapman yeterli; hesabın olduğu gibi geri gelir.\n\nBu talebi sen yapmadıysan hemen giriş yap ve şifreni değiştir.`
      : `Hi,\n\nWe received your request to delete your account. Your account is now hidden and will be permanently deleted on ${when}.\n\nIf you change your mind, just sign in before then and everything will be restored.\n\nIf you didn't request this, sign in now and change your password.`,
  ).catch((e) => console.error('deletion mail', e));
  return deleteAfter;
}

// Bekleme süresinde giriş: hesap geri gelir. true dönerse uygulama "hesabın geri yüklendi" der.
export async function restoreIfPendingDeletion(user: { id: string; deletionRequestedAt: Date | null }) {
  if (!user.deletionRequestedAt) return false;
  await prisma.user.update({ where: { id: user.id }, data: { deletionRequestedAt: null, deleteAfter: null } });
  return true;
}

// Kalıcı silme: kullanıcı ve ona bağlı her şey (veritabanı ilişkileri) + dosyalar
export async function hardDeleteUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { photos: true, verifications: true, dataExports: true, kycSubmissions: true },
  });
  if (!user) return false;
  await closeAllPendingFor(userId);
  await revokeAllSessions(userId, 'account_deleted');
  await prisma.user.delete({ where: { id: userId } });
  for (const p of user.photos) await removeProfilePhoto(p.path).catch(() => {});
  for (const v of user.verifications) if (v.selfiePath) await privateStore.remove(v.selfiePath).catch(() => {});
  for (const x of user.dataExports) if (x.path) await privateStore.remove(x.path).catch(() => {});
  for (const k of user.kycSubmissions) if (k.documentPath) await privateStore.remove(k.documentPath).catch(() => {});
  return true;
}
