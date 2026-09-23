import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// SQLite (geliştirme): WAL kipi okuyucuların yazıcıyı beklemesini önler (dosyada kalıcı).
// PostgreSQL'e geçişte (Faz 9) bu adım kalkar.
export async function prepareDatabase() {
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
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
