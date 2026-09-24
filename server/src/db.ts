import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export class HttpError extends Error {
  // details: yanıta eklenen ek bilgi (ör. hangi rızanın eksik olduğu, bekleme bitişi)
  constructor(
    public status: number,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

// Sohbetlerde kullanıcı çifti her zaman sıralı tutulur (userAId < userBId)
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function isBlockedEitherWay(a: string, b: string) {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { fromId: a, toId: b },
        { fromId: b, toId: a },
      ],
    },
  });
  return block !== null;
}
