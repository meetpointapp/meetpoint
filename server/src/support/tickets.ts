import type { SupportMessage, SupportTicket } from '@prisma/client';
import { consumer } from '../config';
import { HttpError, prisma } from '../db';
import { sanitizePrivatePhoto } from '../images';
import { sendMail } from '../mailer';
import { notify } from '../notify';
import { privateStore, randomKey } from '../storage';

// Destek talepleri (Faz 14). Kullanıcı uygulamadan kategori, açıklama, isteğe bağlı ekran görüntüsü ve
// ilgili işlemle (satın alma, para çekme, arama, cüzdan hareketi) talep açar; ekip panelden yanıtlar,
// yanıt uygulamada görünür ve bildirim + e-postayla haber verilir.
//
// Durum: OPEN (sıra bizde) → ANSWERED (sıra kullanıcıda) → kullanıcı yazarsa tekrar OPEN; CLOSED son.
// dueAt: sıradaki yanıtın hedef zamanı (ilk yanıt ve kullanıcının her yeni mesajı için 48 saat).

export const SUPPORT_CATEGORIES = ['coins', 'calls', 'cashout', 'safety', 'account', 'bug', 'suggestion', 'other'] as const;
export const RELATED_TYPES = ['purchase', 'payout', 'call', 'wallet'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type RelatedType = (typeof RELATED_TYPES)[number];

const HOUR = 3_600_000;
const nextDue = () => new Date(Date.now() + consumer.supportFirstResponseHours * HOUR);

// İlgili işlem gerçekten bu kullanıcıya mı ait? (başkasının kaydını talebe iliştirip panelde görmek olmasın)
async function assertRelatedOwned(userId: string, type: RelatedType, id: string) {
  const owned =
    type === 'purchase'
      ? await prisma.purchase.count({ where: { id, userId } })
      : type === 'payout'
        ? await prisma.payout.count({ where: { id, userId } })
        : type === 'call'
          ? await prisma.call.count({ where: { id, OR: [{ callerId: userId }, { calleeId: userId }] } })
          : await prisma.walletEntry.count({ where: { id, userId } });
  if (!owned) throw new HttpError(400, 'invalid_related');
}

async function storeAttachment(file?: Buffer) {
  if (!file) return '';
  // Ekran görüntüsü yeniden kodlanır: konum/EXIF silinir, içerik gerçekten görüntü mü denetlenir
  const key = randomKey('support', 'webp');
  await privateStore.put(key, await sanitizePrivatePhoto(file));
  return key;
}

export async function createTicket(
  userId: string,
  input: {
    category: SupportCategory;
    subject: string;
    body: string;
    relatedType?: RelatedType;
    relatedId?: string;
    platform?: string;
    appVersion?: string;
  },
  file?: Buffer,
) {
  const open = await prisma.supportTicket.count({ where: { userId, status: { not: 'CLOSED' } } });
  if (open >= consumer.supportMaxOpenTickets) throw new HttpError(429, 'support_limit', { max: consumer.supportMaxOpenTickets });
  if (input.relatedType && input.relatedId) await assertRelatedOwned(userId, input.relatedType, input.relatedId);
  const attachment = await storeAttachment(file);
  return prisma.supportTicket.create({
    data: {
      userId,
      category: input.category,
      subject: input.subject,
      relatedType: input.relatedType && input.relatedId ? input.relatedType : '',
      relatedId: input.relatedType && input.relatedId ? input.relatedId : '',
      platform: input.platform ?? '',
      appVersion: input.appVersion ?? '',
      dueAt: nextDue(),
      messages: { create: { body: input.body, attachment } },
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
}

async function ownTicket(userId: string, id: string) {
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t || t.userId !== userId) throw new HttpError(404, 'not_found');
  return t;
}

export async function addUserMessage(userId: string, ticketId: string, body: string, file?: Buffer) {
  const t = await ownTicket(userId, ticketId);
  if (t.status === 'CLOSED') throw new HttpError(409, 'ticket_closed');
  const attachment = await storeAttachment(file);
  const now = new Date();
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId, body, attachment } }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      // Sıra bizdeyse hedef değişmez; kullanıcı yanıta cevap verdiyse yeni hedef başlar
      data: { status: 'OPEN', lastMessageAt: now, ...(t.status === 'ANSWERED' && { dueAt: nextDue() }) },
    }),
  ]);
  return getUserTicket(userId, ticketId);
}

export async function closeByUser(userId: string, ticketId: string) {
  await ownTicket(userId, ticketId);
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'CLOSED', closedAt: new Date(), unreadForUser: false } });
}

const messageDto = (m: SupportMessage) => ({
  id: m.id,
  fromStaff: m.fromStaff,
  body: m.body,
  hasAttachment: m.attachment !== '',
  createdAt: m.createdAt,
});

export const ticketSummary = (t: SupportTicket) => ({
  id: t.id,
  category: t.category,
  subject: t.subject,
  status: t.status,
  relatedType: t.relatedType,
  relatedId: t.relatedId,
  unread: t.unreadForUser,
  lastMessageAt: t.lastMessageAt,
  createdAt: t.createdAt,
  closedAt: t.closedAt,
});

export async function listUserTickets(userId: string) {
  const list = await prisma.supportTicket.findMany({ where: { userId }, orderBy: { lastMessageAt: 'desc' }, take: 50 });
  return { tickets: list.map(ticketSummary), unread: list.filter((t) => t.unreadForUser).length };
}

// Kullanıcı talebi açınca yanıt "okundu" sayılır
export async function getUserTicket(userId: string, ticketId: string, markRead = false) {
  const t = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  if (!t || t.userId !== userId) throw new HttpError(404, 'not_found');
  if (markRead && t.unreadForUser) await prisma.supportTicket.update({ where: { id: t.id }, data: { unreadForUser: false } });
  return { ...ticketSummary(t), unread: markRead ? false : t.unreadForUser, messages: t.messages.map(messageDto) };
}

// Ek dosyası: talep sahibi veya yetkili ekip üyesi
export async function readAttachment(messageId: string, userId: string | null) {
  const m = await prisma.supportMessage.findUnique({ where: { id: messageId }, include: { ticket: { select: { userId: true } } } });
  if (!m || !m.attachment || (userId !== null && m.ticket.userId !== userId)) throw new HttpError(404, 'not_found');
  const file = await privateStore.read(m.attachment);
  if (!file) throw new HttpError(404, 'not_found');
  return { file, ticketUserId: m.ticket.userId };
}

// --- Ekip tarafı ---

const MAIL = {
  tr: (subject: string, body: string) => ({
    subject: `MeetPoint Destek: ${subject}`,
    text: `Merhaba,\n\n"${subject}" başlıklı destek talebine yanıt verdik:\n\n${body}\n\nYanıtı ve talep geçmişini uygulamada Profil › Yardım ve destek bölümünde görebilir, oradan cevap yazabilirsin.\n\nMeetPoint Destek`,
  }),
  en: (subject: string, body: string) => ({
    subject: `MeetPoint Support: ${subject}`,
    text: `Hi,\n\nWe replied to your support request "${subject}":\n\n${body}\n\nYou can see the reply and the full history in the app under Profile › Help & support, and answer there.\n\nMeetPoint Support`,
  }),
};

export async function staffReply(staffId: string, ticketId: string, body: string, close: boolean) {
  const t = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { user: { select: { email: true, locale: true } } } });
  if (!t) throw new HttpError(404, 'not_found');
  if (t.status === 'CLOSED') throw new HttpError(409, 'ticket_closed');
  const now = new Date();
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId, body, fromStaff: true, staffId } }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: close ? 'CLOSED' : 'ANSWERED',
        closedAt: close ? now : null,
        firstResponseAt: t.firstResponseAt ?? now,
        lastMessageAt: now,
        unreadForUser: true,
      },
    }),
  ]);
  // Bildirim (tercihten bağımsız: hesapla ilgili) + e-posta
  void notify(t.userId, 'support', t.userId, t.subject, { ticketId });
  const mail = (t.user.locale === 'tr' ? MAIL.tr : MAIL.en)(t.subject, body);
  await sendMail(t.user.email, mail.subject, mail.text).catch((e) => console.error('support mail', e));
}

export async function staffClose(ticketId: string) {
  const t = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!t) throw new HttpError(404, 'not_found');
  if (t.status === 'CLOSED') return;
  await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'CLOSED', closedAt: new Date() } });
}

// Performans: son 30 günde açılan taleplerin ilk yanıt süreleri ve hedefe uyum
export async function supportMetrics() {
  const since = new Date(Date.now() - 30 * 24 * HOUR);
  const [open, overdue, recent] = await Promise.all([
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN', dueAt: { lt: new Date() } } }),
    prisma.supportTicket.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, firstResponseAt: true } }),
  ]);
  const answered = recent.filter((t) => t.firstResponseAt);
  const hours = answered.map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / HOUR);
  const within = hours.filter((h) => h <= consumer.supportFirstResponseHours).length;
  return {
    open,
    overdue,
    last30Days: recent.length,
    avgFirstResponseHours: hours.length ? +(hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1) : null,
    withinTargetPct: answered.length ? Math.round((within / answered.length) * 100) : null,
    targetHours: consumer.supportFirstResponseHours,
  };
}

// Hesap kalıcı silinirken ve saklama süresi dolunca: eklerin dosyaları
export async function removeTicketFiles(where: { userId?: string; id?: { in: string[] } }) {
  const msgs = await prisma.supportMessage.findMany({ where: { ticket: where, attachment: { not: '' } }, select: { attachment: true } });
  for (const m of msgs) await privateStore.remove(m.attachment).catch(() => {});
}
