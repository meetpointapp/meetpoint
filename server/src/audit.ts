import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { authedUser } from './auth';
import { prisma } from './db';

// Yönetim işlem kaydı: kim, ne zaman, hangi kayıtta ne yaptı. Kayıtlar değiştirilemez ve silinemez
// (veritabanı tetikleyicisi UPDATE/DELETE'i reddeder). Hassas veri görüntüleme (IBAN, selfie) de kaydedilir.
export async function audit(req: Request, action: string, targetType = '', targetId = '', details: Prisma.InputJsonObject = {}) {
  const admin = authedUser(req);
  const email = (await prisma.user.findUnique({ where: { id: admin.id }, select: { email: true } }))?.email ?? '';
  await prisma.adminAudit.create({
    data: { adminId: admin.id, adminEmail: email, action, targetType, targetId, details, ip: String(req.ip ?? '').slice(0, 64) },
  });
}
