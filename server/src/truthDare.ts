import { prisma } from './db';

// Faz 23 (oyun): "Doğruluk mu Cesaret mi" — iki kullanıcı arasında 10 turluk, sunucunun soru sorduğu oyun.
// Soru havuzu burada: her soru iki dilde. Cesaret görevleri yazıyla yapılabilen türden (fotoğraf/ses yok),
// doğruluk soruları romantik, eğlenceli ve derin olarak karışık. Müstehcen içerik yok (uygulama 18+ ama
// herkese açık bir ilk tanışma oyunu).

export type PromptKind = 'truth' | 'dare';
export type PromptTone = 'romantic' | 'fun' | 'deep';
export interface Prompt {
  id: string;
  kind: PromptKind;
  tone: PromptTone;
  tr: string;
  en: string;
}

export const ROUNDS = 10;
export const INVITES_PER_DAY = 10;
export const STALE_DAYS = 7;

const t = (n: number, tone: PromptTone, tr: string, en: string): Prompt => ({ id: `t${String(n).padStart(2, '0')}`, kind: 'truth', tone, tr, en });
const d = (n: number, tone: PromptTone, tr: string, en: string): Prompt => ({ id: `d${String(n).padStart(2, '0')}`, kind: 'dare', tone, tr, en });

export const PROMPTS: Prompt[] = [
  // ---------------- Doğruluk · romantik
  t(1, 'romantic', 'İlk görüşte aşka inanır mısın? Hiç yaşadın mı?', 'Do you believe in love at first sight? Has it ever happened to you?'),
  t(2, 'romantic', 'Bir buluşmada seni en çok ne etkiler?', 'What impresses you the most on a date?'),
  t(3, 'romantic', 'Hayalindeki ilk buluşma nasıl geçer?', 'What does your dream first date look like?'),
  t(4, 'romantic', 'Birinin seni sevdiğini en çok hangi davranıştan anlarsın?', 'Which behavior makes you feel most loved by someone?'),
  t(5, 'romantic', 'Sevdiğin birine romantik bir sürpriz yapsan ne yapardın?', 'If you planned a romantic surprise for someone, what would you do?'),
  t(6, 'romantic', 'Bir ilişkide asla taviz vermeyeceğin şey nedir?', 'What is the one thing you would never compromise on in a relationship?'),
  t(7, 'romantic', 'En son ne zaman birine karşı kalbin hızlı attı?', 'When did your heart last race for someone?'),
  t(8, 'romantic', 'Aşkta en büyük korkun nedir?', 'What is your biggest fear in love?'),
  t(9, 'romantic', 'Çiçek, el yazısı mektup ya da sürpriz yolculuk: hangisi seni daha çok mutlu eder?', 'Flowers, a handwritten letter or a surprise trip: which makes you happiest?'),
  t(10, 'romantic', 'Bir ilişkide en çekici bulduğun huy hangisi?', 'Which trait do you find most attractive in a partner?'),
  t(11, 'romantic', 'Eski bir ilişkiden öğrendiğin en değerli ders neydi?', 'What is the most valuable lesson you learned from a past relationship?'),
  t(12, 'romantic', 'Birini tanırken en çok neye dikkat edersin: göz, ses ya da mizah?', 'When getting to know someone, what do you notice most: eyes, voice or humor?'),
  t(13, 'romantic', 'Bir ilişkide güven mi, tutku mu daha önemli?', 'In a relationship, is trust or passion more important?'),
  t(14, 'romantic', 'Aşkta romantik misin yoksa pratik mi?', 'In love, are you a romantic or a practical one?'),
  t(15, 'romantic', 'Hiç aşk mektubu ya da uzun bir mesaj yazdın mı? Kime?', 'Have you ever written a love letter or a long message? To whom?'),
  t(16, 'romantic', 'Bir aşk şarkısı seçmen gerekse hangisi olurdu?', 'If you had to pick one love song, which would it be?'),
  t(17, 'romantic', 'Kıskançlık hakkında ne düşünüyorsun?', 'What do you think about jealousy?'),
  t(18, 'romantic', 'Seninle ilk kez tanışan biri seni nasıl tarif ederdi?', 'How would someone meeting you for the first time describe you?'),
  // ---------------- Doğruluk · eğlenceli
  t(19, 'fun', 'Telefonundaki en utanç verici şarkı hangisi?', 'What is the most embarrassing song on your phone?'),
  t(20, 'fun', 'Kimsenin bilmediği tuhaf bir alışkanlığın var mı?', 'Do you have a weird habit nobody knows about?'),
  t(21, 'fun', 'En son ne zaman gülmekten ağladın, neye?', 'When did you last laugh until you cried, and at what?'),
  t(22, 'fun', 'Yalnızken en sık yaptığın saçma şey nedir?', 'What is the silliest thing you do when you are alone?'),
  t(23, 'fun', 'Yediğin en tuhaf yemek neydi?', 'What is the strangest thing you have ever eaten?'),
  t(24, 'fun', 'Çocukken en büyük korkun neydi?', 'What was your biggest fear as a kid?'),
  t(25, 'fun', 'Bir gün görünmez olsan ne yapardın?', 'If you were invisible for a day, what would you do?'),
  t(26, 'fun', 'Hayatındaki en komik buluşma anısı nedir?', 'What is the funniest date memory you have?'),
  t(27, 'fun', 'Hiç yanlış kişiye mesaj attın mı? Ne oldu?', 'Have you ever texted the wrong person? What happened?'),
  t(28, 'fun', 'Duşta şarkı söylerken en çok hangi şarkıyı seçersin?', 'Which song do you sing most in the shower?'),
  t(29, 'fun', 'En saçma korkun nedir?', 'What is your most irrational fear?'),
  t(30, 'fun', 'Kendini hangi hayvana benzetirsin, neden?', 'Which animal are you most like, and why?'),
  t(31, 'fun', 'Sabah uyanınca ilk yaptığın şey nedir?', 'What is the first thing you do when you wake up?'),
  t(32, 'fun', 'Bir yabancıyla konuşmaya başlarken genelde ilk ne söylersin?', 'What do you usually say first when you start talking to a stranger?'),
  t(33, 'fun', 'Bir gün boyunca dilediğin biriyle yemek yiyebilsen kim olurdu?', 'If you could have dinner with anyone for a day, who would it be?'),
  t(34, 'fun', 'En kötü ilk buluşma deneyimin neydi?', 'What was your worst first date?'),
  t(35, 'fun', 'Hangi konuda "ben bu işin ustasıyım" dersin?', 'What are you absolutely the best at?'),
  t(36, 'fun', 'Pazar sabahını mükemmel yapan şey nedir?', 'What makes a Sunday morning perfect for you?'),
  // ---------------- Doğruluk · derin
  t(37, 'deep', 'Hayatta en çok neyi başarmak istersin?', 'What do you want to achieve most in life?'),
  t(38, 'deep', 'Seni en çok ne mutlu eder?', 'What makes you the happiest?'),
  t(39, 'deep', 'Kendinde değiştirmek istediğin bir özellik var mı?', 'Is there a trait of yours you would like to change?'),
  t(40, 'deep', 'Bir yıl boyunca her şeyi yapabilecek olsan ne yapardın?', 'If you could do anything for a year, what would you do?'),
  t(41, 'deep', 'Geri dönüp değiştirmek isteyeceğin bir an var mı?', 'Is there a moment you would go back and change?'),
  t(42, 'deep', 'Hayatındaki en büyük cesaret anın neydi?', 'What was the bravest moment of your life?'),
  t(43, 'deep', 'Arkadaşların seni nasıl tarif eder?', 'How would your friends describe you?'),
  t(44, 'deep', 'Kendini en rahat hissettiğin yer neresi?', 'Where do you feel most at ease?'),
  t(45, 'deep', 'Hayatının filmi olsa türü ne olurdu?', 'If your life were a movie, what genre would it be?'),
  t(46, 'deep', '10 yıl sonra kendini nerede görüyorsun?', 'Where do you see yourself in 10 years?'),
  t(47, 'deep', 'Bugüne kadar aldığın en iyi tavsiye neydi?', 'What is the best advice you have ever received?'),
  t(48, 'deep', 'Asla vazgeçmeyeceğin bir değerin ne?', 'What is a value you would never give up on?'),
  t(49, 'deep', 'Kimseye söylemediğin bir hayalin var mı?', 'Do you have a dream you have never told anyone?'),
  t(50, 'deep', 'Şu an en çok neyi merak ediyorsun?', 'What are you most curious about right now?'),
  t(51, 'deep', 'Bu uygulamaya girme sebebin neydi? Dürüst ol.', 'What made you join this app? Be honest.'),
  t(52, 'deep', 'Seni en çok ne zaman hayal kırıklığına uğrattılar ve ne yaptın?', 'When were you most disappointed by someone, and what did you do?'),
  // ---------------- Cesaret · romantik
  d(1, 'romantic', 'Karşındaki kişiyi profilinden edindiğin ilk izlenimle 3 kelimeyle tarif et.', 'Describe the other person in 3 words based on your first impression.'),
  d(2, 'romantic', 'Ona iki dizelik kısa bir şiir yaz.', 'Write a short two-line poem for them.'),
  d(3, 'romantic', 'Birlikte yapacağınız hayali ilk buluşmayı 3 cümleyle planla.', 'Plan your imaginary first date together in 3 sentences.'),
  d(4, 'romantic', 'Bir film replikiyle ona iltifat et.', 'Compliment them with a line from a movie.'),
  d(5, 'romantic', '"Seni biraz tanıyınca…" diye başlayan bir cümle yaz.', 'Complete this sentence: "After getting to know you a little…"'),
  d(6, 'romantic', 'Ona şaka seviyesinde, çok kısa bir "aşk ilanı" yaz.', 'Write a very short, playful "love declaration" for them.'),
  d(7, 'romantic', 'Ona yazabileceğin en tatlı iltifatı yaz.', 'Write the sweetest compliment you can think of for them.'),
  d(8, 'romantic', 'İkinizin birlikte yapabileceği en romantik şeyi bir cümleyle yaz.', 'Write the most romantic thing the two of you could do together in one sentence.'),
  d(9, 'romantic', 'Ona bir şarkı öner ve seni neden ona hatırlattığını yaz.', 'Recommend them a song and say why it reminds you of them.'),
  d(10, 'romantic', 'Onun adıyla bir akrostiş (ilk harflerle cümle) yazmaya çalış.', 'Try writing an acrostic using the first letters of their name.'),
  d(11, 'romantic', 'İlk buluşmada ne giymek isteyeceğini ve nedenini anlat.', 'Say what you would wear on a first date and why.'),
  d(12, 'romantic', 'Onun gülüşünü hayal et ve tarif et.', 'Imagine their smile and describe it.'),
  d(13, 'romantic', 'Seni mutlu eden küçük bir şeyi ona anlat, o da bunu denesin.', 'Tell them a small thing that makes you happy so they can try it.'),
  d(14, 'romantic', 'Birlikte seyredeceğiniz filmi seç ve neden onu seçtiğini yaz.', 'Pick a movie to watch together and say why.'),
  // ---------------- Cesaret · eğlenceli
  d(15, 'fun', 'Kendini sadece 5 emojiyle anlat ve açıkla.', 'Describe yourself with only 5 emojis and explain.'),
  d(16, 'fun', 'Şu an ne yaptığını bir haber spikeri gibi anlat.', 'Describe what you are doing right now like a news anchor.'),
  d(17, 'fun', 'En sevdiğin yemeği bir restoran eleştirmeni gibi öv.', 'Praise your favorite dish like a restaurant critic.'),
  d(18, 'fun', 'Bir hayvanı taklit ettiğini hayal et ve yazıyla anlat: hangi hayvan, nasıl ses?', 'Imitate an animal in writing: which animal, what sound?'),
  d(19, 'fun', 'Şu anki ruh halini bir hava durumu raporu gibi anlat.', 'Describe your current mood as a weather report.'),
  d(20, 'fun', 'Telefonundaki son fotoğrafı ayrıntılı tarif et (göndermeden).', 'Describe the last photo on your phone in detail (without sending it).'),
  d(21, 'fun', 'Kendine bir süper kahraman adı ve süper gücü uydur.', 'Invent a superhero name and a superpower for yourself.'),
  d(22, 'fun', 'Haftasonu planını 3 kelimeyle söyle.', 'Tell your weekend plan in 3 words.'),
  d(23, 'fun', 'Şu an etrafında gördüğün en tuhaf şeyi anlat.', 'Describe the strangest thing you can see around you right now.'),
  d(24, 'fun', 'Kendini bir reklam sloganıyla sat.', 'Sell yourself with an advertising slogan.'),
  d(25, 'fun', '"Beni en iyi anlatan şey…" cümlesini tamamla.', 'Complete the sentence: "The thing that describes me best is…"'),
  d(26, 'fun', 'Bir dakikada yazabileceğin en iyi şakayı yaz.', 'Write the best joke you can come up with in a minute.'),
  d(27, 'fun', 'Çocukluktaki en sevdiğin oyunu anlat.', 'Describe your favorite childhood game.'),
  d(28, 'fun', 'Bir bilmece sor; cevabı bir sonraki tur söylersin.', 'Ask a riddle; you give the answer next round.'),
  d(29, 'fun', 'Bugün yaşadığın en komik şeyi iki cümleyle yaz.', 'Write the funniest thing that happened to you today in two sentences.'),
  d(30, 'fun', 'Hayatını anlatan bir film ismi uydur.', 'Come up with a movie title that describes your life.'),
  d(31, 'fun', 'Dünyayı 24 saat yönetsen çıkaracağın ilk kuralı yaz.', 'If you ruled the world for 24 hours, write the first rule you would make.'),
  d(32, 'fun', 'Şu anki kıyafetini bir moda yorumcusu gibi anlat.', 'Describe your outfit like a fashion commentator.'),
  // ---------------- Cesaret · derin
  d(33, 'deep', 'Karşındaki hakkında bir tahminde bulun ve nedenini söyle.', 'Make a guess about the other person and say why.'),
  d(34, 'deep', 'Hayatındaki en güzel anıyı üç cümleyle anlat.', 'Describe the best memory of your life in three sentences.'),
  d(35, 'deep', 'Kendini en fazla 10 kelimeyle tanımla.', 'Describe yourself in at most 10 words.'),
  d(36, 'deep', '"Hayat…" diye başlayan bir cümle kur.', 'Complete the sentence: "Life is…"'),
  d(37, 'deep', 'Bugün minnettar olduğun üç şeyi yaz.', 'Write three things you are grateful for today.'),
  d(38, 'deep', 'Şu an aklını meşgul eden bir düşünceyi paylaş.', 'Share a thought that is on your mind right now.'),
  d(39, 'deep', 'Bu hafta yaptığın en iyi şeyi anlat.', 'Tell the best thing you did this week.'),
  d(40, 'deep', 'En sevdiğin kitap ya da diziden bir sahneyi anlat.', 'Describe a scene from your favorite book or series.'),
  d(41, 'deep', 'Karşındakine tek cümlelik bir hayat tavsiyesi ver.', 'Give the other person a one-sentence piece of life advice.'),
  d(42, 'deep', 'Gelecekteki kendine yazacağın mektubun ilk cümlesini yaz.', 'Write the first sentence of a letter to your future self.'),
  d(43, 'deep', 'Bir korkunla nasıl başa çıktığını anlat.', 'Tell how you dealt with a fear.'),
  d(44, 'deep', 'Kendini en çok hangi şarkı anlatır, neden?', 'Which song describes you best, and why?'),
  d(45, 'deep', 'Hayatında seni en çok değiştiren olayı anlat.', 'Describe the event that changed you the most.'),
  d(46, 'deep', 'Birinde en çok neyi takdir edersin? Karşındaki için bunu bul.', 'What do you admire most in someone? Find that in the other person.'),
];

export const promptById = new Map(PROMPTS.map((p) => [p.id, p]));

// Bu oyunda daha önce verilmeyen rastgele bir soru seç (tür verilen: doğruluk/cesaret)
export function pickPrompt(kind: PromptKind, used: Set<string>): Prompt {
  const pool = PROMPTS.filter((p) => p.kind === kind && !used.has(p.id));
  const list = pool.length ? pool : PROMPTS.filter((p) => p.kind === kind); // havuz tükenirse tekrar serbest
  return list[Math.floor(Math.random() * list.length)];
}

export const promptText = (id: string, locale: string) => {
  const p = promptById.get(id);
  return p ? (locale === 'tr' ? p.tr : p.en) : '';
};

// Engellenince iki kişi arasındaki açık oyunlar kapanır
export async function endGamesBetween(a: string, b: string) {
  await prisma.truthDareGame.updateMany({
    where: { status: 'ACTIVE', OR: [{ userAId: a, userBId: b }, { userAId: b, userBId: a }] },
    data: { status: 'ENDED' },
  });
}
