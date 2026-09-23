import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth';
import { recordError } from '../errors';
import { errorReportLimiter } from '../limits';

// Uygulamanın yakalanmamış hataları. Oturum gerekmez (giriş ekranındaki hatalar da gelsin);
// geçerli jeton varsa kullanıcı kimliği eklenir.
export const clientErrorsRouter = Router();

clientErrorsRouter.post('/', errorReportLimiter, async (req, res) => {
  const body = z
    .object({
      message: z.string().min(1).max(2000),
      stack: z.string().max(20000).default(''),
      platform: z.string().max(20).default(''),
      appVersion: z.string().max(30).default(''),
      context: z.string().max(300).default(''),
    })
    .parse(req.body);
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const userId = token ? await authenticate(token).then((u) => u.id, () => undefined) : undefined;
  await recordError({ source: 'app', ...body, userId });
  res.status(204).end();
});
