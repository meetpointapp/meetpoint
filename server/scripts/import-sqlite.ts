// Tek seferlik: eski SQLite geliştirme veritabanındaki tüm verileri PostgreSQL'e aktarır.
//   npx tsx scripts/import-sqlite.ts prisma/dev.sqlite.bak
// Hedef veritabanı boş olmalı (mevcut veriyi asla ezmez). Tür dönüşümleri Prisma şemasından okunur:
// SQLite tarihleri milisaniye, mantıksal değerleri 0/1, JSON alanları metin olarak saklar.
import { DatabaseSync } from 'node:sqlite';
import { Prisma, PrismaClient } from '@prisma/client';

// Yabancı anahtar sırası: önce bağımsız tablolar
const ORDER = [
  'User',
  'Profile',
  'Photo',
  'Swipe',
  'ContactRequest',
  'WalletEntry',
  'Conversation',
  'Message',
  'Block',
  'Report',
  'EmailCode',
  'VerificationRequest',
  'Device',
  'Purchase',
  'Call',
  'CallGift',
  'Payout',
  'ErrorLog',
];

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Kullanım: npx tsx scripts/import-sqlite.ts <sqlite-dosyası>');
  const sqlite = new DatabaseSync(file, { readOnly: true });
  const prisma = new PrismaClient();

  if ((await prisma.user.count()) > 0) throw new Error('Hedef veritabanı boş değil; aktarım yapılmadı.');

  const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
  const missing = [...models.keys()].filter((m) => !ORDER.includes(m));
  if (missing.length) throw new Error(`Aktarım sırasında olmayan tablolar: ${missing.join(', ')}`);

  for (const name of ORDER) {
    const model = models.get(name)!;
    const scalar = model.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum');
    const exists = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
    if (!exists) {
      console.log(`${name}: SQLite'ta yok, atlandı`);
      continue;
    }
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
    const data = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const f of scalar) {
        const v = r[f.name];
        if (v === undefined) continue; // SQLite'ta olmayan yeni alan: varsayılan değer kullanılır
        if (v === null) out[f.name] = f.type === 'Json' ? Prisma.JsonNull : null;
        else if (f.type === 'DateTime') out[f.name] = new Date(typeof v === 'number' ? v : String(v));
        else if (f.type === 'Boolean') out[f.name] = v === 1 || v === true || v === '1';
        else if (f.type === 'Json') out[f.name] = typeof v === 'string' ? JSON.parse(v) : v;
        else if (f.type === 'Int') out[f.name] = Number(v);
        else if (f.type === 'Float') out[f.name] = Number(v);
        else out[f.name] = v;
      }
      return out;
    });
    const delegate = (prisma as unknown as Record<string, { createMany: (a: { data: unknown[] }) => Promise<{ count: number }> }>)[
      name.charAt(0).toLowerCase() + name.slice(1)
    ];
    let count = 0;
    for (let i = 0; i < data.length; i += 500) count += (await delegate.createMany({ data: data.slice(i, i + 500) })).count;
    console.log(`${name}: ${count}/${rows.length}`);
    if (count !== rows.length) throw new Error(`${name} eksik aktarıldı`);
  }

  sqlite.close();
  await prisma.$disconnect();
  console.log('Aktarım tamam.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
