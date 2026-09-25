import express, { Router } from 'express';
import { z } from 'zod';
import { retention } from '../config';
import { HttpError, prisma } from '../db';
import { webDeleteLimiter } from '../limits';
import { assertNotLocked, clearLoginFailures, recordLoginFailure, verifyPassword } from '../passwords';
import { requestDeletion } from '../privacy/accounts';
import { esc, sendPage } from '../web/page';

// Web'den hesap silme (Google Play "hesap silme bağlantısı" zorunluluğu; uygulamaya giremeyenler için).
// Uygulamadaki silmeyle aynı: e-posta + şifre ile onay, hesap hemen gizlenir, bekleme süresi sonunda
// kalıcı silinir, bu sürede giriş yapılırsa geri gelir. Hesap kilidi ve IP sınırı girişle aynı.
export const accountWebRouter = Router();

const lang = (v: unknown) => (v === 'en' ? 'en' : 'tr') as 'tr' | 'en';

const T = {
  tr: {
    title: 'Hesap silme',
    intro: `MeetPoint hesabını ve verilerini silmek için e-posta adresini ve şifreni gir. Hesabın hemen gizlenir ve <b>${retention.deletionGraceDays} gün</b> içinde giriş yapmazsan kalıcı olarak silinir: profil, fotoğraflar, eşleşmeler, mesajlar, jeton bakiyesi ve diğer tüm veriler. Yasal saklama yükümlülüğü olan kayıtlar (ör. satın alma ve ödeme kayıtları) kanuni süre boyunca ayrı saklanır.`,
    app: 'Uygulamaya girebiliyorsan <b>Profil › Hesabı sil</b> bölümünü de kullanabilirsin.',
    email: 'E-posta',
    password: 'Şifre',
    submit: 'Hesabımı sil',
    forgot: 'Şifreni unuttuysan önce uygulamadan "Şifremi unuttum" ile yeni şifre belirle.',
    done: (d: string) => `Hesap silme talebin alındı. Hesabın artık görünmüyor ve <b>${d}</b> tarihinde kalıcı olarak silinecek. Fikrini değiştirirsen bu tarihten önce uygulamaya giriş yapman yeterli. Onay e-postası gönderdik.`,
    bad: 'E-posta veya şifre hatalı.',
    locked: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.',
    pending: 'Bekleyen bir para çekme talebin var. Önce uygulamadan iptal et ya da sonuçlanmasını bekle.',
  },
  en: {
    title: 'Delete account',
    intro: `Enter your email and password to delete your MeetPoint account and data. Your account is hidden immediately and permanently deleted unless you sign in within <b>${retention.deletionGraceDays} days</b>: profile, photos, matches, messages, coin balance and all other data. Records we must keep by law (e.g. purchase and payout records) are kept separately for the legal period.`,
    app: 'If you can sign in, you can also use <b>Profile › Delete account</b> in the app.',
    email: 'Email',
    password: 'Password',
    submit: 'Delete my account',
    forgot: 'Forgot your password? Reset it first with "Forgot password" in the app.',
    done: (d: string) => `We received your request. Your account is hidden and will be permanently deleted on <b>${d}</b>. If you change your mind, just sign in before then. We sent you a confirmation email.`,
    bad: 'Wrong email or password.',
    locked: 'Too many failed attempts. Try again in 15 minutes.',
    pending: 'You have a pending cash-out request. Cancel it in the app or wait until it is processed.',
  },
};

function form(l: 'tr' | 'en', message = '', email = '') {
  const t = T[l];
  return `<h1>${t.title}</h1><p>${t.intro}</p><p class="muted">${t.app}</p>
${message ? `<div class="box error">${message}</div>` : ''}
<form method="post" action="?lang=${l}">
<input type="email" name="email" value="${esc(email)}" placeholder="${t.email}" autocomplete="email" required maxlength="200">
<input type="password" name="password" placeholder="${t.password}" autocomplete="current-password" required maxlength="128">
<button type="submit">${t.submit}</button></form>
<p class="muted">${t.forgot}</p>`;
}

accountWebRouter.get('/delete', (req, res) => {
  const l = lang(req.query.lang);
  sendPage(res, l, T[l].title, form(l));
});

accountWebRouter.post(
  '/delete',
  webDeleteLimiter,
  express.urlencoded({ extended: false, limit: '4kb' }),
  async (req, res) => {
    const l = lang(req.query.lang);
    const t = T[l];
    const parsed = z
      .object({ email: z.string().trim().toLowerCase().max(200), password: z.string().min(1).max(128) })
      .safeParse(req.body);
    if (!parsed.success) return sendPage(res, l, t.title, form(l, t.bad), 400);
    const { email, password } = parsed.data;
    try {
      await assertNotLocked(email);
      const user = await prisma.user.findUnique({ where: { email } });
      const check = await verifyPassword(user?.passwordHash ?? null, password);
      if (!user || !check.ok) {
        await recordLoginFailure(email);
        return sendPage(res, l, t.title, form(l, t.bad, email), 401);
      }
      await clearLoginFailures(email);
      const deleteAfter = await requestDeletion(user.id);
      const when = deleteAfter.toLocaleDateString(l === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
      sendPage(res, l, t.title, `<h1>${t.title}</h1><div class="box ok">${t.done(when)}</div>`);
    } catch (e) {
      if (e instanceof HttpError && e.code === 'account_locked') return sendPage(res, l, t.title, form(l, t.locked, email), 429);
      if (e instanceof HttpError && e.code === 'payout_pending') return sendPage(res, l, t.title, form(l, t.pending, email), 409);
      throw e;
    }
  },
);
