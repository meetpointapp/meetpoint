import type { HelpArticle } from '@prisma/client';
import { consumer, economy, retention } from '../config';
import { prisma } from '../db';
import { getFinance } from '../finance/settings';

// Yardım merkezi (SSS). İçerik veritabanında, panelden düzenlenir. Tablo boşsa ilk açılışta aşağıdaki
// varsayılan metinler yüklenir (tümünü gizlemek için silmek yerine "yayında değil" yapın).
// Metinlerdeki {{...}} değerleri güncel ayarlardan dolar: fiyat/süre değişince SSS kendiliğinden güncel kalır.

export const HELP_CATEGORIES = ['coins', 'calls', 'cashout', 'safety', 'account'] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

export const HELP_CATEGORY_TITLES: Record<HelpCategory, { tr: string; en: string; icon: string }> = {
  coins: { tr: 'Jetonlar ve satın alma', en: 'Coins & purchases', icon: '🪙' },
  calls: { tr: 'Aramalar ve hediyeler', en: 'Calls & gifts', icon: '📞' },
  cashout: { tr: 'Kazanç ve para çekme', en: 'Earnings & cash-out', icon: '💸' },
  safety: { tr: 'Güvenlik', en: 'Safety', icon: '🛡️' },
  account: { tr: 'Hesap ve gizlilik', en: 'Account & privacy', icon: '👤' },
};

type Seed = { category: HelpCategory; q: string; a: string };

const DEFAULTS: Record<'tr' | 'en', Seed[]> = {
  tr: [
    { category: 'coins', q: 'Jeton nedir, ne işe yarar?', a: 'Jeton, MeetPoint içinde kullanılan sanal birimdir. Eşleşmediğin birine mesaj isteği göndermek ({{messagePrice}} jeton), sesli/görüntülü arama, hediye, süper beğeni ve öne çıkarma için kullanılır. Eşleştikten sonra sohbet her zaman ücretsizdir. Jetonların süresi dolmaz.' },
    { category: 'coins', q: 'Jeton nasıl satın alırım?', a: 'Cüzdan sekmesinden bir paket seç. Ödeme App Store veya Google Play üzerinden alınır; jetonlar ödeme onaylanır onaylanmaz hesabına yüklenir. İlk satın almanda {{bonusPct}}% bonus jeton kazanırsın.' },
    { category: 'coins', q: 'Ödeme yaptım ama jetonlarım gelmedi', a: 'Bağlantın koptuysa yükleme birkaç dakika gecikebilir; Cüzdan ekranını aşağı çekerek yenile. Hâlâ görünmüyorsa Yardım ve destek bölümünden "Jetonlar" kategorisinde talep aç ve ilgili satın almayı seç; en geç {{slaHours}} saat içinde dönüş yaparız.' },
    { category: 'coins', q: 'Satın aldığım jetonu iade edebilir miyim?', a: 'Jeton anında teslim edilen dijital içerik olduğu için cayma hakkı yoktur (ilk satın almadan önce bunu onaylarsın). Hatalı bir çekim veya yüklenmeyen jeton gibi durumlarda bize destek talebiyle ulaş ya da mağazanın (Apple/Google) iade sürecini kullan. Mağazadan iade alınan satın almanın jetonları hesabından düşülür.' },
    { category: 'calls', q: 'Aramalar nasıl ücretlendirilir?', a: 'Sesli arama dakikası {{voiceRate}}, görüntülü arama dakikası {{videoRate}} jetondur. Her dakikanın ücreti o dakikanın başında arayandan alınır ve tamamı arananın hesabına geçer. Cevaplanmayan, reddedilen veya iptal edilen aramalardan ücret alınmaz. Bakiye bir sonraki dakikaya yetmezse arama biter; biraz önce uyarı görürsün.' },
    { category: 'calls', q: 'Arama sırasında bağlantım koptu, ne olur?', a: 'Kısa kopmalarda arama birkaç saniye bekler ve bağlantı dönünce devam eder. Kopma uzarsa arama biter; başlamış dakikanın ücreti iade edilmez, sonraki dakikalar için ücret alınmaz.' },
    { category: 'calls', q: 'Hediyeler nedir?', a: 'Arama sırasında karşı tarafa 🌹 🧸 💎 gibi hediyeler gönderebilirsin. Hediyenin jetonunun tamamı alıcıya geçer ve iade edilmez.' },
    { category: 'cashout', q: 'Kazandığım jetonları paraya çevirebilir miyim?', a: 'Evet, diğer kullanıcılardan kazandığın jetonları (mesaj isteği, arama, hediye) bozdurabilirsin. Satın aldığın veya hediye/bonus olarak aldığın jetonlar paraya çevrilemez. Bozdurmak için mavi tikli olman, kimliğini doğrulaman ve en az {{minCashoutCoins}} jetonun (≈ ${{minCashoutUsd}}) olması gerekir.' },
    { category: 'cashout', q: 'Kazancım neden hemen bozdurulamıyor?', a: 'Mağaza iadelerine karşı, kazandığın jetonlar {{maturityDays}} gün sonra bozdurulabilir hâle gelir. Bu sürede jetonları harcayabilirsin; Cüzdan ekranında ne zaman bozdurulabilir olacaklarını görürsün.' },
    { category: 'cashout', q: 'Ödemem ne zaman gelir?', a: 'Talebin incelendikten sonra genellikle 3-5 iş günü içinde bildirdiğin hesaba ödenir. Banka hesabının sahibi, kimlik doğrulamasındaki adınla aynı olmalıdır. Reddedilen talebin jetonları bakiyene geri eklenir.' },
    { category: 'safety', q: 'Birini nasıl şikayet eder veya engellerim?', a: 'Profilinde veya sohbette sağ üstteki menüden "Şikayet et" ya da "Engelle"yi seç. Engellediğin kişi seni göremez ve sana yazamaz. Şikayetler ekibimiz tarafından incelenir; acil durumlarda 112\'yi ara.' },
    { category: 'safety', q: 'Mavi tik ne anlama gelir?', a: 'Mavi tik, kişinin selfie ile profil fotoğraflarındaki kişi olduğunu doğruladığını gösterir. Profil › Profilini doğrula bölümünden verilen pozda bir selfie çekerek başvurabilirsin; ekibimiz elle onaylar.' },
    { category: 'safety', q: 'Telefon numaramı veya IBAN\'ımı paylaşmalı mıyım?', a: 'Tanımadığın kişilerle telefon, adres, banka bilgisi paylaşma ve uygulama dışında para gönderme. Sohbette bu tür bilgiler paylaşıldığında seni uyarırız. Para isteyen, uygulama dışına çekmeye çalışan kişileri şikayet et.' },
    { category: 'account', q: 'Hesabımı nasıl silerim?', a: 'Profil › Hesabı sil bölümünden şifrenle onaylayarak silebilirsin (uygulamaya giremiyorsan web\'deki hesap silme sayfasını kullan). Hesabın hemen gizlenir, {{deletionDays}} gün içinde giriş yapmazsan kalıcı olarak silinir.' },
    { category: 'account', q: 'Verilerimin bir kopyasını alabilir miyim?', a: 'Profil › Gizlilik ve verilerim › Verilerimi indir ile tüm verilerini içeren bir dosya hazırlarız; indirme bağlantısı e-postana gelir. Ayda bir kez talep edilebilir.' },
    { category: 'account', q: 'Bildirimleri nasıl ayarlarım?', a: 'Profil › Bildirimler bölümünden mesaj, eşleşme, istek, arama ve beğeni bildirimlerini ayrı ayrı açıp kapatabilir, sessiz saat belirleyebilirsin. Sessiz saatte aramalar dışında bildirim gelmez.' },
  ],
  en: [
    { category: 'coins', q: 'What are coins for?', a: 'Coins are MeetPoint\'s in-app currency. Use them to send a message request to someone you haven\'t matched with ({{messagePrice}} coins), for voice/video calls, gifts, super likes and boosts. Chatting after a match is always free. Coins never expire.' },
    { category: 'coins', q: 'How do I buy coins?', a: 'Pick a package in the Wallet tab. Payment is handled by the App Store or Google Play and coins are credited as soon as it is confirmed. Your first purchase gets a {{bonusPct}}% bonus.' },
    { category: 'coins', q: 'I paid but didn\'t get my coins', a: 'If your connection dropped, crediting may take a few minutes; pull down on the Wallet screen to refresh. If they still don\'t show, open a request under Help & support in the "Coins" category and pick the purchase; we reply within {{slaHours}} hours.' },
    { category: 'coins', q: 'Can I get a refund for coins?', a: 'Coins are digital content delivered instantly, so the right of withdrawal doesn\'t apply (you confirm this before your first purchase). For wrong charges or coins not credited, contact us via support or use the store\'s (Apple/Google) refund process. Coins of a refunded purchase are deducted from your account.' },
    { category: 'calls', q: 'How are calls charged?', a: 'Voice calls cost {{voiceRate}} and video calls {{videoRate}} coins per minute. Each minute is charged to the caller at its start and goes entirely to the person called. Missed, declined or cancelled calls are free. If your balance can\'t cover the next minute the call ends; you get a warning shortly before.' },
    { category: 'calls', q: 'My connection dropped during a call', a: 'For short drops the call waits a few seconds and continues when you reconnect. If the drop lasts longer the call ends; the started minute isn\'t refunded and no further minutes are charged.' },
    { category: 'calls', q: 'What are gifts?', a: 'During a call you can send gifts like 🌹 🧸 💎. All coins of a gift go to the receiver and are not refundable.' },
    { category: 'cashout', q: 'Can I cash out coins I earned?', a: 'Yes, coins earned from other users (message requests, calls, gifts) can be cashed out. Purchased coins and gift/bonus coins can\'t. You need a blue check, a verified identity and at least {{minCashoutCoins}} coins (≈ ${{minCashoutUsd}}).' },
    { category: 'cashout', q: 'Why can\'t I cash out my earnings right away?', a: 'To protect against store refunds, earned coins become cashable after {{maturityDays}} days. You can still spend them meanwhile; the Wallet screen shows when they mature.' },
    { category: 'cashout', q: 'When will I get paid?', a: 'After review, payouts usually arrive within 3-5 business days. The bank account holder must match the name in your identity verification. Coins of a declined request are returned to your balance.' },
    { category: 'safety', q: 'How do I report or block someone?', a: 'Use the menu at the top right of their profile or chat and choose "Report" or "Block". Blocked people can\'t see or message you. Our team reviews reports; in an emergency call your local emergency number.' },
    { category: 'safety', q: 'What does the blue check mean?', a: 'A blue check shows the person confirmed with a selfie that they are the person in their photos. Apply under Profile › Verify your profile by taking a selfie in the given pose; our team reviews it manually.' },
    { category: 'safety', q: 'Should I share my phone number or bank details?', a: 'Don\'t share your phone, address or bank details with people you don\'t know, and never send money outside the app. We warn you when such details are shared in chat. Report anyone asking for money or pushing you off the app.' },
    { category: 'account', q: 'How do I delete my account?', a: 'Go to Profile › Delete account and confirm with your password (if you can\'t sign in, use the account deletion page on our website). Your account is hidden immediately and permanently deleted unless you sign in within {{deletionDays}} days.' },
    { category: 'account', q: 'Can I get a copy of my data?', a: 'Profile › Privacy & my data › Download my data prepares a file with all your data and emails you a download link. You can request it once a month.' },
    { category: 'account', q: 'How do I manage notifications?', a: 'Under Profile › Notifications you can turn message, match, request, call and like notifications on or off and set quiet hours. During quiet hours only calls come through.' },
  ],
};

// Varsayılan metinleri yükle (tablo boşsa). Birden fazla sunucu aynı anda açılırsa kilit tek yükleme sağlar.
export async function ensureHelpArticles() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(740214)`;
    if (await tx.helpArticle.count()) return;
    const rows = (['tr', 'en'] as const).flatMap((locale) =>
      DEFAULTS[locale].map((s, i) => ({ locale, category: s.category, question: s.q, answer: s.a, position: i, updatedBy: 'varsayılan' })),
    );
    await tx.helpArticle.createMany({ data: rows });
  });
}

// {{...}} değerlerini güncel ayarlarla doldur
async function values() {
  const s = await getFinance();
  return {
    messagePrice: economy.requestPrices.MESSAGE,
    voiceRate: economy.callRates.VOICE,
    videoRate: economy.callRates.VIDEO,
    bonusPct: economy.firstPurchaseBonusPct,
    minCashoutCoins: s.cashoutMinCoins,
    minCashoutUsd: +(s.cashoutMinCoins * s.cashoutUsdPerCoin).toFixed(2),
    maturityDays: s.maturityDays,
    deletionDays: retention.deletionGraceDays,
    slaHours: consumer.supportFirstResponseHours,
  } as Record<string, string | number>;
}

export const fillValues = (text: string, v: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (whole, k: string) => (k in v ? String(v[k]) : whole));

const norm = (s: string, locale: string) => s.toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US');

// Yayındaki SSS: kategorilere göre, isteğe bağlı arama (soru ve cevapta, Türkçe harf duyarlı)
export async function listHelp(locale: 'tr' | 'en', q = '') {
  const [rows, v] = await Promise.all([
    prisma.helpArticle.findMany({ where: { locale, published: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    values(),
  ]);
  const terms = norm(q.trim(), locale).split(/\s+/).filter(Boolean);
  const filled = rows.map((r: HelpArticle) => ({ id: r.id, category: r.category, question: fillValues(r.question, v), answer: fillValues(r.answer, v) }));
  const hits = terms.length ? filled.filter((a) => terms.every((t) => norm(`${a.question} ${a.answer}`, locale).includes(t))) : filled;
  return HELP_CATEGORIES.map((c) => ({
    id: c,
    title: HELP_CATEGORY_TITLES[c][locale],
    icon: HELP_CATEGORY_TITLES[c].icon,
    articles: hits.filter((a) => a.category === c).map(({ id, question, answer }) => ({ id, question, answer })),
  })).filter((c) => c.articles.length > 0);
}
