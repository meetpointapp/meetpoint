import { Router } from 'express';
import { publicStore, verifyMediaUrl } from '../storage';

// Profil fotoğrafları: sadece imzalı ve süresi dolmamış adresle (bkz. storage.ts mediaUrl).
// Oturum gerekmez (uygulama görsel önbelleği doğrudan indirir), ama adres tahmin edilemez ve süreli.
export const mediaRouter = Router();

const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

mediaRouter.get('/*key', async (req, res) => {
  const key = ([] as string[]).concat((req.params as { key: string | string[] }).key).join('/');
  const check = verifyMediaUrl(key, req.query.e, req.query.s);
  if (check !== 'ok') return res.status(check === 'expired' ? 410 : 403).json({ error: check === 'expired' ? 'link_expired' : 'forbidden' });
  const data = await publicStore.read(key);
  if (!data) return res.status(404).json({ error: 'not_found' });
  const exp = Number(req.query.e) * 1000;
  res.setHeader('Cache-Control', `public, max-age=${Math.max(0, Math.floor((exp - Date.now()) / 1000))}, immutable`);
  res.type(TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream').send(data);
});
