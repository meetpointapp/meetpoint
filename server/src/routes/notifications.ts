import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { prisma } from '../db';
import { NOTIFY_PREFS, notifyPrefsState } from '../notify';

// Bildirim tercihleri: türe göre aç/kapa ve sessiz saatler. Kampanya izinleri (e-posta / bildirim)
// rıza olarak /me/consents üzerinden yönetilir (kanıt kaydı tutulur).
export const notificationsRouter = Router();

const PREF_SELECT = { notifyPrefs: true, quietStart: true, quietEnd: true, tzOffsetMin: true } as const;
const minute = z.number().int().min(0).max(1439);

notificationsRouter.get('/me/notifications', async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) }, select: PREF_SELECT });
  res.json(notifyPrefsState(u));
});

notificationsRouter.put('/me/notifications', async (req, res) => {
  const body = z
    .object({
      prefs: z.partialRecord(z.enum(NOTIFY_PREFS), z.boolean()).optional(),
      quietHours: z.object({ enabled: z.boolean(), start: minute, end: minute }).optional(),
      // Cihazın UTC farkı (dakika): -12..+14 saat
      tzOffsetMin: z.number().int().min(-720).max(840).optional(),
    })
    .parse(req.body);
  const userId = uid(req);
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PREF_SELECT });
  const prefs = { ...((current.notifyPrefs ?? {}) as Record<string, boolean>), ...body.prefs };
  const u = await prisma.user.update({
    where: { id: userId },
    data: {
      notifyPrefs: prefs,
      ...(body.quietHours && {
        quietStart: body.quietHours.enabled ? body.quietHours.start : null,
        quietEnd: body.quietHours.enabled ? body.quietHours.end : null,
      }),
      ...(body.tzOffsetMin !== undefined && { tzOffsetMin: body.tzOffsetMin }),
    },
    select: PREF_SELECT,
  });
  res.json(notifyPrefsState(u));
});
