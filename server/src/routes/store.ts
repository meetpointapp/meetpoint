import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { STORE_ITEM_IDS, STORE_ITEMS } from '../catalog';
import { HttpError, prisma } from '../db';
import { debit } from '../wallet';

export const storeRouter = Router();

// Faz 16: kozmetik mağaza. Jetonla alınır (kullanıcıdan kullanıcıya geçmez, gerçek para IAP'inden
// ayrı — bkz. Purchase modeli). Kalıcı sahiplik: bir kez alınan öğe her zaman seçilebilir.
export async function ownedItemIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.storePurchase.findMany({ where: { userId }, select: { itemId: true } });
  return new Set(rows.map((r) => r.itemId));
}

// id boşsa veya ücretsiz kataloğa aitse sorun yok; premium kataloğa aitse sahiplik gerekir
export function assertOwned(owned: Set<string>, id: string, premiumIds: readonly string[]) {
  if (id && (premiumIds as string[]).includes(id) && !owned.has(id)) throw new HttpError(403, 'item_not_owned');
}

storeRouter.get('/store/items', async (req, res) => {
  const owned = await ownedItemIds(uid(req));
  res.json(STORE_ITEMS.map((i) => ({ ...i, owned: owned.has(i.id) })));
});

storeRouter.post('/store/purchase', async (req, res) => {
  const { itemId } = z.object({ itemId: z.enum(STORE_ITEM_IDS) }).parse(req.body);
  const userId = uid(req);
  const item = STORE_ITEMS.find((i) => i.id === itemId)!;

  const existing = await prisma.storePurchase.findUnique({ where: { userId_itemId: { userId, itemId } } });
  if (existing) throw new HttpError(400, 'already_owned');

  await prisma.$transaction(async (tx) => {
    await debit(tx, userId, item.priceCoins, 'SPEND', { note: `store:${itemId}` });
    await tx.storePurchase.create({ data: { userId, itemId } });
  });
  res.json({ ok: true });
});
