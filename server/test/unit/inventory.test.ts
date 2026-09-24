import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVENTORY, inventoryMarkdown } from '../../src/privacy/inventory';

// Veri envanteri güncel mi? Veritabanındaki her tablo envanterde olmalı (yeni tablo eklenince
// envanter de güncellenmeli), envanterde olmayan tablo adı da kalmamalı.
const schema = fs.readFileSync(path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);

describe('KVKK veri envanteri', () => {
  it('her tablo envanterde', () => {
    const covered = new Set(INVENTORY.flatMap((e) => e.tables));
    expect(models.filter((m) => !covered.has(m))).toEqual([]);
  });

  it('envanterde olmayan tablo yok', () => {
    expect(INVENTORY.flatMap((e) => e.tables).filter((t) => !models.includes(t))).toEqual([]);
  });

  it('her kayıtta amaç, hukuki sebep ve saklama süresi var; özel nitelikli veri açık rızaya dayanıyor', () => {
    for (const e of INVENTORY) {
      expect(e.purpose && e.retention && e.basis.length, e.category).toBeTruthy();
      if (e.special) expect(e.basis, e.category).toContain('rıza');
    }
  });

  it('belge koddan güncel üretilmiş', () => {
    const file = path.resolve(__dirname, '..', '..', '..', 'docs', 'kvkk', 'veri-envanteri.md');
    expect(fs.readFileSync(file, 'utf8'), 'npm run kvkk:inventory çalıştır').toBe(inventoryMarkdown());
  });
});
