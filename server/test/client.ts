import fs from 'node:fs';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { TEST_PORT, testEnv } from './env';

// Test sunucusu istemcisi (Vitest'ten bağımsız: yük testi de kullanır). Yanıtlar serbest biçimli JSON olduğu için `any` döner.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const B = `http://localhost:${TEST_PORT}`;
const MAIL_DIR = path.resolve(__dirname, '..', testEnv.DEV_MAIL_DIR);
export const PRIVATE_DIR = path.resolve(__dirname, '..', testEnv.PRIVATE_UPLOAD_DIR);

// 1x1 PNG
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// Her test dosyası kendi benzersiz e-postalarını üretir
export const uniqueTag = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

// HTTP kodu `http` alanında döner (bazı yanıtların kendi `status` alanı var, ör. arama durumu).
// Dizi yanıtlar `_arr` alanında.
export async function call(token: string | null | undefined, method: string, p: string, body?: unknown): Promise<any> {
  const res = await fetch(B + p, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    // boş veya JSON olmayan yanıt
  }
  return { ...json, http: res.status, _arr: Array.isArray(json) ? json : undefined };
}

export async function upload(token: string, p: string, field: string, type = 'image/png'): Promise<any> {
  const fd = new FormData();
  fd.append(field, new Blob([png], { type }), 'p.png');
  const res = await fetch(B + p, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
  return { ...(await res.json().catch(() => ({}))), http: res.status };
}

// Test e-posta klasöründen bu adrese gelen en son kodu oku
export async function latestCode(email: string) {
  const key = email.replace(/[^a-z0-9@.]/gi, '_');
  for (let i = 0; i < 40; i++) {
    const files = fs.existsSync(MAIL_DIR) ? fs.readdirSync(MAIL_DIR).filter((f) => f.includes(key)).sort() : [];
    if (files.length) {
      const text = fs.readFileSync(path.join(MAIL_DIR, files.at(-1)!), 'utf8');
      const m = text.match(/\b(\d{6})\b/);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no mail for ${email}`);
}

export type TestUser = { t: string; id: string; email: string };

// Kayıt + e-posta doğrulama
export async function registerVerified(email: string, password = 'password123'): Promise<TestUser> {
  const r = await call(null, 'POST', '/auth/register', { email, password, acceptTerms: true });
  if (r.http !== 201) throw new Error(`register failed ${r.http} ${r.error}`);
  const code = await latestCode(email);
  const v = await call(r.token, 'POST', '/auth/verify-email', { code });
  if (v.http !== 200) throw new Error(`verify failed ${v.http} ${v.error}`);
  return { t: r.token, id: r.userId, email };
}

// Profili ve fotoğrafı olan, doğrulanmış kullanıcı
export async function makeUser(
  name: string,
  gender: 'male' | 'female',
  interestedIn: 'male' | 'female' | 'everyone',
  extra: Record<string, unknown> = {},
): Promise<TestUser> {
  const u = await registerVerified(`${name.toLowerCase()}${uniqueTag()}@test.com`);
  await call(u.t, 'PUT', '/me/profile', { displayName: name, birthDate: '1996-03-10', gender, interestedIn, ...extra });
  await upload(u.t, '/me/photos', 'photo');
  return u;
}

export const login = async (email: string, password = 'password123') =>
  (await call(null, 'POST', '/auth/login', { email, password })).token as string;

export const adminToken = () => login('admin@meetpoint.dev');

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Anlık olay dinleyici (Socket.IO)
export function listen(token: string): Promise<{ s: Socket; events: { name: string; payload: any }[]; has: (n: string) => boolean }> {
  const s = io(B, { auth: { token }, transports: ['websocket'] });
  const events: { name: string; payload: any }[] = [];
  s.onAny((name, payload) => events.push({ name, payload }));
  return new Promise((resolve) => s.on('connect', () => resolve({ s, events, has: (n) => events.some((e) => e.name === n) })));
}
