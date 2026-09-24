import fs from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { firebaseServiceAccount, privacy } from './config';
import { prisma } from './db';

// Push bildirimleri (FCM). Servis hesabı ayarlı değilse bildirimler konsola yazılır.
let messaging: Messaging | null = null;
if (firebaseServiceAccount && fs.existsSync(firebaseServiceAccount)) {
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(firebaseServiceAccount, 'utf8'))) });
  messaging = getMessaging();
}

type Kind = 'match' | 'message' | 'request' | 'superlike' | 'call' | 'payout';

const TEXTS: Record<string, Record<Kind, (name: string, extra?: string) => { title: string; body: string }>> = {
  tr: {
    match: (n) => ({ title: 'Yeni eşleşme! 💞', body: `${n} ile eşleştin. İlk mesajı sen at!` }),
    message: (n, t) => ({ title: n, body: t || 'Yeni mesaj' }),
    request: (n, k) => ({ title: 'Yeni istek', body: `${n} sana ${k === 'MESSAGE' ? 'mesaj' : k === 'VOICE' ? 'sesli arama' : 'görüntülü arama'} isteği gönderdi.` }),
    superlike: (n) => ({ title: 'Süper beğeni! ⭐', body: `${n} seni süper beğendi.` }),
    call: (n, k) => ({ title: k === 'VIDEO' ? 'Görüntülü arama 📹' : 'Sesli arama 📞', body: `${n} seni arıyor…` }),
    payout: (_n, s) =>
      s === 'PAID'
        ? { title: 'Ödemen gönderildi 💸', body: 'Para çekme talebin ödendi. Hesabına geçmesi birkaç gün sürebilir.' }
        : { title: 'Para çekme talebi', body: 'Talebin reddedildi, jetonların bakiyene geri eklendi.' },
  },
  en: {
    match: (n) => ({ title: "It's a match! 💞", body: `You and ${n} liked each other. Say hi!` }),
    message: (n, t) => ({ title: n, body: t || 'New message' }),
    request: (n, k) => ({ title: 'New request', body: `${n} sent you a ${k === 'MESSAGE' ? 'message' : k === 'VOICE' ? 'voice call' : 'video call'} request.` }),
    superlike: (n) => ({ title: 'Super like! ⭐', body: `${n} super liked you.` }),
    call: (n, k) => ({ title: k === 'VIDEO' ? 'Video call 📹' : 'Voice call 📞', body: `${n} is calling you…` }),
    payout: (_n, s) =>
      s === 'PAID'
        ? { title: 'Payout sent 💸', body: 'Your cash-out was paid. It may take a few days to reach your account.' }
        : { title: 'Cash-out request', body: 'Your request was declined and the coins are back in your balance.' },
  },
};

// Alıcının diline göre bildirim gönderir. Hata olursa sessizce loglar (asıl işlemi bozmaz).
export async function notify(toUserId: string, kind: Kind, fromUserId: string, extra?: string, data: Record<string, string> = {}) {
  try {
    const [to, from] = await Promise.all([
      prisma.user.findUnique({ where: { id: toUserId }, select: { locale: true, devices: true, consentOverseasAt: true } }),
      prisma.profile.findUnique({ where: { userId: fromUserId }, select: { displayName: true } }),
    ]);
    // Bildirim yurt dışındaki Firebase üzerinden gider: rıza yoksa gönderilmez (uygulama içi bildirim sürer)
    if (!to || (privacy.overseasConsentRequired && !to.consentOverseasAt)) return;
    const text = (TEXTS[to.locale] ?? TEXTS.en)[kind](from?.displayName ?? 'MeetPoint', extra);
    const payload = { ...data, kind };

    if (!messaging) {
      console.log(`[push dev] → ${toUserId}: ${text.title} · ${text.body}`);
      return;
    }
    const tokens = to.devices.map((d) => d.token);
    if (!tokens.length) return;
    const res = await messaging.sendEachForMulticast({ tokens, notification: text, data: payload });
    // Geçersiz jetonları temizle
    const dead = res.responses
      .map((r, i) => (!r.success && r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i] : null))
      .filter((t): t is string => t !== null);
    if (dead.length) await prisma.device.deleteMany({ where: { token: { in: dead } } });
  } catch (e) {
    console.error('[push] failed', e);
  }
}
