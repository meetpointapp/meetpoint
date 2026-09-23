import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { uid } from './auth';
import { HttpError, prisma } from './db';

// Tekrar gönderilen isteğe karşı koruma (idempotency). Uygulama her yazma isteğine (POST/PUT/DELETE)
// benzersiz bir "Idempotency-Key" ekler; ağ koparsa aynı anahtarla tekrar dener.
//  - Anahtar ilk kez geliyorsa istek normal işlenir, yanıt saklanır.
//  - Aynı anahtar aynı istekle tekrar gelirse işlem YAPILMAZ, saklanan yanıt aynen döner
//    ("Idempotent-Replayed: true"). Böylece bir hediye, mesaj ya da ödeme iki kez işlenemez.
//  - Aynı anahtar farklı bir istekle gelirse 422; ilk istek hâlâ sürüyorsa 409.
//  - Sunucu hatasında (5xx) kayıt silinir: tekrar deneme gerçekten yeniden çalışır.
// Başlık yoksa istek eskisi gibi işlenir (geriye uyumluluk). Kayıtlar 24 saat saklanır.

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
export const IDEMPOTENCY_TTL_HOURS = 24;

export async function idempotency(req: Request, res: Response, next: NextFunction) {
  const key = req.header('Idempotency-Key');
  if (!key || req.method === 'GET' || req.method === 'HEAD') return next();
  if (!KEY_PATTERN.test(key)) throw new HttpError(400, 'invalid_idempotency_key');

  const userId = uid(req);
  const route = `${req.method} ${req.originalUrl.split('?')[0]}`;
  // Dosya yüklemelerinde gövde henüz okunmadı: yol ve anahtar yeterli
  const requestHash = crypto.createHash('sha256').update(route).update(JSON.stringify(req.body ?? {})).digest('hex');

  try {
    await prisma.idempotencyKey.create({ data: { userId, key, route, requestHash } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    const existing = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
    if (!existing) throw new HttpError(409, 'request_in_progress'); // bu arada silindi (5xx): tekrar denensin
    if (existing.requestHash !== requestHash) throw new HttpError(422, 'idempotency_key_reused');
    if (existing.status !== 'DONE') throw new HttpError(409, 'request_in_progress');
    res.setHeader('Idempotent-Replayed', 'true');
    res.status(existing.responseStatus ?? 200);
    return existing.responseBody === null ? res.end() : res.json(existing.responseBody);
  }

  let body: unknown = null;
  const json = res.json.bind(res);
  res.json = (b: unknown) => {
    body = b;
    return json(b);
  };
  res.on('finish', () => {
    const where = { userId_key: { userId, key } };
    const done =
      res.statusCode >= 500
        ? prisma.idempotencyKey.delete({ where })
        : prisma.idempotencyKey.update({
            where,
            data: {
              status: 'DONE',
              responseStatus: res.statusCode,
              responseBody: body === null ? Prisma.JsonNull : (body as Prisma.InputJsonValue),
            },
          });
    done.catch((err) => console.error('idempotency save failed', err));
  });
  next();
}

export const cleanupIdempotencyKeys = () =>
  prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - IDEMPOTENCY_TTL_HOURS * 3600_000) } } });
