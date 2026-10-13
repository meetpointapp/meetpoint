import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { uid } from '../auth';
import { HttpError, isBlockedEitherWay, orderedPair, prisma } from '../db';
import { reportLimiter, socialWriteLimiter } from '../limits';
import { contactInfo } from '../moderation/detect';
import { fileReport, REPORT_REASONS } from '../moderation/reports';
import { requireNotRestricted } from '../moderation/sanctions';
import { notify } from '../notify';
import { emitToUser } from '../realtime';
import { INVITES_PER_DAY, pickPrompt, promptById, promptText, ROUNDS, STALE_DAYS, type PromptKind } from '../truthDare';
import { dayAgo, snippet } from '../social';
import { publicProfile } from './profile';

// Faz 23: Doğruluk mu Cesaret mi. Keşfet kartından başlatılır (eşleşme gerekmez); iki taraf aynı turda
// doğruluk ya da cesaret seçer, sunucu rastgele soru verir, ikisi de cevaplayınca cevaplar açılır.
export const truthDareRouter = Router();

const ANSWER_MAX = 300;
const pid = (req: import('express').Request) => String(req.params.id);
const userInclude = { include: { profile: true, photos: { orderBy: { position: 'asc' as const } } } };

type GameRow = Prisma.TruthDareGameGetPayload<{ include: { rounds: true; userA: typeof userInclude; userB: typeof userInclude } }>;
const gameInclude = { rounds: { orderBy: { index: 'asc' as const } }, userA: userInclude, userB: userInclude };

type Side = 'a' | 'b';
const sideOf = (g: { userAId: string }, me: string): Side => (g.userAId === me ? 'a' : 'b');

function sideFields(r: GameRow['rounds'][number], side: Side) {
  return side === 'a'
    ? { choice: r.aChoice, prompt: r.aPrompt, answer: r.aAnswer, answeredAt: r.aAnsweredAt }
    : { choice: r.bChoice, prompt: r.bPrompt, answer: r.bAnswer, answeredAt: r.bAnsweredAt };
}

const promptDto = (id: string, locale: string) => {
  const p = promptById.get(id);
  return p ? { id: p.id, kind: p.kind, tone: p.tone, text: promptText(id, locale) } : null;
};

// Oyunu izleyicinin gözünden anlat: diğer tarafın cevabı/sorusu turun açılmasına kadar gizli
function gameDto(g: GameRow, me: string, locale: string) {
  const side = sideOf(g, me);
  const other = side === 'a' ? g.userB : g.userA;
  const mine = (r: GameRow['rounds'][number]) => sideFields(r, side);
  const theirs = (r: GameRow['rounds'][number]) => sideFields(r, side === 'a' ? 'b' : 'a');
  const revealed = (r: GameRow['rounds'][number]) => !!r.aAnsweredAt && !!r.bAnsweredAt;

  const rounds = g.rounds.map((r) => {
    const m = mine(r);
    const t = theirs(r);
    const open = revealed(r);
    return {
      index: r.index,
      revealed: open,
      mine: { choice: m.choice, prompt: m.prompt ? promptDto(m.prompt, locale) : null, answer: m.answer, answered: !!m.answeredAt },
      theirs: open
        ? { choice: t.choice, prompt: promptDto(t.prompt, locale), answer: t.answer, answered: true }
        : { choice: t.choice ? 'hidden' : '', prompt: null, answer: '', answered: !!t.answeredAt },
    };
  });
  const current = g.status === 'ACTIVE' ? rounds.find((r) => r.index === g.round) ?? null : null;
  const myTurn = g.status === 'ACTIVE' && !(current?.mine.answered ?? false);
  return {
    id: g.id,
    // Not: test yardımcısı HTTP kodunu `status` alanına yazdığı için oyun durumu `state` adıyla döner
    state: g.status,
    round: g.round,
    totalRounds: g.totalRounds,
    initiatedByMe: g.initiatorId === me,
    myTurn,
    other: publicProfile(other),
    // Sıra yeni başlıyorsa (henüz tur satırı yok) istemci seçim ekranını gösterir
    current: current ?? { index: g.round, revealed: false, mine: { choice: '', prompt: null, answer: '', answered: false }, theirs: { choice: '', prompt: null, answer: '', answered: false } },
    history: rounds.filter((r) => r.revealed),
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

async function loadGame(id: string, me: string) {
  const g = await prisma.truthDareGame.findUnique({ where: { id }, include: gameInclude });
  if (!g || (g.userAId !== me && g.userBId !== me)) throw new HttpError(404, 'not_found');
  return g;
}

const localeOf = async (userId: string) => (await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } }))?.locale ?? 'tr';

async function respond(res: import('express').Response, id: string, me: string, status = 200) {
  const g = await loadGame(id, me);
  res.status(status).json(gameDto(g, me, await localeOf(me)));
}

// Sessiz bırakılmış (7 gün hareketsiz) açık oyunlar kapanır
async function expireStale(userAId: string, userBId: string) {
  await prisma.truthDareGame.updateMany({
    where: { userAId, userBId, status: 'ACTIVE', updatedAt: { lt: new Date(Date.now() - STALE_DAYS * 86_400_000) } },
    data: { status: 'EXPIRED' },
  });
}

// ---------- Liste: açık oyunlar önde, sonra son bitenler
truthDareRouter.get('/games/truth-dare', async (req, res) => {
  const me = uid(req);
  const rows = await prisma.truthDareGame.findMany({
    where: { OR: [{ userAId: me }, { userBId: me }], status: { in: ['ACTIVE', 'FINISHED'] } },
    orderBy: { updatedAt: 'desc' },
    take: 40,
    include: gameInclude,
  });
  const locale = await localeOf(me);
  const fresh = Date.now() - STALE_DAYS * 86_400_000;
  const games = rows
    .filter((g) => g.status !== 'ACTIVE' || g.updatedAt.getTime() > fresh)
    .map((g) => gameDto(g, me, locale))
    .filter((g) => g.other !== null);
  res.json({ games, myTurnCount: games.filter((g) => g.myTurn).length });
});

// ---------- Başlat (ya da var olanı getir)
truthDareRouter.post('/games/truth-dare', requireNotRestricted, socialWriteLimiter, async (req, res) => {
  const { toId } = z.object({ toId: z.string() }).parse(req.body);
  const me = uid(req);
  if (toId === me) throw new HttpError(400, 'invalid_target');
  const target = await prisma.user.findFirst({ where: { id: toId, bannedAt: null, deletionRequestedAt: null, profile: { isNot: null } }, select: { id: true } });
  if (!target || (await isBlockedEitherWay(me, toId))) throw new HttpError(404, 'not_found');

  const [userAId, userBId] = orderedPair(me, toId);
  await expireStale(userAId, userBId);
  const existing = await prisma.truthDareGame.findFirst({ where: { userAId, userBId, status: 'ACTIVE' } });
  if (existing) return respond(res, existing.id, me);

  const invites = await prisma.truthDareGame.count({ where: { initiatorId: me, createdAt: { gt: dayAgo() } } });
  if (invites >= INVITES_PER_DAY) throw new HttpError(429, 'game_limit_reached');

  const game = await prisma.truthDareGame.create({ data: { userAId, userBId, initiatorId: me, totalRounds: ROUNDS } });
  void notify(toId, 'game_invite', me, '', { gameId: game.id });
  emitToUser(toId, 'game:update', { kind: 'invite', gameId: game.id, fromId: me });
  return respond(res, game.id, me, 201);
});

truthDareRouter.get('/games/truth-dare/:id', async (req, res) => respond(res, pid(req), uid(req)));

// ---------- Tur: doğruluk mu cesaret mi (soru sunucudan rastgele gelir)
truthDareRouter.post('/games/truth-dare/:id/choose', requireNotRestricted, socialWriteLimiter, async (req, res) => {
  const { choice } = z.object({ choice: z.enum(['truth', 'dare']) }).parse(req.body);
  const me = uid(req);
  const g = await loadGame(pid(req), me);
  if (g.status !== 'ACTIVE') throw new HttpError(409, 'game_not_active');
  const side = sideOf(g, me);
  const key = side === 'a' ? 'a' : 'b';

  await prisma.$transaction(async (tx) => {
    const round = await tx.truthDareRound.upsert({
      where: { gameId_index: { gameId: g.id, index: g.round } },
      create: { gameId: g.id, index: g.round },
      update: {},
    });
    if ((key === 'a' ? round.aChoice : round.bChoice) !== '') throw new HttpError(409, 'already_chosen');
    // Oyunda daha önce hiç verilmemiş bir soru
    const all = await tx.truthDareRound.findMany({ where: { gameId: g.id } });
    const used = new Set(all.flatMap((r) => [r.aPrompt, r.bPrompt]).filter(Boolean));
    const prompt = pickPrompt(choice as PromptKind, used);
    await tx.truthDareRound.update({
      where: { id: round.id },
      data: key === 'a' ? { aChoice: choice, aPrompt: prompt.id } : { bChoice: choice, bPrompt: prompt.id },
    });
    await tx.truthDareGame.update({ where: { id: g.id }, data: { updatedAt: new Date() } });
  });
  await respond(res, g.id, me);
});

// ---------- Cevap: ikisi de cevaplayınca tur açılır ve sonraki tura geçilir (10. turdan sonra oyun biter)
truthDareRouter.post('/games/truth-dare/:id/answer', requireNotRestricted, socialWriteLimiter, async (req, res) => {
  const { answer } = z.object({ answer: z.string().trim().min(1).max(ANSWER_MAX) }).parse(req.body);
  if (contactInfo(answer).length) throw new HttpError(400, 'contact_info_not_allowed');
  const me = uid(req);
  const g = await loadGame(pid(req), me);
  if (g.status !== 'ACTIVE') throw new HttpError(409, 'game_not_active');
  const side = sideOf(g, me);
  const otherId = side === 'a' ? g.userBId : g.userAId;

  const result = await prisma.$transaction(async (tx) => {
    const round = await tx.truthDareRound.findUnique({ where: { gameId_index: { gameId: g.id, index: g.round } } });
    const mine = round ? sideFields(round as GameRow['rounds'][number], side) : null;
    if (!round || !mine || !mine.choice || !mine.prompt) throw new HttpError(409, 'choose_first');
    if (mine.answeredAt) throw new HttpError(409, 'already_answered');
    const now = new Date();
    const updated = await tx.truthDareRound.update({
      where: { id: round.id },
      data: side === 'a' ? { aAnswer: answer, aAnsweredAt: now } : { bAnswer: answer, bAnsweredAt: now },
    });
    const both = !!updated.aAnsweredAt && !!updated.bAnsweredAt;
    let finished = false;
    if (both) {
      finished = g.round >= g.totalRounds;
      await tx.truthDareGame.update({
        where: { id: g.id },
        data: finished ? { status: 'FINISHED', finishedAt: now } : { round: g.round + 1 },
      });
    } else {
      await tx.truthDareGame.update({ where: { id: g.id }, data: { updatedAt: now } });
    }
    return { both, finished };
  });

  // Bildirim: ikisi de cevapladıysa cevaplar açıldı, değilse karşı tarafın sırası
  void notify(otherId, result.both ? 'game_reveal' : 'game_turn', me, snippet(answer, 60), { gameId: g.id });
  emitToUser(otherId, 'game:update', { kind: result.both ? 'reveal' : 'turn', gameId: g.id, fromId: me });
  await respond(res, g.id, me);
});

// ---------- Reddet / oyundan çık
truthDareRouter.post('/games/truth-dare/:id/end', async (req, res) => {
  const me = uid(req);
  const g = await loadGame(pid(req), me);
  if (g.status !== 'ACTIVE') return respond(res, g.id, me);
  // Davet edilen taraf hiç oynamadıysa "reddedildi", aksi hâlde "bitirildi"
  const invitee = g.initiatorId === me ? null : me;
  const played = g.rounds.some((r) => (invitee && sideOf(g, me) === 'a' ? r.aChoice : r.bChoice) !== '');
  await prisma.truthDareGame.update({ where: { id: g.id }, data: { status: invitee && !played ? 'DECLINED' : 'ENDED', finishedAt: new Date() } });
  const otherId = g.userAId === me ? g.userBId : g.userAId;
  emitToUser(otherId, 'game:update', { kind: 'ended', gameId: g.id, fromId: me });
  await respond(res, g.id, me);
});

// ---------- Şikayet: karşı tarafın açılmış cevapları kopyalanır
truthDareRouter.post('/games/truth-dare/:id/report', reportLimiter, async (req, res) => {
  const data = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().max(1000).default('') }).parse(req.body);
  const me = uid(req);
  const g = await loadGame(pid(req), me);
  const side = sideOf(g, me);
  const otherId = side === 'a' ? g.userBId : g.userAId;
  const otherSide: Side = side === 'a' ? 'b' : 'a';
  const text = g.rounds
    .map((r) => sideFields(r, otherSide))
    .filter((f) => f.answer)
    .map((f) => f.answer)
    .join(' | ');
  await fileReport({ fromId: me, toId: otherId, ...data, subjectType: 'user', subjectText: `[Doğruluk mu Cesaret mi] ${text}` });
  res.status(201).json({ ok: true });
});
