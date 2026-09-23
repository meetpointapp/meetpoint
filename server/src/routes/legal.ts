import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { HttpError } from '../db';

// Kullanım koşulları ve gizlilik politikası (herkese açık; mağaza sayfaları da bu adresleri kullanır).
// İçerik server/legal/<belge>.<dil>.html dosyalarında.
export const legalRouter = Router();

const TITLES: Record<string, Record<string, string>> = {
  terms: { tr: 'Kullanım Koşulları', en: 'Terms of Service' },
  privacy: { tr: 'Gizlilik Politikası ve KVKK Aydınlatma Metni', en: 'Privacy Policy' },
};

const DRAFT: Record<string, string> = {
  tr: 'TASLAK: Bu metin yayın öncesinde bir hukukçu tarafından gözden geçirilmelidir. Köşeli parantezli alanlar şirket kurulunca doldurulacaktır.',
  en: 'DRAFT: This text must be reviewed by a lawyer before launch. Bracketed fields will be filled in once the company is founded.',
};

legalRouter.get('/:doc', (req, res) => {
  const { doc } = z.object({ doc: z.enum(['terms', 'privacy']) }).parse(req.params);
  const { lang } = z.object({ lang: z.enum(['tr', 'en']).default('tr') }).parse(req.query);
  const file = path.join('legal', `${doc}.${lang}.html`);
  if (!fs.existsSync(file)) throw new HttpError(404, 'not_found');
  const body = fs.readFileSync(file, 'utf8');
  const other = lang === 'tr' ? 'en' : 'tr';

  res.type('html').send(`<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${TITLES[doc][lang]} · MeetPoint</title>
<style>
  :root{--coral:#FF4D6D;--ink:#231a1c;--muted:#6b5b5e;--bg:#fffbfa;--card:#fff}
  @media (prefers-color-scheme:dark){:root{--ink:#f3e9ea;--muted:#b9a9ab;--bg:#16121a;--card:#1f1a23}}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:760px;margin:0 auto;padding:24px 16px 48px}
  h1{font-size:26px;margin:8px 0 4px}h2{font-size:18px;margin:28px 0 6px}
  .meta{color:var(--muted);font-size:14px}.lang{float:right;color:var(--coral)}
  .draft{background:#fff3cd;color:#664d03;border-radius:12px;padding:10px 14px;font-size:14px;margin:16px 0}
  a{color:var(--coral)}
</style></head><body><main>
<a class="lang" href="?lang=${other}">${other === 'en' ? 'English' : 'Türkçe'}</a>
<h1>${TITLES[doc][lang]}</h1>
<div class="meta">MeetPoint · ${lang === 'tr' ? 'Sürüm' : 'Version'} ${config.termsVersion}</div>
${config.isProduction ? '' : `<div class="draft">${DRAFT[lang]}</div>`}
${body}
</main></body></html>`);
});
