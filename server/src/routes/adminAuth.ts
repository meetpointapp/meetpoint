import { type NextFunction, type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { authedUser, currentSession, uid } from '../auth';
import { audit } from '../audit';
import { HttpError, prisma } from '../db';
import { mfaLimiter } from '../limits';
import { beginSetup, finishSetup, mfaStatus, verifyMfa } from '../mfa';

// Yönetim paneli girişinin ikinci adımı (/admin/api/mfa). Burası 2FA doğrulanmadan da erişilebilir,
// ama sadece yönetim ekibine açıktır. Panelin geri kalanı requireAdmin ile 2FA ister.
export const adminAuthRouter = Router();

adminAuthRouter.use((req: Request, _res: Response, next: NextFunction) => {
  const user = authedUser(req);
  if (!user.isAdmin || !user.adminRole) throw new HttpError(403, 'forbidden');
  next();
});

adminAuthRouter.get('/status', async (req, res) => {
  const user = authedUser(req);
  const email = (await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } })).email;
  res.json({ ...(await mfaStatus(user.id)), verified: user.mfa, role: user.adminRole, email });
});

adminAuthRouter.post('/setup', async (req, res) => {
  res.json(await beginSetup(uid(req)));
});

// İlk kod doğrulanınca 2FA açılır, bu oturum doğrulanmış sayılır, yedek kodlar bir kez gösterilir
adminAuthRouter.post('/enable', mfaLimiter, async (req, res) => {
  const { code } = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).parse(req.body);
  const backupCodes = await finishSetup(uid(req), code);
  await prisma.session.update({ where: { id: currentSession(req) }, data: { mfa: true } });
  await audit(req, 'mfa.enable');
  res.json({ backupCodes });
});

adminAuthRouter.post('/verify', mfaLimiter, async (req, res) => {
  const { code } = z.object({ code: z.string().trim().min(6).max(20) }).parse(req.body);
  const method = await verifyMfa(uid(req), code);
  await prisma.session.update({ where: { id: currentSession(req) }, data: { mfa: true } });
  if (method === 'backup') await audit(req, 'mfa.backup_code_used');
  res.json({ ok: true, ...(await mfaStatus(uid(req))) });
});
