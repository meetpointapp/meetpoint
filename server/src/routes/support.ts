import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError } from '../db';
import { supportLimiter } from '../limits';
import {
  RELATED_TYPES,
  SUPPORT_CATEGORIES,
  addUserMessage,
  closeByUser,
  createTicket,
  getUserTicket,
  listUserTickets,
  readAttachment,
} from '../support/tickets';

// Uygulama içi destek talepleri (kullanıcı tarafı)
export const supportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

const text = (max: number) => z.string().trim().min(1).max(max);

supportRouter.get('/support/tickets', async (req, res) => {
  res.json(await listUserTickets(uid(req)));
});

supportRouter.post('/support/tickets', supportLimiter, upload.single('screenshot'), async (req, res) => {
  const data = z
    .object({
      category: z.enum(SUPPORT_CATEGORIES),
      subject: z.string().trim().min(3).max(120),
      body: z.string().trim().min(10).max(4000),
      relatedType: z.enum(RELATED_TYPES).optional(),
      relatedId: z.string().max(40).optional(),
      platform: z.string().max(20).optional(),
      appVersion: z.string().max(40).optional(),
    })
    .parse(req.body);
  const t = await createTicket(uid(req), data, req.file?.buffer);
  res.status(201).json(await getUserTicket(uid(req), t.id));
});

supportRouter.get('/support/tickets/:id', async (req, res) => {
  res.json(await getUserTicket(uid(req), req.params.id, true));
});

supportRouter.post('/support/tickets/:id/messages', supportLimiter, upload.single('screenshot'), async (req, res) => {
  const { body } = z.object({ body: text(4000) }).parse(req.body);
  res.status(201).json(await addUserMessage(uid(req), String(req.params.id), body, req.file?.buffer));
});

supportRouter.post('/support/tickets/:id/close', async (req, res) => {
  await closeByUser(uid(req), req.params.id);
  res.json({ ok: true });
});

supportRouter.get('/support/attachments/:messageId', async (req, res) => {
  const id = z.string().max(40).safeParse(req.params.messageId);
  if (!id.success) throw new HttpError(404, 'not_found');
  const { file } = await readAttachment(id.data, uid(req));
  res.setHeader('Cache-Control', 'private, no-store');
  res.type('image/webp').send(file);
});
