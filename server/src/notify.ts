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

type Kind = 'match' | 'message' | 'request' | 'superlike' | 'call' | 'payout' | 'support';

// Kullanıcının türe göre kapatabildiği bildirimler (Profil › Bildirimler). Ödeme ve destek yanıtı
// hesapla ilgili zorunlu bildirimlerdir, kapatılamaz.
export const NOTIFY_PREFS = ['message', 'match', 'request', 'call', 'like'] as const;
export type NotifyPref = (typeof NOTIFY_PREFS)[number];
const PREF_OF: Partial<Record<Kind, NotifyPref>> = { message: 'message', match: 'match', request: 'request', call: 'call', superlike: 'like' };

type PrefUser = { notifyPrefs: unknown; quietStart: number | null; quietEnd: number | null; tzOffsetMin: number };

// Sessiz saat (kullanıcının yerel saatiyle; gece yarısını aşan aralık da olur: 23:00-08:00)
export function inQuietHours(u: PrefUser, now = new Date()) {
  if (u.quietStart === null || u.quietEnd === null || u.quietStart === u.quietEnd) return false;
  const local = (((now.getUTCHours() * 60 + now.getUTCMinutes() + u.tzOffsetMin) % 1440) + 1440) % 1440;
  return u.quietStart < u.quietEnd ? local >= u.quietStart && local < u.quietEnd : local >= u.quietStart || local < u.quietEnd;
}

// Bu bildirim telefona gitsin mi? Aramalar sessiz saatten muaf (anlık olmalı), ama türü kapatılabilir.
export function pushDecision(u: PrefUser, kind: Kind, now = new Date()): 'ok' | 'disabled' | 'quiet' {
  const pref = PREF_OF[kind];
  const prefs = (u.notifyPrefs ?? {}) as Record<string, unknown>;
  if (pref && prefs[pref] === false) return 'disabled';
  if (kind !== 'call' && inQuietHours(u, now)) return 'quiet';
  return 'ok';
}

export function notifyPrefsState(u: PrefUser) {
  const prefs = (u.notifyPrefs ?? {}) as Record<string, unknown>;
  return {
    prefs: Object.fromEntries(NOTIFY_PREFS.map((k) => [k, prefs[k] !== false])) as Record<NotifyPref, boolean>,
    quietHours: { enabled: u.quietStart !== null && u.quietEnd !== null, start: u.quietStart ?? 23 * 60, end: u.quietEnd ?? 8 * 60 },
    tzOffsetMin: u.tzOffsetMin,
  };
}

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
    support: (_n, subject) => ({ title: 'Destek yanıtı 💬', body: subject ? `Talebine yanıt geldi: ${subject}` : 'Destek talebine yanıt geldi.' }),
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
    support: (_n, subject) => ({ title: 'Support reply 💬', body: subject ? `New reply to: ${subject}` : 'Your support request has a new reply.' }),
  },
};

// Faz 15: push güvenilirliği. Bildirimden dokununca uygulama doğru ekrana gitsin diye (elde
// zaten olan verilerden) bir yol hesaplanır. Karşılığı olmayan türler (superlike, request) genel
// bir listeye gider.
function routeFor(kind: Kind, data: Record<string, string>): string | undefined {
  switch (kind) {
    case 'message':
    case 'match':
      return data.conversationId ? `/chat/${data.conversationId}` : undefined;
    case 'call':
      return data.callId ? `/call/${data.callId}` : undefined;
    case 'support':
      return data.ticketId ? `/support/${data.ticketId}` : '/support';
    case 'superlike':
      return '/likes';
    case 'request':
      return '/requests';
    case 'payout':
      return '/wallet';
  }
}

// Rozet sayacı: karşı taraftan gelen, henüz okunmamış mesajlar (uygulama içi rozetle aynı hesap)
async function unreadBadge(userId: string) {
  return prisma.message.count({
    where: { readAt: null, senderId: { not: userId }, conversation: { OR: [{ userAId: userId }, { userBId: userId }] } },
  });
}

// Alıcının diline göre bildirim gönderir. Hata olursa sessizce loglar (asıl işlemi bozmaz).
export async function notify(toUserId: string, kind: Kind, fromUserId: string, extra?: string, data: Record<string, string> = {}) {
  try {
    const [to, from] = await Promise.all([
      prisma.user.findUnique({ where: { id: toUserId }, select: { locale: true, devices: true, consentOverseasAt: true, notifyPrefs: true, quietStart: true, quietEnd: true, tzOffsetMin: true } }),
      prisma.profile.findUnique({ where: { userId: fromUserId }, select: { displayName: true } }),
    ]);
    // Bildirim yurt dışındaki Firebase üzerinden gider: rıza yoksa gönderilmez (uygulama içi bildirim sürer)
    if (!to || (privacy.overseasConsentRequired && !to.consentOverseasAt)) return;
    // Kullanıcı bu türü kapattıysa veya sessiz saatteyse telefona gitmez (uygulama içinde görünür)
    const decision = pushDecision(to, kind);
    if (decision !== 'ok') {
      if (!messaging) console.log(`[push dev] → ${toUserId}: ${kind} gönderilmedi (${decision === 'quiet' ? 'sessiz saat' : 'kapalı'})`);
      return;
    }
    const text = (TEXTS[to.locale] ?? TEXTS.en)[kind](from?.displayName ?? 'MeetPoint', extra);
    const route = routeFor(kind, data);
    const payload = { ...data, kind, ...(route ? { route } : {}) };

    if (!messaging) {
      console.log(`[push dev] → ${toUserId}: ${text.title} · ${text.body}`);
      return;
    }
    const tokens = to.devices.map((d) => d.token);
    if (!tokens.length) return;
    const badge = await unreadBadge(toUserId);
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: text,
      data: payload,
      // Aramalar ve mesajlar anlık olmalı: yüksek öncelik, uygulama arka plandayken de teslim edilsin.
      // Aramalar ayrıca kendi bildirim kanalına gider (tam ekran gelen arama ekranı, bkz. Faz 15 madde 1).
      android: { priority: 'high', notification: kind === 'call' ? { channelId: 'calls' } : undefined },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { badge, sound: 'default', 'content-available': 1 } } },
    });
    // Geçersiz jetonları temizle
    const dead = res.responses
      .map((r, i) => (!r.success && r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i] : null))
      .filter((t): t is string => t !== null);
    if (dead.length) await prisma.device.deleteMany({ where: { token: { in: dead } } });
  } catch (e) {
    console.error('[push] failed', e);
  }
}
