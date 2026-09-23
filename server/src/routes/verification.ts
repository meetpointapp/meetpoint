import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { sanitizePrivatePhoto } from '../images';
import { privateStore, randomKey } from '../storage';
import { uid } from '../auth';
import { VERIFICATION_POSES } from '../catalog';
import { HttpError, prisma } from '../db';

// Selfie ile profil doğrulama (mavi tik). Kullanıcıya rastgele bir poz verilir,
// o pozda selfie çeker; yönetim panelinden elle onaylanır. Selfie herkese açık değildir.
export const verificationRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  // Tür ön süzgeci; asıl kontrol images.ts'te dosyanın içeriğine bakılarak yapılır
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

verificationRouter.post('/me/verification/start', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (user.verificationStatus === 'approved') throw new HttpError(409, 'already_verified');
  if (user.verificationStatus === 'pending') throw new HttpError(409, 'verification_pending');
  const pose = VERIFICATION_POSES[crypto.randomInt(VERIFICATION_POSES.length)];
  await prisma.user.update({ where: { id: user.id }, data: { verificationPose: pose } });
  res.json({ pose });
});

verificationRouter.post('/me/verification', upload.single('selfie'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'invalid_image');
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (!user.verificationPose || user.verificationStatus === 'pending' || user.verificationStatus === 'approved') {
    throw new HttpError(409, 'verification_not_started');
  }
  const key = randomKey('selfie', 'webp');
  await privateStore.put(key, await sanitizePrivatePhoto(req.file.buffer));
  await prisma.$transaction([
    prisma.verificationRequest.create({
      data: { userId: user.id, pose: user.verificationPose, selfiePath: key },
    }),
    prisma.user.update({ where: { id: user.id }, data: { verificationStatus: 'pending', verificationPose: '' } }),
  ]);
  res.status(201).json({ status: 'pending' });
});
