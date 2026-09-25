import { Router } from 'express';
import { z } from 'zod';
import { consumer } from '../config';
import { listHelp } from '../support/help';
import { esc, sendPage } from '../web/page';

// Yardım merkezi: herkese açık (giriş yapmadan da okunur). Uygulama JSON'u kullanır; web sayfası
// mağaza "destek adresi" olarak verilebilir.
export const helpRouter = Router();

const query = z.object({ lang: z.enum(['tr', 'en']).catch('tr'), q: z.string().max(100).catch('') });

helpRouter.get('/articles', async (req, res) => {
  const { lang, q } = query.parse(req.query);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ categories: await listHelp(lang, q) });
});

// Cevaplardaki satır sonları paragraf olur
const paragraphs = (s: string) => s.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

helpRouter.get('/', async (req, res) => {
  const { lang, q } = query.parse(req.query);
  const tr = lang === 'tr';
  const categories = await listHelp(lang, q);
  const list = categories.length
    ? categories
        .map((c) => `<h2>${c.icon} ${esc(c.title)}</h2>${c.articles.map((a) => `<details${q ? ' open' : ''}><summary>${esc(a.question)}</summary>${paragraphs(a.answer)}</details>`).join('')}`)
        .join('')
    : `<div class="box">${tr ? 'Sonuç bulunamadı. Farklı kelimelerle dene ya da uygulamadan bize yaz.' : 'No results. Try other words or write to us from the app.'}</div>`;
  sendPage(
    res,
    lang,
    tr ? 'Yardım merkezi' : 'Help center',
    `<h1>${tr ? 'Yardım merkezi' : 'Help center'}</h1>
<form class="row" method="get" action=""><input type="hidden" name="lang" value="${lang}">
<input type="search" name="q" value="${esc(q)}" placeholder="${tr ? 'Ne arıyorsun? (ör. arama ücreti)' : 'Search (e.g. call price)'}"><button type="submit">${tr ? 'Ara' : 'Search'}</button></form>
${list}
<div class="box">${
      tr
        ? `Cevabını bulamadın mı? Uygulamada <b>Profil › Yardım ve destek</b> bölümünden talep aç; en geç ${consumer.supportFirstResponseHours} saat içinde yanıtlarız. Künye ve iletişim: <a href="/legal/imprint?lang=tr">Künye</a> · Hesabını silmek için: <a href="/account/delete?lang=tr">Hesap silme</a>`
        : `Didn't find your answer? Open a request under <b>Profile › Help &amp; support</b> in the app; we reply within ${consumer.supportFirstResponseHours} hours. Contact: <a href="/legal/imprint?lang=en">Imprint</a> · To delete your account: <a href="/account/delete?lang=en">Account deletion</a>`
    }</div>`,
  );
});
