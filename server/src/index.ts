import http from 'node:http';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { requireAdmin, requireAuth, requireVerifiedEmail } from './auth';
import { assertProductionConfig, config } from './config';
import { recoverCalls } from './calls';
import { HttpError } from './db';
import { recordError } from './errors';
import { initRealtime } from './realtime';
import { expireStaleRequests } from './requestService';
import { adminRouter } from './routes/admin';
import { authRouter } from './routes/auth';
import { boostsRouter } from './routes/boosts';
import { callsRouter } from './routes/calls';
import { clientErrorsRouter } from './routes/clientErrors';
import { payoutsRouter } from './routes/payouts';
import { conversationsRouter } from './routes/conversations';
import { discoverRouter } from './routes/discover';
import { legalRouter } from './routes/legal';
import { profileRouter } from './routes/profile';
import { requestsRouter } from './routes/requests';
import { revenueCatRouter } from './routes/revenuecat';
import { safetyRouter } from './routes/safety';
import { verificationRouter } from './routes/verification';
import { walletRouter } from './routes/wallet';

assertProductionConfig();

const app = express();
// Hız sınırlayıcı IP'yi doğru görsün (VPS'te nginx arkasında çalışırken)
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(config.uploadDir));
app.use('/admin', express.static('admin'));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/legal', legalRouter);
app.use('/webhooks/revenuecat', revenueCatRouter);
app.use('/client-errors', clientErrorsRouter);
app.use('/auth', authRouter);
app.use('/admin/api', requireAuth, requireAdmin, adminRouter);
app.use(
  requireAuth,
  requireVerifiedEmail,
  profileRouter,
  verificationRouter,
  discoverRouter,
  boostsRouter,
  walletRouter,
  requestsRouter,
  conversationsRouter,
  callsRouter,
  payoutsRouter,
  safetyRouter,
);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  if (err instanceof ZodError) return res.status(400).json({ error: 'validation', issues: err.issues });
  console.error(err);
  const e = err instanceof Error ? err : new Error(String(err));
  recordError({
    source: 'server',
    platform: 'server',
    message: e.message,
    stack: e.stack,
    context: `${req.method} ${req.route?.path ?? req.path}`,
    userId: (req as { user?: { id: string } }).user?.id,
  });
  res.status(500).json({ error: 'internal' });
});

const server = http.createServer(app);
initRealtime(server);

setInterval(() => void expireStaleRequests(), 60_000);

// Önce yarım kalan aramaları kapat (zamanlayıcıları bellekteydi), sonra dinlemeye başla
void recoverCalls().then(() =>
  server.listen(config.port, () => {
    console.log(`MeetPoint server http://localhost:${config.port}`);
  }),
);
