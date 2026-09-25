import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { acceptCall, callHistory, confirmJoined, getCall, hangUp, rateCall, renewMediaToken, reportAndHangUp, sendGift, startCall } from '../calls';
import { CALL_KINDS } from '../config';
import { requestLimiter } from '../limits';
import { REPORT_REASONS } from '../moderation/reports';
import { requireNotRestricted } from '../moderation/sanctions';

export const callsRouter = Router();


callsRouter.post('/calls', requireNotRestricted, requestLimiter, async (req, res) => {
  const { toId, kind } = z.object({ toId: z.string(), kind: z.enum(CALL_KINDS) }).parse(req.body);
  res.status(201).json(await startCall(uid(req), toId, kind));
});

callsRouter.get('/calls', async (req, res) => {
  res.json(await callHistory(uid(req)));
});

callsRouter.get('/calls/:id', async (req, res) => {
  res.json(await getCall(req.params.id, uid(req)));
});

callsRouter.post('/calls/:id/accept', async (req, res) => {
  res.json(await acceptCall(req.params.id, uid(req)));
});

// Ses/görüntü motoru Agora kanalına gerçekten katıldığında uygulama bunu çağırır (Faz 15: adil ücretlendirme)
callsRouter.post('/calls/:id/joined', async (req, res) => {
  res.json(await confirmJoined(req.params.id, uid(req)));
});

// Agora jetonu süresi dolmadan yenilenir (Faz 15: uzun ve kesintisiz aramalar)
callsRouter.post('/calls/:id/media-token', async (req, res) => {
  res.json(await renewMediaToken(req.params.id, uid(req)));
});

// Kapat / reddet / iptal: duruma göre sunucu karar verir
callsRouter.post('/calls/:id/hangup', async (req, res) => {
  res.json(await hangUp(req.params.id, uid(req)));
});

callsRouter.post('/calls/:id/report', async (req, res) => {
  const { reason } = z.object({ reason: z.enum(REPORT_REASONS) }).parse(req.body);
  res.json(await reportAndHangUp(req.params.id, uid(req), reason));
});

callsRouter.post('/calls/:id/gifts', async (req, res) => {
  const { giftId } = z.object({ giftId: z.string() }).parse(req.body);
  res.json(await sendGift(req.params.id, uid(req), giftId));
});

callsRouter.post('/calls/:id/rate', async (req, res) => {
  const { rating, reportReason } = z
    .object({ rating: z.number().int().min(1).max(5), reportReason: z.enum(REPORT_REASONS).optional() })
    .parse(req.body);
  await rateCall(req.params.id, uid(req), rating, reportReason);
  res.json({ ok: true });
});
