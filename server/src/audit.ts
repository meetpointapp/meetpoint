import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { authedUser } from './auth';
import { prisma } from './db';

export const adminEmailOf = async (req: Request) =>
  (await prisma.user.findUnique({ where: { id: authedUser(req).id }, select: { email: true } }))?.email ?? '';

// Yönetim işlem kaydı: kim, ne zaman, hangi kayıtta ne yaptı. Kayıtlar değiştirilemez ve silinemez
// (veritabanı tetikleyicisi UPDATE/DELETE'i reddeder). Hassas veri görüntüleme (IBAN, selfie) de kaydedilir.
export async function audit(req: Request, action: string, targetType = '', targetId = '', details: Prisma.InputJsonObject = {}) {
  const admin = authedUser(req);
  const email = await adminEmailOf(req);
  await prisma.adminAudit.create({
    data: { adminId: admin.id, adminEmail: email, action, targetType, targetId, details, ip: String(req.ip ?? '').slice(0, 64) },
  });
}
