import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { uid } from '../auth';
import { VERIFICATION_POSES } from '../catalog';
import { config } from '../config';
import { HttpError, prisma } from '../db';

// Selfie ile profil doğrulama (mavi tik). Kullanıcıya rastgele bir poz verilir,
// o pozda selfie çeker; yönetim panelinden elle onaylanır. Selfie herkese açık değildir.
export const verificationRouter = Router();

fs.mkdirSync(config.privateUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: config.privateUploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `selfie-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic)$/.test(file.mimetype)),
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
    fs.rmSync(req.file.path, { force: true });
    throw new HttpError(409, 'verification_not_started');
  }
  await prisma.$transaction([
    prisma.verificationRequest.create({
      data: { userId: user.id, pose: user.verificationPose, selfiePath: req.file.filename },
    }),
    prisma.user.update({ where: { id: user.id }, data: { verificationStatus: 'pending', verificationPose: '' } }),
  ]);
  res.status(201).json({ status: 'pending' });
});
