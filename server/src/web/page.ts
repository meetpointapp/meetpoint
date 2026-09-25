import type { Response } from 'express';

// Sunucunun ürettiği basit web sayfaları (yardım merkezi, hesap silme): betik yok, kendi stili var.
// Genel CSP satır içi stile izin vermez; bu sayfalar kendi dar CSP'lerini koyar (form sadece kendine gönderir).

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function sendPage(res: Response, lang: 'tr' | 'en', title: string, body: string, status = 200) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).type('html').send(`<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · MeetPoint</title>
<style>
  :root{--coral:#FF4D6D;--ink:#231a1c;--muted:#6b5b5e;--bg:#fffbfa;--card:#fff;--line:#8883}
  @media (prefers-color-scheme:dark){:root{--ink:#f3e9ea;--muted:#b9a9ab;--bg:#16121a;--card:#1f1a23}}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:720px;margin:0 auto;padding:24px 16px 48px}
  h1{font-size:26px;margin:8px 0 4px}h2{font-size:18px;margin:28px 0 8px}
  .muted{color:var(--muted);font-size:14px}.lang{float:right;color:var(--coral)}
  a{color:var(--coral)}
  details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 14px;margin:8px 0}
  summary{cursor:pointer;font-weight:600}
  form{display:flex;flex-direction:column;gap:10px;margin:16px 0}
  .row{flex-direction:row}
  input{font:inherit;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);flex:1;min-width:0}
  button{font:inherit;font-weight:700;padding:10px 18px;border-radius:12px;border:0;background:var(--coral);color:#fff;cursor:pointer}
  .box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:16px 0}
  .error{border-color:#d33;color:#d33}.ok{border-color:#1fa463}
</style></head><body><main>
<a class="lang" href="?lang=${lang === 'tr' ? 'en' : 'tr'}">${lang === 'tr' ? 'English' : 'Türkçe'}</a>
${body}
</main></body></html>`);
}
