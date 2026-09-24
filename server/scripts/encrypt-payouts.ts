import { prisma } from '../src/db';
import { encryptField, isEncrypted } from '../src/fieldCrypto';
import { maskAccount } from '../src/iban';

// Şifreleme öncesi açılmış para çekme taleplerindeki IBAN/PayPal ve hesap sahibi bilgisini şifreler.
// Tekrar çalıştırmak güvenli: zaten şifreli kayıtlara dokunmaz. Kullanım: npm run encrypt:payouts
async function main() {
  const payouts = await prisma.payout.findMany();
  let changed = 0;
  for (const p of payouts) {
    if (isEncrypted(p.accountValue) && (!p.accountName || isEncrypted(p.accountName))) continue;
    await prisma.payout.update({
      where: { id: p.id },
      data: {
        accountValue: isEncrypted(p.accountValue) ? p.accountValue : encryptField(p.accountValue),
        accountName: !p.accountName || isEncrypted(p.accountName) ? p.accountName : encryptField(p.accountName),
        accountHint: p.accountHint || (isEncrypted(p.accountValue) ? '' : maskAccount(p.method, p.accountValue)),
      },
    });
    changed++;
  }
  console.log(`${payouts.length} talep incelendi, ${changed} tanesi şifrelendi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
