import crypto from 'node:crypto';
import sharp from 'sharp';
import { prisma } from '../db';

// Otomatik güvenlik sinyalleri. Kural tabanlı: bir yapay zekâ sağlayıcısı sonradan `imageModerator`
// yerine takılabilir. Sinyaller mesajı/fotoğrafı engellemez; uyarı gösterir ve moderasyon kuyruğuna düşer.

// ---------- Sohbette iletişim bilgisi (dolandırıcılık ve platform dışına çekme belirtisi)
export type ContactKind = 'phone' | 'iban' | 'email' | 'social' | 'link';

const SOCIAL = /\b(insta(gram)?|ig|snap(chat)?|telegram|tg|whats?app|wp|wa\.me|tiktok|onlyfans|facebook|fb|twitter|x\.com)\b/i;

export function contactInfo(text: string): ContactKind[] {
  const found = new Set<ContactKind>();
  // Rakamlar arasındaki boşluk, nokta, tire, parantez atılır: "0 532-123 45 67" gibi yazımlar da yakalanır
  const digits = text.replace(/(?<=\d)[\s.\-()/]+(?=\d)/g, '');
  if (/(?:\+?90|0)?5\d{9}\b/.test(digits) || /\+\d{10,14}\b/.test(digits) || /\b\d{10,13}\b/.test(digits)) found.add('phone');
  // IBAN: TR + 24 rakam, dörtlü gruplar arasında boşluk olabilir ("TR33 0006 1005 ...")
  if (/\bTR\s?\d{2}(?:\s?\d){22}\b/i.test(text)) found.add('iban');
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) found.add('email');
  if (SOCIAL.test(text) || /(^|\s)@[a-z0-9._]{3,30}\b/i.test(text)) found.add('social');
  if (/\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|me|io|link|ly)\b/i.test(text)) found.add('link');
  return [...found];
}

const DAY = 86_400_000;
export const CONTACT_REPEAT = 3; // 24 saatte bu kadar iletişim bilgisi içeren mesaj → kuyruk
export const SPAM_CONVERSATIONS = 5; // aynı mesaj 10 dakikada bu kadar farklı sohbete → kuyruk

const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
const bodyHash = (t: string) => crypto.createHash('sha1').update(normalize(t)).digest('hex');

// Mesaj gönderildikten sonra: tekrar eden iletişim bilgisi paylaşımı ve toplu mesaj
export async function afterMessage(userId: string, messageId: string, body: string, flagged: boolean) {
  if (flagged) {
    const count = await prisma.message.count({ where: { senderId: userId, flag: 'contact', createdAt: { gt: new Date(Date.now() - DAY) } } });
    if (count >= CONTACT_REPEAT) await flagOnce(userId, 'contact_repeat', DAY, { refId: messageId, priority: 2, details: { count } });
  }
  if (normalize(body).length >= 8) {
    const since = new Date(Date.now() - 10 * 60_000);
    const recent = await prisma.message.findMany({
      where: { senderId: userId, kind: 'text', createdAt: { gt: since } },
      select: { body: true, conversationId: true },
      take: 200,
    });
    const h = bodyHash(body);
    const convs = new Set(recent.filter((m) => bodyHash(m.body) === h).map((m) => m.conversationId));
    if (convs.size >= SPAM_CONVERSATIONS) await flagOnce(userId, 'spam', 3_600_000, { refId: messageId, priority: 2, details: { conversations: convs.size } });
  }
}

// Aynı türde açık/yeni bir işaret yoksa oluştur (kuyruk aynı olay için dolmasın)
async function flagOnce(userId: string, kind: string, windowMs: number, data: { refId?: string; priority: number; details: Record<string, number | string> }) {
  const exists = await prisma.moderationFlag.findFirst({ where: { userId, kind, createdAt: { gt: new Date(Date.now() - windowMs) } } });
  if (!exists) await prisma.moderationFlag.create({ data: { userId, kind, refId: data.refId ?? '', priority: data.priority, details: data.details } });
}

// ---------- Profil fotoğrafı
export interface ImageModerator {
  check(image: Buffer): Promise<{ suspicious: boolean; reasons: string[]; score: number }>;
}

// Ten rengi piksel oranı (YCbCr aralığı): çıplaklık için kaba bir sinyal. Yüz yakın çekimleri de yüksek
// çıkabildiği için eşik yüksek tutulur; kesin karar her zaman moderatörde.
export async function skinRatio(image: Buffer) {
  const { data } = await sharp(image).resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let skin = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (y > 60 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) skin++;
  }
  return skin / (data.length / 3);
}

export const SKIN_THRESHOLD = Number(process.env.PHOTO_SKIN_THRESHOLD ?? 0.6);

export const rulesModerator: ImageModerator = {
  async check(image) {
    const ratio = await skinRatio(image);
    return { suspicious: ratio >= SKIN_THRESHOLD, reasons: ratio >= SKIN_THRESHOLD ? ['skin_ratio'] : [], score: +ratio.toFixed(3) };
  },
};

export let imageModerator: ImageModerator = rulesModerator;
export const setImageModerator = (m: ImageModerator) => {
  imageModerator = m;
};

// Yeni profil fotoğrafı: şüpheliyse (görsel sinyali veya çok şikayet almış hesap) gizlenir ve kuyruğa düşer
export async function reviewNewPhoto(userId: string, photoId: string, image: Buffer) {
  const result = await imageModerator.check(image).catch(() => ({ suspicious: false, reasons: [] as string[], score: 0 }));
  const reasons = [...result.reasons];
  const openReports = await prisma.report.count({ where: { toId: userId, status: 'OPEN' } });
  if (openReports >= 2) reasons.push('reported_user');
  if (!reasons.length) return false;
  await prisma.photo.update({ where: { id: photoId }, data: { hiddenAt: new Date() } });
  await prisma.moderationFlag.create({
    data: {
      userId,
      kind: 'photo_suspicious',
      refId: photoId,
      priority: reasons.includes('skin_ratio') ? 1 : 3,
      details: { reasons: reasons.join(','), score: result.score, openReports },
    },
  });
  return true;
}
