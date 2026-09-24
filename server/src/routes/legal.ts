import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { config, privacy, retention } from '../config';
import { HttpError } from '../db';
import { INVENTORY } from '../privacy/inventory';

// Kullanım koşulları ve gizlilik politikası (herkese açık; mağaza sayfaları da bu adresleri kullanır).
// İçerik server/legal/<belge>.<dil>.html dosyalarında.
export const legalRouter = Router();

const TITLES: Record<string, Record<string, string>> = {
  terms: { tr: 'Kullanım Koşulları', en: 'Terms of Service' },
  privacy: { tr: 'Gizlilik Politikası ve KVKK Aydınlatma Metni', en: 'Privacy Policy' },
  'consent-special': { tr: 'Açık Rıza: Cinsel Yönelim Verisi', en: 'Explicit Consent: Sexual Orientation Data' },
  'consent-overseas': { tr: 'Açık Rıza: Yurt Dışına Aktarım', en: 'Explicit Consent: Transfer Abroad' },
  'consent-selfie': { tr: "Açık Rıza: Doğrulama Selfie'si", en: 'Explicit Consent: Verification Selfie' },
  'consent-marketing': { tr: 'Ticari Elektronik İleti İzni', en: 'Marketing Emails' },
  retention: { tr: 'Kişisel Veri Saklama ve İmha Politikası', en: 'Data Retention and Deletion Policy' },
  safety: { tr: 'Güvenlik Merkezi', en: 'Safety Center' },
  community: { tr: 'Topluluk Kuralları', en: 'Community Rules' },
};

const DOCS = Object.keys(TITLES) as [string, ...string[]];

const versionOf = (doc: string) =>
  doc === 'terms' || doc === 'community' || doc === 'safety'
    ? config.termsVersion
    : doc === 'privacy' || doc === 'retention'
      ? config.privacyVersion
      : privacy.consentVersions[({ 'consent-special': 'special_category', 'consent-overseas': 'overseas_transfer', 'consent-selfie': 'selfie', 'consent-marketing': 'marketing' } as const)[doc as 'consent-special']];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Saklama ve imha politikası: süreler koddaki ayarlardan ve veri envanterinden üretilir (her zaman güncel)
function retentionBody(lang: string) {
  const intro =
    lang === 'tr'
      ? `<p>Kişisel veriler, işlenme amacı için gereken süre boyunca saklanır; süre dolunca otomatik olarak silinir. İmha işlemi en geç ${Math.round(retention.intervalMs / 60_000)} dakikada bir çalışır ve her imha değiştirilemez bir kayda yazılır. Yasal saklama yükümlülüğü olan kayıtlar (ör. ödeme kayıtları) bu süre boyunca saklanır.</p>
<ul><li>Hesap silme talebi: hesap hemen gizlenir, <b>${retention.deletionGraceDays} gün</b> içinde giriş yapılmazsa kalıcı olarak silinir.</li>
<li>Hareketsiz hesap: <b>${Math.round(retention.inactiveDays / 365)} yıl</b> giriş yapılmazsa, ${retention.inactiveWarnDays} gün önce e-postayla haber verilerek silinir.</li>
<li>"Verilerimi indir" dosyası: ${retention.exportTtlDays} gün veya ilk indirmede silinir.</li></ul><h2>Veri kategorilerine göre süreler</h2>`
      : `<p>Personal data is kept only as long as needed for its purpose and deleted automatically afterwards. Deletion runs at least every ${Math.round(retention.intervalMs / 60_000)} minutes and every deletion is logged immutably. Records with a legal retention duty (e.g. payments) are kept for that period.</p>
<ul><li>Account deletion: hidden at once, permanently deleted after <b>${retention.deletionGraceDays} days</b> unless you sign in.</li>
<li>Inactive accounts: deleted after <b>${Math.round(retention.inactiveDays / 365)} years</b> without sign-in, with an email notice ${retention.inactiveWarnDays} days before.</li>
<li>"Download my data" file: deleted after ${retention.exportTtlDays} days or the first download.</li></ul><h2>Periods by category (Turkish)</h2>`;
  const rows = INVENTORY.filter((e) => !e.tables.includes('SocketIoAttachment'))
    .map((e) => `<tr><td>${esc(e.category)}</td><td>${esc(e.retention)}</td></tr>`)
    .join('');
  return `${intro}<table><thead><tr><th>${lang === 'tr' ? 'Veri' : 'Data'}</th><th>${lang === 'tr' ? 'Saklama' : 'Retention'}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const DRAFT: Record<string, string> = {
  tr: 'TASLAK: Bu metin yayın öncesinde bir hukukçu tarafından gözden geçirilmelidir. Köşeli parantezli alanlar şirket kurulunca doldurulacaktır.',
  en: 'DRAFT: This text must be reviewed by a lawyer before launch. Bracketed fields will be filled in once the company is founded.',
};

legalRouter.get('/:doc', (req, res) => {
  const parsed = z.object({ doc: z.enum(DOCS) }).safeParse(req.params);
  if (!parsed.success) throw new HttpError(404, 'not_found');
  const { doc } = parsed.data;
  const { lang } = z.object({ lang: z.enum(['tr', 'en']).default('tr') }).parse(req.query);
  let body: string;
  if (doc === 'retention') body = retentionBody(lang);
  else {
    const file = path.join('legal', `${doc}.${lang}.html`);
    if (!fs.existsSync(file)) throw new HttpError(404, 'not_found');
    body = fs.readFileSync(file, 'utf8');
  }
  const other = lang === 'tr' ? 'en' : 'tr';
  // Genel CSP satır içi stile izin vermez; bu sayfa betik içermez, sadece kendi stilini kullanır
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");

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
  table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #8883;padding:8px 6px;text-align:left;vertical-align:top}
</style></head><body><main>
<a class="lang" href="?lang=${other}">${other === 'en' ? 'English' : 'Türkçe'}</a>
<h1>${TITLES[doc][lang]}</h1>
<div class="meta">MeetPoint · ${lang === 'tr' ? 'Sürüm' : 'Version'} ${versionOf(doc)}</div>
${config.isProduction ? '' : `<div class="draft">${DRAFT[lang]}</div>`}
${body}
</main></body></html>`);
});
