// Arayüz turları için ortak yardımcılar (eski test kütüphanesi: status alanı HTTP kodudur)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Turlar geliştirme sunucusuna (seed'li dev.db) ve derlenmiş web uygulamasına karşı çalışır
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..').replaceAll('\\', '/');
export const B = process.env.API_URL ?? 'http://localhost:4000';
export const WEB = process.env.WEB_URL ?? 'http://localhost:8080';
const MAIL_DIR = `${REPO}/server/dev-mails`;
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export async function call(token, method, p, body) {
  const res = await fetch(B + p, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {}
  return { ...json, status: res.status, _arr: Array.isArray(json) ? json : undefined };
}

export async function upload(token, p, field, type = 'image/png') {
  const fd = new FormData();
  fd.append(field, new Blob([png], { type }), 'p.png');
  const res = await fetch(B + p, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
  return { ...(await res.json()), status: res.status };
}

let failures = 0;
export function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label} ${extra}`);
  if (!cond) {
    failures++;
    process.exitCode = 1;
  }
}
export const summary = () => console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');

// dev-mails klasöründen bu adrese gelen en son kodu oku
export async function latestCode(email) {
  for (let i = 0; i < 20; i++) {
    const files = fs.existsSync(MAIL_DIR)
      ? fs.readdirSync(MAIL_DIR).filter((f) => f.includes(email.replace(/[^a-z0-9@.]/gi, '_'))).sort()
      : [];
    if (files.length) {
      const text = fs.readFileSync(path.join(MAIL_DIR, files.at(-1)), 'utf8');
      const m = text.match(/\b(\d{6})\b/);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no mail for ${email}`);
}

// Kayıt + e-posta doğrulama: doğrulanmış bir kullanıcı döndürür
export async function registerVerified(email, password = 'password123') {
  const r = await call(null, 'POST', '/auth/register', { email, password, acceptTerms: true });
  if (r.status !== 201) throw new Error(`register failed ${r.status} ${r.error}`);
  const code = await latestCode(email);
  const v = await call(r.token, 'POST', '/auth/verify-email', { code });
  if (v.status !== 200) throw new Error(`verify failed ${v.status} ${v.error}`);
  return { t: r.token, id: r.userId };
}
