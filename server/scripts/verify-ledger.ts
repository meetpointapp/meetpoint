// Cüzdan tutarlılık denetimi: npm run verify:ledger
// Her cüzdanın kovaları, hareket defterinin kova toplamlarına eşit olmalı. Tutarsızlık varsa çıkış kodu 1.
import { prisma } from '../src/db';
import { verifyLedger } from '../src/wallet';

async function main() {
  const bad = await verifyLedger();
  const wallets = await prisma.wallet.count();
  if (bad.length) {
    console.error(`TUTARSIZ: ${bad.length}/${wallets} cüzdan → ${bad.slice(0, 20).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Tutarlı: ${wallets} cüzdanın hepsi defterle eşleşiyor`);
  }
  await prisma.$disconnect();
}

void main();
