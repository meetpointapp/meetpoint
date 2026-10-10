import { Router } from 'express';
import { config } from '../config';
import { prisma } from '../db';
import { esc, sendPage } from '../web/page';

// Faz 17 madde 11: kişisel bağlantı linki ("Beni VibeUpMe'de bul"). Davet programıyla (src/referral.ts)
// aynı kodu kullanır — ayrı bir kimlik üretmeye gerek yok, ikisi de "kendi kodun" kavramı. Tamamen
// herkese açık (oturum gerekmez): sadece görünen ad gösterilir, fotoğraf yok (gizlilik — bu sayfayı
// arama motorları da görebilir, noindex olsa bile bazı botlar bunu yok sayar).
export const personalLinkRouter = Router();

const lang = (v: unknown) => (v === 'en' ? 'en' : 'tr') as 'tr' | 'en';

const T = {
  tr: {
    title: 'VibeUpMe',
    foundIntro: (name: string) => `<b>${esc(name)}</b> seni VibeUpMe'de bekliyor! 💌`,
    genericIntro: "Biri seni VibeUpMe'ye davet etti! 💌",
    body: 'VibeUpMe; sohbet, sesli/görüntülü arama ve gerçek bağlantılar için tasarlanmış bir tanışma uygulaması.',
    download: 'Uygulamayı indir',
    downloadHint: 'VibeUpMe uygulamasını App Store veya Google Play\'den indirebilirsin.',
  },
  en: {
    title: 'VibeUpMe',
    foundIntro: (name: string) => `<b>${esc(name)}</b> is waiting for you on VibeUpMe! 💌`,
    genericIntro: 'Someone invited you to VibeUpMe! 💌',
    body: 'VibeUpMe is a dating app built for chat, voice/video calls and real connections.',
    download: 'Download the app',
    downloadHint: "You can download VibeUpMe from the App Store or Google Play.",
  },
};

personalLinkRouter.get('/:code', async (req, res) => {
  const l = lang(req.query.lang);
  const t = T[l];
  const code = String(req.params.code).trim().toUpperCase();
  const user = code
    ? await prisma.user.findUnique({
        where: { referralCode: code },
        select: { bannedAt: true, deletionRequestedAt: true, profile: { select: { displayName: true } } },
      })
    : null;
  const found = user && !user.bannedAt && !user.deletionRequestedAt && user.profile;
  const intro = found ? t.foundIntro(user.profile!.displayName) : t.genericIntro;

  const downloadButton =
    config.appStoreUrl || config.playStoreUrl
      ? `<p>${
          config.appStoreUrl ? `<a href="${esc(config.appStoreUrl)}"><button type="button" style="width:100%">${t.download} (iOS)</button></a>` : ''
        }${config.appStoreUrl && config.playStoreUrl ? '<br><br>' : ''}${
          config.playStoreUrl ? `<a href="${esc(config.playStoreUrl)}"><button type="button" style="width:100%">${t.download} (Android)</button></a>` : ''
        }</p>`
      : `<p class="muted">${t.downloadHint}</p>`;

  sendPage(
    res,
    l,
    t.title,
    `<h1>💘 ${t.title}</h1><div class="box"><p>${intro}</p><p class="muted">${t.body}</p></div>${downloadButton}`,
  );
});
