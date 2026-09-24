import fs from 'node:fs';
import path from 'node:path';
import { inventoryMarkdown } from '../src/privacy/inventory';

// docs/kvkk/veri-envanteri.md dosyasını koddaki envanterden üretir
const out = path.resolve(__dirname, '..', '..', 'docs', 'kvkk', 'veri-envanteri.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, inventoryMarkdown());
console.log(`yazıldı: ${out}`);
