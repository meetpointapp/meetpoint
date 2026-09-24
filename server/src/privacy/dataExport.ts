import crypto from 'node:crypto';
import yazl from 'yazl';
import { config, retention } from '../config';
import { HttpError, prisma } from '../db';
import { photoKey } from '../images';
import { sendMail } from '../mailer';
import { maskAccount } from '../iban';
import { decryptField } from '../fieldCrypto';
import { privateStore, publicStore } from '../storage';

// "Verilerimi indir" (KVKK md. 11): kullanıcı ister, zamanlayıcı ZIP hazırlar, e-postayla tek kullanımlık
// bağlantı gider (7 gün geçerli, ayda bir talep). Dosya indirilince silinir.
// İçerik: hesap, profil, fotoğraflar, rızalar, beğeniler, eşleşmeler, kendi gönderdiği mesajlar, cüzdan,
// satın almalar, para çekme (hesap numarası maskeli), aramalar, hediyeler, engeller, şikayetleri, oturumlar.
// Başkalarına ait veri (karşı tarafın mesajları, onu şikayet edenler) eklenmez.

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const DAY = 86_400_000;

export async function requestExport(userId: string) {
  const last = await prisma.dataExport.findFirst({
    where: { userId, status: { not: 'FAILED' } },
    orderBy: { createdAt: 'desc' },
  });
  if (last) {
    const nextAt = new Date(last.createdAt.getTime() + retention.exportCooldownDays * DAY);
    if (nextAt > new Date()) throw new HttpError(429, 'export_cooldown', { nextAt });
  }
  return prisma.dataExport.create({ data: { userId } });
}

export async function latestExport(userId: string) {
  const x = await prisma.dataExport.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  if (!x) return null;
  const nextAt = new Date(x.createdAt.getTime() + retention.exportCooldownDays * DAY);
  return { status: x.status, createdAt: x.createdAt, expiresAt: x.expiresAt, nextAt: x.status === 'FAILED' ? null : nextAt };
}

async function collect(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profile: true,
      photos: { orderBy: { position: 'asc' } },
      consents: { orderBy: { createdAt: 'asc' } },
      swipesGiven: { select: { toId: true, direction: true, createdAt: true } },
      purchases: true,
      payouts: true,
      sessions: { select: { deviceName: true, platform: true, createdAt: true, lastUsedAt: true, revokedAt: true } },
      verifications: { select: { pose: true, status: true, createdAt: true, reviewedAt: true, selfiePath: true } },
      dsrRequests: true,
    },
  });
  const [wallet, conversations, messages, calls, gifts, blocks, reports, devices] = await Promise.all([
    prisma.walletEntry.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.conversation.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    prisma.message.findMany({ where: { senderId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.call.findMany({ where: { OR: [{ callerId: userId }, { calleeId: userId }] }, orderBy: { createdAt: 'asc' } }),
    prisma.callGift.findMany({ where: { OR: [{ fromId: userId }, { toId: userId }] } }),
    prisma.block.findMany({ where: { fromId: userId } }),
    prisma.report.findMany({ where: { fromId: userId }, select: { toId: true, reason: true, details: true, status: true, createdAt: true } }),
    prisma.device.findMany({ where: { userId }, select: { platform: true, updatedAt: true } }),
  ]);

  const data = {
    generatedAt: new Date(),
    account: {
      id: u.id,
      email: u.email,
      locale: u.locale,
      createdAt: u.createdAt,
      emailVerifiedAt: u.emailVerifiedAt,
      lastActiveAt: u.lastActiveAt,
      termsVersion: u.termsVersion,
      privacyVersion: u.privacyVersion,
      verificationStatus: u.verificationStatus,
      verifiedAt: u.verifiedAt,
      bannedAt: u.bannedAt,
      banReason: u.banReason,
    },
    profile: u.profile && {
      ...u.profile,
      id: undefined,
      userId: undefined,
    },
    photos: u.photos.map((p, i) => ({ file: `photos/${i + 1}.webp`, position: p.position, createdAt: p.createdAt })),
    consents: u.consents.map(({ kind, version, granted, source, createdAt }) => ({ kind, version, granted, source, createdAt })),
    likesAndPasses: u.swipesGiven,
    conversations: conversations.map((c) => ({
      id: c.id,
      withUserId: c.userAId === userId ? c.userBId : c.userAId,
      origin: c.origin,
      createdAt: c.createdAt,
    })),
    messagesSent: messages.map((m) => ({
      conversationId: m.conversationId,
      kind: m.kind,
      body: m.kind === 'photo' ? '(tek seferlik fotoğraf)' : m.body,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })),
    wallet: wallet.map(({ amount, type, note, createdAt }) => ({ amount, type, note, createdAt })),
    purchases: u.purchases.map(({ store, productId, coins, bonusCoins, priceUsd, currency, status, createdAt }) => ({
      store,
      productId,
      coins,
      bonusCoins,
      priceUsd,
      currency,
      status,
      createdAt,
    })),
    payouts: u.payouts.map((p) => ({
      coins: p.coins,
      usd: p.usd,
      method: p.method,
      account: p.accountHint || maskAccount(p.method, decryptField(p.accountValue)),
      status: p.status,
      reference: p.reference,
      createdAt: p.createdAt,
      processedAt: p.processedAt,
    })),
    calls: calls.map((c) => ({
      direction: c.callerId === userId ? 'outgoing' : 'incoming',
      withUserId: c.callerId === userId ? c.calleeId : c.callerId,
      kind: c.kind,
      status: c.status,
      billedMinutes: c.billedMinutes,
      createdAt: c.createdAt,
      endedAt: c.endedAt,
    })),
    gifts: gifts.map((g) => ({ direction: g.fromId === userId ? 'sent' : 'received', giftId: g.giftId, coins: g.coins, createdAt: g.createdAt })),
    blocked: blocks.map((b) => ({ userId: b.toId, createdAt: b.createdAt })),
    reportsMade: reports,
    verification: u.verifications.map(({ pose, status, createdAt, reviewedAt }) => ({ pose, status, createdAt, reviewedAt })),
    sessions: u.sessions,
    pushDevices: devices,
    kvkkRequests: u.dsrRequests.map(({ kind, message, status, answer, createdAt, answeredAt }) => ({ kind, message, status, answer, createdAt, answeredAt })),
  };
  return { user: u, data };
}

const README: Record<string, string> = {
  tr: 'MeetPoint kişisel veri kopyan\n\nveriler.json: hesabın, profilin, rızaların, beğenilerin, eşleşmelerin, gönderdiğin mesajlar, cüzdan hareketlerin, satın almaların, para çekme taleplerin, aramaların ve oturumların.\nphotos/: profil fotoğrafların.\nselfie/: mavi tik için gönderdiğin selfie\'ler (saklanıyorsa).\n\nKarşı tarafın mesajları ve seni şikayet eden kişiler başkalarının verisi olduğu için eklenmez.\nSorun ya da talebin için uygulamada Profil > Gizlilik ve verilerim > KVKK başvurusu.',
  en: 'Your MeetPoint personal data copy\n\ndata.json: your account, profile, consents, likes, matches, messages you sent, wallet history, purchases, payout requests, calls and sessions.\nphotos/: your profile photos.\nselfie/: selfies you sent for verification (if still stored).\n\nThe other person\'s messages and the people who reported you are other people\'s data and are not included.\nFor questions: Profile > Privacy & my data > Data request in the app.',
};

export async function buildExportZip(userId: string): Promise<Buffer> {
  const { user, data } = await collect(userId);
  const zip = new yazl.ZipFile();
  const tr = user.locale === 'tr';
  zip.addBuffer(Buffer.from(README[tr ? 'tr' : 'en'], 'utf8'), tr ? 'BENİOKU.txt' : 'README.txt');
  zip.addBuffer(Buffer.from(JSON.stringify(data, null, 2), 'utf8'), tr ? 'veriler.json' : 'data.json');
  for (const [i, p] of user.photos.entries()) {
    const file = await publicStore.read(photoKey(p.path, 'lg'));
    if (file) zip.addBuffer(file, `photos/${i + 1}.webp`);
  }
  for (const [i, v] of user.verifications.entries()) {
    const file = v.selfiePath ? await privateStore.read(v.selfiePath) : null;
    if (file) zip.addBuffer(file, `selfie/${i + 1}${v.selfiePath.slice(v.selfiePath.lastIndexOf('.'))}`);
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

// Zamanlayıcı lideri çağırır: bekleyen talepleri hazırlar ve e-postayı gönderir
export async function processPendingExports() {
  const pending = await prisma.dataExport.findMany({ where: { status: 'PENDING' }, include: { user: true }, take: 5 });
  for (const x of pending) {
    // Aynı talebi iki kez işlememek için önce sahiplen
    const claimed = await prisma.dataExport.updateMany({ where: { id: x.id, status: 'PENDING' }, data: { status: 'BUILDING' } });
    if (claimed.count !== 1) continue;
    try {
      const zip = await buildExportZip(x.userId);
      const key = `exports/${x.id}.zip`;
      await privateStore.put(key, zip);
      const token = crypto.randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + retention.exportTtlDays * DAY);
      await prisma.dataExport.update({
        where: { id: x.id },
        data: { status: 'READY', path: key, size: zip.length, tokenHash: sha256(token), readyAt: new Date(), expiresAt },
      });
      const link = `${config.publicUrl}/data-export/${token}`;
      const tr = x.user.locale === 'tr';
      await sendMail(
        x.user.email,
        tr ? 'MeetPoint: verilerin hazır' : 'MeetPoint: your data is ready',
        tr
          ? `Merhaba,\n\nİstediğin kişisel veri kopyası hazır. Aşağıdaki bağlantıdan bir kez indirebilirsin (${retention.exportTtlDays} gün geçerli):\n\n${link}\n\nBu talebi sen yapmadıysan bağlantıyı açma, şifreni değiştir.`
          : `Hi,\n\nThe copy of your personal data is ready. You can download it once from the link below (valid for ${retention.exportTtlDays} days):\n\n${link}\n\nIf you didn't request this, don't open the link and change your password.`,
      );
    } catch (e) {
      console.error('[veri indirme] hazırlanamadı', e);
      await prisma.dataExport.update({ where: { id: x.id }, data: { status: 'FAILED', error: String(e).slice(0, 500) } });
    }
  }
}

// E-postadaki bağlantı: tek kullanımlık. Önce "indirildi" işaretlenir (iki kez indirilemez), sonra dosya silinir.
export async function takeExport(token: string) {
  const x = await prisma.dataExport.findFirst({ where: { tokenHash: sha256(token) } });
  if (!x || x.status !== 'READY' || !x.expiresAt || x.expiresAt < new Date()) throw new HttpError(404, 'export_unavailable');
  const claimed = await prisma.dataExport.updateMany({ where: { id: x.id, status: 'READY' }, data: { status: 'DOWNLOADED', downloadedAt: new Date() } });
  if (claimed.count !== 1) throw new HttpError(404, 'export_unavailable');
  const file = await privateStore.read(x.path);
  await privateStore.remove(x.path);
  if (!file) throw new HttpError(404, 'export_unavailable');
  return { file, name: `meetpoint-${x.createdAt.toISOString().slice(0, 10)}.zip` };
}
