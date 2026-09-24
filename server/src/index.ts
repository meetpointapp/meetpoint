import http from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { requireAdmin, requireAuth, requireCurrentLegal, requireVerifiedEmail } from './auth';
import { assertProductionConfig, config, corsOrigins, scheduler as schedulerConfig } from './config';
import { HttpError, prisma } from './db';
import { recordError } from './errors';
import { idempotency } from './idempotency';
import { flushTraffic, trafficMiddleware } from './moderation/traffic';
import { pool } from './pgPool';
import { closeRealtime, initRealtime } from './realtime';
import { isLeader, startScheduler, stopScheduler } from './scheduler';
import { adminRouter } from './routes/admin';
import { adminAuthRouter } from './routes/adminAuth';
import { adminModerationRouter } from './routes/adminModeration';
import { adminPrivacyRouter } from './routes/adminPrivacy';
import { authRouter } from './routes/auth';
import { boostsRouter } from './routes/boosts';
import { callsRouter } from './routes/calls';
import { clientErrorsRouter } from './routes/clientErrors';
import { payoutsRouter } from './routes/payouts';
import { conversationsRouter } from './routes/conversations';
import { discoverRouter } from './routes/discover';
import { legalRouter } from './routes/legal';
import { mediaRouter } from './routes/media';
import { moderationRouter, publicAppealRouter } from './routes/moderation';
import { dataExportDownloadRouter, privacyRouter } from './routes/privacy';
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
app.disable('x-powered-by');
// Güvenlik başlıkları. Yönetim paneli sadece kendi dosyalarını çalıştırabilir (XSS'e karşı CSP).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    // Fotoğraflar uygulamanın web sürümünden (farklı adres) yüklenebilsin
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  }),
);
// Yayında sadece izin verilen web adresleri; mobil uygulama tarayıcı olmadığı için CORS'tan etkilenmez
app.use(cors(config.isProduction ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: '100kb' }));
// 5651 trafik kaydı (içerik oluşturan istekler)
app.use(trafficMiddleware);
app.use('/admin', express.static('admin', { setHeaders: (res) => res.setHeader('Cache-Control', 'no-store') }));

app.get('/health', (_req, res) => {
  // Geliştirmede süreç kimliği de döner (çok sunuculu testler için)
  res.json({ ok: true, scheduler: isLeader() ? 'leader' : 'follower', ...(config.isProduction ? {} : { pid: process.pid }) });
});
app.use('/legal', legalRouter);
app.use('/media', mediaRouter);
app.use('/webhooks/revenuecat', revenueCatRouter);
app.use('/client-errors', clientErrorsRouter);
app.use('/data-export', dataExportDownloadRouter);
app.use('/appeals', publicAppealRouter);
app.use('/auth', authRouter);
app.use('/admin/api/mfa', requireAuth, adminAuthRouter);
app.use('/admin/api/privacy', requireAuth, requireAdmin, adminPrivacyRouter);
app.use('/admin/api/moderation', requireAuth, requireAdmin, adminModerationRouter);
app.use('/admin/api', requireAuth, requireAdmin, adminRouter);
app.use(
  requireAuth,
  requireVerifiedEmail,
  requireCurrentLegal,
  idempotency,
  profileRouter,
  privacyRouter,
  moderationRouter,
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
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, ...err.details });
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

server.listen(config.port, () => {
  console.log(`MeetPoint server http://localhost:${config.port}`);
  if (schedulerConfig.enabled) startScheduler();
});

// Düzgün kapanma: liderlik kilidini bırak (başka sunucu hemen devralsın), bağlantıları kapat
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: kapanıyor...`);
  await stopScheduler();
  await closeRealtime().catch(() => {});
  server.close();
  await flushTraffic();
  await prisma.$disconnect();
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
