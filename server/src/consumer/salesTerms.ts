import { consumer } from '../config';
import { HttpError, prisma } from '../db';

// Satın alma öncesi onay (6502 / Mesafeli Sözleşmeler Yönetmeliği): ön bilgilendirme formu, mesafeli satış
// sözleşmesi ve cayma hakkı istisnası (md. 15/1-ğ) ilk satın almadan önce bir kez, açık onay kutusuyla
// kabul edilir. Metin sürümü değişince bir sonraki satın almadan önce yeniden sorulur. Her onay Consent
// tablosuna kanıt olarak yazılır; her satın alma kaydı o anki kabul edilmiş sürümü saklar.

export const salesTermsNeeded = (user: { salesTermsVersion: string }) => user.salesTermsVersion !== consumer.salesTermsVersion;

export async function acceptSalesTerms(userId: string, ip = '') {
  await prisma.$transaction(async (tx) => {
    await tx.consent.create({
      data: { userId, kind: 'sales_terms', version: consumer.salesTermsVersion, granted: true, source: 'purchase', ip: ip.slice(0, 64) },
    });
    await tx.user.update({ where: { id: userId }, data: { salesTermsVersion: consumer.salesTermsVersion } });
  });
}

export async function requireSalesTerms(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { salesTermsVersion: true } });
  if (salesTermsNeeded(user)) throw new HttpError(409, 'sales_terms_required', { version: consumer.salesTermsVersion });
}

export const salesTermsState = (user: { salesTermsVersion: string }) => ({
  required: salesTermsNeeded(user),
  version: consumer.salesTermsVersion,
  // Daha önce kabul edilmiş ama metin değişmişse uygulama "koşullar güncellendi" der
  updated: user.salesTermsVersion !== '' && salesTermsNeeded(user),
});
