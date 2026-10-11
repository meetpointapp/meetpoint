import { Router } from 'express';
import multer from 'multer';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { uid } from '../auth';
import { INTERESTS } from '../catalog';
import { HttpError, isBlockedEitherWay, prisma } from '../db';
import { photoUrls, removeProfilePhoto, storeProfilePhoto } from '../images';
import { reportLimiter, socialWriteLimiter } from '../limits';
import { contactInfo, imageModerator } from '../moderation/detect';
import { fileReport, REPORT_REASONS } from '../moderation/reports';
import { requireNotRestricted } from '../moderation/sanctions';
import { notify } from '../notify';
import { emitToUser } from '../realtime';
import { blockedIdsOf, cursorOf, dayAgo, parseCursor, requireVerified, snippet, social, socialStats, visibleAuthor } from '../social';
import { publicProfile } from './profile';

// Faz 22: sosyal akış — yazı tabanlı gönderiler, yorumlar, takip, 24 saatlik hikayeler.
// Yazma (gönderi/yorum/hikaye) mavi tikli hesaplara açık; okuma, beğeni ve takip herkese açık.
export const socialRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

const authorInclude = { include: { profile: true, photos: { orderBy: { position: 'asc' as const } } } };
type AuthorRow = Prisma.UserGetPayload<typeof authorInclude>;

const authorDto = (u: AuthorRow) => publicProfile(u);

const pid = (req: import('express').Request) => String(req.params.id);

// ---------------------------------------------------------------- DTO'lar
type PostRow = Prisma.PostGetPayload<{ include: { author: typeof authorInclude } }>;

function postDto(p: PostRow, me: string, liked: Set<string>, following: Set<string>) {
  const author = authorDto(p.author);
  if (!author) return null;
  return {
    id: p.id,
    body: p.body,
    interest: p.interest,
    createdAt: p.createdAt,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    likedByMe: liked.has(p.id),
    mine: p.authorId === me,
    author,
    following: following.has(p.authorId),
  };
}

async function hydratePosts(rows: PostRow[], me: string) {
  if (rows.length === 0) return [];
  const [likes, follows] = await Promise.all([
    prisma.postLike.findMany({ where: { userId: me, postId: { in: rows.map((r) => r.id) } }, select: { postId: true } }),
    prisma.follow.findMany({ where: { followerId: me, followingId: { in: [...new Set(rows.map((r) => r.authorId))] } }, select: { followingId: true } }),
  ]);
  const liked = new Set(likes.map((l) => l.postId));
  const following = new Set(follows.map((f) => f.followingId));
  return rows.map((r) => postDto(r, me, liked, following)).filter((p): p is NonNullable<typeof p> => p !== null);
}

// ---------------------------------------------------------------- Akış
const TABS = ['all', 'following', 'interests', 'matches'] as const;

socialRouter.get('/feed', async (req, res) => {
  const q = z
    .object({
      tab: z.enum(TABS).default('all'),
      before: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(social.feedPage),
    })
    .parse(req.query);
  const me = uid(req);
  const blocked = await blockedIdsOf(me);
  const and: Prisma.PostWhereInput[] = [{ hiddenAt: null }, { author: visibleAuthor }];
  if (blocked.length) and.push({ authorId: { notIn: blocked } });

  if (q.tab === 'following') {
    const f = await prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } });
    and.push({ authorId: { in: [me, ...f.map((x) => x.followingId)] } });
  } else if (q.tab === 'interests') {
    const mine = ((await prisma.profile.findUnique({ where: { userId: me }, select: { interests: true } }))?.interests as string[] | undefined) ?? [];
    // Etiketi benim ilgi alanlarımdan biri olan gönderiler + ilgi alanı benimle kesişen yazarların gönderileri
    and.push({
      OR: mine.length
        ? [{ interest: { in: mine } }, ...mine.map((id) => ({ author: { profile: { is: { interests: { array_contains: [id] } } } } }))]
        : [{ id: '__none__' }],
    });
  } else if (q.tab === 'matches') {
    const convs = await prisma.conversation.findMany({ where: { OR: [{ userAId: me }, { userBId: me }] }, select: { userAId: true, userBId: true } });
    const partners = convs.map((c) => (c.userAId === me ? c.userBId : c.userAId));
    and.push({ authorId: { in: partners.length ? partners : ['__none__'] } });
  }
  const cursor = parseCursor(q.before);
  if (cursor) and.push({ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] });

  const rows = await prisma.post.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    include: { author: authorInclude },
  });
  const page = rows.slice(0, q.limit);
  res.json({ posts: await hydratePosts(page, me), next: rows.length > q.limit ? cursorOf(page[page.length - 1]) : null });
});

// Bir kullanıcının gönderileri (profildeki "Gönderiler")
socialRouter.get('/users/:id/posts', async (req, res) => {
  const q = z.object({ before: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).default(social.feedPage) }).parse(req.query);
  const me = uid(req);
  const target = pid(req);
  if (target !== me && (await isBlockedEitherWay(me, target))) throw new HttpError(404, 'not_found');
  const and: Prisma.PostWhereInput[] = [{ authorId: target }, { hiddenAt: null }, { author: visibleAuthor }];
  const cursor = parseCursor(q.before);
  if (cursor) and.push({ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] });
  const rows = await prisma.post.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    include: { author: authorInclude },
  });
  const page = rows.slice(0, q.limit);
  res.json({ posts: await hydratePosts(page, me), next: rows.length > q.limit ? cursorOf(page[page.length - 1]) : null });
});

// ---------------------------------------------------------------- Gönderi
async function loadVisiblePost(id: string, me: string) {
  const post = await prisma.post.findFirst({ where: { id, hiddenAt: null, author: visibleAuthor }, include: { author: authorInclude } });
  if (!post) throw new HttpError(404, 'not_found');
  if (post.authorId !== me && (await isBlockedEitherWay(me, post.authorId))) throw new HttpError(404, 'not_found');
  return post;
}

// Gönderi/yorum metni: iletişim bilgisi (telefon, IBAN, e-posta, sosyal hesap, bağlantı) herkese açık alanda yasak
function assertPublicText(text: string) {
  if (contactInfo(text).length) throw new HttpError(400, 'contact_info_not_allowed');
}

socialRouter.post('/posts', requireNotRestricted, socialWriteLimiter, async (req, res) => {
  const body = z
    .object({
      body: z.string().trim().min(1).max(social.postMax),
      interest: z.string().max(40).default(''),
    })
    .parse(req.body);
  const me = uid(req);
  await requireVerified(me);
  assertPublicText(body.body);
  const interest = (INTERESTS as readonly string[]).includes(body.interest) ? body.interest : '';

  const since = dayAgo();
  const [count, dup] = await Promise.all([
    prisma.post.count({ where: { authorId: me, createdAt: { gt: since } } }),
    prisma.post.findFirst({ where: { authorId: me, body: body.body, createdAt: { gt: since } }, select: { id: true } }),
  ]);
  if (count >= social.postsPerDay) throw new HttpError(429, 'post_limit_reached');
  if (dup) throw new HttpError(409, 'duplicate_post');

  const post = await prisma.post.create({ data: { authorId: me, body: body.body, interest }, include: { author: authorInclude } });
  const [dto] = await hydratePosts([post], me);
  res.status(201).json(dto);
});

socialRouter.get('/posts/:id', async (req, res) => {
  const me = uid(req);
  const post = await loadVisiblePost(pid(req), me);
  const [dto] = await hydratePosts([post], me);
  if (!dto) throw new HttpError(404, 'not_found');
  res.json(dto);
});

socialRouter.delete('/posts/:id', async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: pid(req), authorId: uid(req) } });
  if (!post) throw new HttpError(404, 'not_found');
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- Beğeni
socialRouter.put('/posts/:id/like', socialWriteLimiter, async (req, res) => {
  const me = uid(req);
  const post = await loadVisiblePost(pid(req), me);
  const created = await prisma.$transaction(async (tx) => {
    const exists = await tx.postLike.findUnique({ where: { postId_userId: { postId: post.id, userId: me } } });
    if (exists) return false;
    await tx.postLike.create({ data: { postId: post.id, userId: me } });
    await tx.post.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } });
    return true;
  });
  if (created && post.authorId !== me) {
    void notify(post.authorId, 'post_like', me, snippet(post.body, 80), { postId: post.id });
    emitToUser(post.authorId, 'social:new', { kind: 'like', postId: post.id });
  }
  const fresh = await prisma.post.findUniqueOrThrow({ where: { id: post.id }, select: { likeCount: true } });
  res.json({ liked: true, likeCount: fresh.likeCount });
});

socialRouter.delete('/posts/:id/like', async (req, res) => {
  const me = uid(req);
  const postId = pid(req);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.postLike.deleteMany({ where: { postId, userId: me } });
    if (count > 0) await tx.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
  });
  const fresh = await prisma.post.findUnique({ where: { id: postId }, select: { likeCount: true } });
  res.json({ liked: false, likeCount: Math.max(0, fresh?.likeCount ?? 0) });
});

// ---------------------------------------------------------------- Yorumlar
type CommentRow = Prisma.PostCommentGetPayload<{ include: { author: typeof authorInclude } }>;

const commentDto = (c: CommentRow, me: string, postAuthorId: string) => {
  const author = authorDto(c.author);
  return author
    ? { id: c.id, body: c.body, createdAt: c.createdAt, author, mine: c.authorId === me, canDelete: c.authorId === me || postAuthorId === me }
    : null;
};

socialRouter.get('/posts/:id/comments', async (req, res) => {
  const q = z.object({ after: z.string().optional(), limit: z.coerce.number().int().min(1).max(60).default(social.commentPage) }).parse(req.query);
  const me = uid(req);
  const post = await loadVisiblePost(pid(req), me);
  const blocked = await blockedIdsOf(me);
  const and: Prisma.PostCommentWhereInput[] = [{ postId: post.id }, { hiddenAt: null }, { author: visibleAuthor }];
  if (blocked.length) and.push({ authorId: { notIn: blocked } });
  const cursor = parseCursor(q.after);
  if (cursor) and.push({ OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] });
  const rows = await prisma.postComment.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: q.limit + 1,
    include: { author: authorInclude },
  });
  const page = rows.slice(0, q.limit);
  res.json({
    comments: page.map((c) => commentDto(c, me, post.authorId)).filter((c): c is NonNullable<typeof c> => c !== null),
    next: rows.length > q.limit ? cursorOf(page[page.length - 1]) : null,
  });
});

socialRouter.post('/posts/:id/comments', requireNotRestricted, socialWriteLimiter, async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(social.commentMax) }).parse(req.body);
  const me = uid(req);
  await requireVerified(me);
  assertPublicText(body);
  const post = await loadVisiblePost(pid(req), me);
  const count = await prisma.postComment.count({ where: { authorId: me, createdAt: { gt: dayAgo() } } });
  if (count >= social.commentsPerDay) throw new HttpError(429, 'comment_limit_reached');

  const comment = await prisma.$transaction(async (tx) => {
    const c = await tx.postComment.create({ data: { postId: post.id, authorId: me, body }, include: { author: authorInclude } });
    await tx.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } });
    return c;
  });
  if (post.authorId !== me) {
    void notify(post.authorId, 'post_comment', me, snippet(body, 80), { postId: post.id });
    emitToUser(post.authorId, 'social:new', { kind: 'comment', postId: post.id });
  }
  res.status(201).json(commentDto(comment, me, post.authorId));
});

socialRouter.delete('/comments/:id', async (req, res) => {
  const me = uid(req);
  const c = await prisma.postComment.findUnique({ where: { id: pid(req) }, include: { post: { select: { authorId: true } } } });
  if (!c || (c.authorId !== me && c.post.authorId !== me)) throw new HttpError(404, 'not_found');
  await prisma.$transaction([
    prisma.postComment.delete({ where: { id: c.id } }),
    prisma.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } }),
  ]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- Takip
async function loadFollowTarget(me: string, target: string) {
  if (target === me) throw new HttpError(400, 'invalid_target');
  const user = await prisma.user.findFirst({ where: { id: target, ...visibleAuthor, profile: { isNot: null } }, select: { id: true } });
  if (!user || (await isBlockedEitherWay(me, target))) throw new HttpError(404, 'not_found');
}

socialRouter.put('/users/:id/follow', requireNotRestricted, socialWriteLimiter, async (req, res) => {
  const me = uid(req);
  const target = pid(req);
  await loadFollowTarget(me, target);
  const exists = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me, followingId: target } } });
  if (!exists) {
    await prisma.follow.create({ data: { followerId: me, followingId: target } });
    void notify(target, 'follow', me, '', { userId: me });
    emitToUser(target, 'social:new', { kind: 'follow', userId: me });
  }
  res.json(await socialStats(target, me));
});

socialRouter.delete('/users/:id/follow', async (req, res) => {
  const me = uid(req);
  await prisma.follow.deleteMany({ where: { followerId: me, followingId: pid(req) } });
  res.json(await socialStats(pid(req), me));
});

async function followList(req: import('express').Request, mode: 'followers' | 'following') {
  const q = z.object({ after: z.string().optional(), limit: z.coerce.number().int().min(1).max(60).default(social.listPage) }).parse(req.query);
  const me = uid(req);
  const target = pid(req);
  if (target !== me && (await isBlockedEitherWay(me, target))) throw new HttpError(404, 'not_found');
  const blocked = await blockedIdsOf(me);
  // Karşı kullanıcı: takipçi listesinde followerId, takip edilenlerde followingId (aynı zamanda sayfalama kimliği)
  const otherKey = mode === 'followers' ? 'followerId' : 'followingId';
  const cursor = parseCursor(q.after);
  const and: Prisma.FollowWhereInput[] = [mode === 'followers' ? { followingId: target } : { followerId: target }];
  if (cursor) and.push({ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, [otherKey]: { lt: cursor.id } }] });
  const rows = await prisma.follow.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: 'desc' }, { [otherKey]: 'desc' }],
    take: q.limit + 1,
    include: { follower: authorInclude, following: authorInclude },
  });
  const page = rows.slice(0, q.limit);
  const pick = (r: (typeof rows)[number]) => (mode === 'followers' ? r.follower : r.following);
  const users = page.map(pick).filter((u) => !blocked.includes(u.id) && !u.bannedAt && !u.deletionRequestedAt);
  const ids = users.map((u) => u.id);
  const [mine, theirs] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: me, followingId: { in: ids } }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: me, followerId: { in: ids } }, select: { followerId: true } }),
  ]);
  const iFollow = new Set(mine.map((f) => f.followingId));
  const followMe = new Set(theirs.map((f) => f.followerId));
  const last = page[page.length - 1];
  return {
    users: users
      .map((u) => {
        const p = authorDto(u);
        return p ? { ...p, isFollowing: iFollow.has(u.id), followsMe: followMe.has(u.id) } : null;
      })
      .filter((u): u is NonNullable<typeof u> => u !== null),
    next: rows.length > q.limit && last ? `${last.createdAt.getTime()}|${pick(last).id}` : null,
  };
}

socialRouter.get('/users/:id/followers', async (req, res) => res.json(await followList(req, 'followers')));
socialRouter.get('/users/:id/following', async (req, res) => res.json(await followList(req, 'following')));

// ---------------------------------------------------------------- Hikayeler
type StoryRow = Prisma.StoryGetPayload<Record<string, never>>;

const storyDto = (s: StoryRow, seen: Set<string>, me: string, views?: number) => ({
  id: s.id,
  kind: s.kind,
  text: s.text,
  bg: s.bg,
  photo: s.photoPath ? photoUrls(s.photoPath) : null,
  createdAt: s.createdAt,
  expiresAt: s.expiresAt,
  seen: s.authorId === me || seen.has(s.id),
  mine: s.authorId === me,
  ...(s.authorId === me ? { viewCount: views ?? 0 } : {}),
});

async function activeStories(authorIds: string[], me: string) {
  if (authorIds.length === 0) return [];
  return prisma.story.findMany({
    where: { authorId: { in: authorIds }, expiresAt: { gt: new Date() }, hiddenAt: null, author: visibleAuthor },
    orderBy: { createdAt: 'asc' },
    include: { author: authorInclude, _count: { select: { views: true } } },
  });
}

// Kendi hikayelerim + takip ettiklerimin aktif hikayeleri. Görülmemişler öne gelir.
socialRouter.get('/stories/tray', async (req, res) => {
  const me = uid(req);
  const [follows, blocked] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } }),
    blockedIdsOf(me),
  ]);
  const ids = [me, ...follows.map((f) => f.followingId).filter((id) => !blocked.includes(id))];
  const stories = await activeStories(ids, me);
  const views = await prisma.storyView.findMany({ where: { userId: me, storyId: { in: stories.map((s) => s.id) } }, select: { storyId: true } });
  const seen = new Set(views.map((v) => v.storyId));

  const byAuthor = new Map<string, typeof stories>();
  for (const s of stories) byAuthor.set(s.authorId, [...(byAuthor.get(s.authorId) ?? []), s]);
  const items = [...byAuthor.entries()]
    .map(([authorId, list]) => {
      const user = authorDto(list[0].author);
      if (!user) return null;
      return {
        user,
        mine: authorId === me,
        hasUnseen: authorId !== me && list.some((s) => !seen.has(s.id)),
        latestAt: list[list.length - 1].createdAt,
        stories: list.map((s) => storyDto(s, seen, me, s._count.views)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => Number(b.mine) - Number(a.mine) || Number(b.hasUnseen) - Number(a.hasUnseen) || b.latestAt.getTime() - a.latestAt.getTime());
  res.json({ items });
});

// Bir kullanıcının aktif hikayeleri (profildeki halka, bildirimden açma)
socialRouter.get('/users/:id/stories', async (req, res) => {
  const me = uid(req);
  const target = pid(req);
  if (target !== me && (await isBlockedEitherWay(me, target))) throw new HttpError(404, 'not_found');
  const stories = await activeStories([target], me);
  const views = await prisma.storyView.findMany({ where: { userId: me, storyId: { in: stories.map((s) => s.id) } }, select: { storyId: true } });
  const seen = new Set(views.map((v) => v.storyId));
  const user = stories[0] ? authorDto(stories[0].author) : null;
  res.json({ user, stories: stories.map((s) => storyDto(s, seen, me, s._count.views)) });
});

socialRouter.post('/stories', requireNotRestricted, socialWriteLimiter, upload.single('photo'), async (req, res) => {
  const body = z
    .object({
      kind: z.enum(['text', 'photo']),
      text: z.string().trim().max(social.storyTextMax).default(''),
      bg: z.enum(social.storyBackgrounds).default('sunset'),
    })
    .parse(req.body);
  const me = uid(req);
  await requireVerified(me);
  if (body.kind === 'text' && !body.text) throw new HttpError(400, 'validation');
  if (body.kind === 'photo' && !req.file) throw new HttpError(400, 'invalid_image');
  if (body.text) assertPublicText(body.text);
  const count = await prisma.story.count({ where: { authorId: me, createdAt: { gt: dayAgo() } } });
  if (count >= social.storiesPerDay) throw new HttpError(429, 'story_limit_reached');

  const photoPath = body.kind === 'photo' ? await storeProfilePhoto(req.file!.buffer) : '';
  // Fotoğraf hikayesi: şüpheliyse (ten oranı) yayınlanmadan gizlenir ve moderasyon kuyruğuna düşer
  let hidden = false;
  if (body.kind === 'photo') {
    const check = await imageModerator.check(req.file!.buffer).catch(() => ({ suspicious: false, reasons: [] as string[], score: 0 }));
    hidden = check.suspicious;
  }
  const story = await prisma.story.create({
    data: {
      authorId: me,
      kind: body.kind,
      text: body.text,
      bg: body.kind === 'text' ? body.bg : '',
      photoPath,
      hiddenAt: hidden ? new Date() : null,
      expiresAt: new Date(Date.now() + social.storyHours * 3_600_000),
    },
  });
  if (hidden) {
    await prisma.moderationFlag.create({
      data: { userId: me, kind: 'story_suspicious', refId: story.id, priority: 1, details: { reasons: 'skin_ratio' } },
    });
  }
  res.status(201).json({ ...storyDto(story, new Set(), me, 0), underReview: hidden });
});

socialRouter.post('/stories/:id/view', async (req, res) => {
  const me = uid(req);
  const s = await prisma.story.findFirst({ where: { id: pid(req), expiresAt: { gt: new Date() }, hiddenAt: null } });
  if (!s) throw new HttpError(404, 'not_found');
  if (s.authorId !== me && (await isBlockedEitherWay(me, s.authorId))) throw new HttpError(404, 'not_found');
  if (s.authorId !== me) {
    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId: s.id, userId: me } },
      create: { storyId: s.id, userId: me },
      update: {},
    });
  }
  res.json({ ok: true });
});

socialRouter.get('/stories/:id/viewers', async (req, res) => {
  const me = uid(req);
  const s = await prisma.story.findFirst({ where: { id: pid(req), authorId: me } });
  if (!s) throw new HttpError(404, 'not_found');
  const rows = await prisma.storyView.findMany({
    where: { storyId: s.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: authorInclude },
  });
  res.json({
    viewers: rows
      .map((r) => {
        const p = authorDto(r.user);
        return p ? { user: p, at: r.createdAt } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null),
  });
});

socialRouter.delete('/stories/:id', async (req, res) => {
  const s = await prisma.story.findFirst({ where: { id: pid(req), authorId: uid(req) } });
  if (!s) throw new HttpError(404, 'not_found');
  await prisma.story.delete({ where: { id: s.id } });
  if (s.photoPath) await removeProfilePhoto(s.photoPath).catch(() => {});
  res.json({ ok: true });
});

// ---------------------------------------------------------------- Şikayet
const ReportBody = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().max(1000).default('') });

socialRouter.post('/posts/:id/report', reportLimiter, async (req, res) => {
  const data = ReportBody.parse(req.body);
  const me = uid(req);
  const post = await prisma.post.findUnique({ where: { id: pid(req) } });
  if (!post || post.authorId === me) throw new HttpError(404, 'not_found');
  await fileReport({ fromId: me, toId: post.authorId, ...data, subjectType: 'post', subjectId: post.id, subjectText: post.body });
  res.status(201).json({ ok: true });
});

socialRouter.post('/comments/:id/report', reportLimiter, async (req, res) => {
  const data = ReportBody.parse(req.body);
  const me = uid(req);
  const c = await prisma.postComment.findUnique({ where: { id: pid(req) } });
  if (!c || c.authorId === me) throw new HttpError(404, 'not_found');
  await fileReport({ fromId: me, toId: c.authorId, ...data, subjectType: 'comment', subjectId: c.id, subjectText: c.body });
  res.status(201).json({ ok: true });
});

socialRouter.post('/stories/:id/report', reportLimiter, async (req, res) => {
  const data = ReportBody.parse(req.body);
  const me = uid(req);
  const s = await prisma.story.findUnique({ where: { id: pid(req) } });
  if (!s || s.authorId === me) throw new HttpError(404, 'not_found');
  await fileReport({
    fromId: me,
    toId: s.authorId,
    ...data,
    subjectType: 'story',
    subjectId: s.id,
    subjectText: s.kind === 'text' ? s.text : '[fotoğraf hikayesi]',
  });
  res.status(201).json({ ok: true });
});
