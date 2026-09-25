import { retention } from '../config';

// Kişisel veri envanteri (KVKK md. 10, VERBİS için temel). Hangi veri, hangi amaçla, hangi hukuki sebeple,
// ne kadar süre, kime aktarılıyor. Birim testi veritabanındaki her tablonun burada yer aldığını denetler:
// yeni tablo eklenince envanter güncellenmeden testler geçmez. Belge: `npm run kvkk:inventory`.
//
// Hukuki sebepler (md. 5-6): sözleşme = sözleşmenin kurulması/ifası; yasal = hukuki yükümlülük;
// meşru = meşru menfaat; hak = bir hakkın tesisi/korunması; rıza = açık rıza.

export type LegalBasis = 'sözleşme' | 'yasal' | 'meşru' | 'hak' | 'rıza';

export interface InventoryEntry {
  category: string; // veri kategorisi (VERBİS terimleriyle yakın)
  tables: string[]; // Prisma modelleri
  data: string; // hangi alanlar
  purpose: string;
  basis: LegalBasis[];
  retention: string;
  recipients: string; // aktarım (yurt içi / yurt dışı)
  special?: boolean; // özel nitelikli veri
}

const g = retention;

export const INVENTORY: InventoryEntry[] = [
  {
    category: 'Kimlik ve iletişim',
    tables: ['User'],
    data: 'E-posta, dil, kayıt tarihi, onaylanan metin sürümleri (satış metinleri dahil), rıza durumları, bildirim tercihleri ve sessiz saatler, son etkinlik',
    purpose: 'Hesap oluşturma ve yönetimi, bildirimler, yasal onayların kanıtı',
    basis: ['sözleşme', 'yasal'],
    retention: `Hesap süresince; silme talebinden ${g.deletionGraceDays} gün sonra veya ${Math.round(g.inactiveDays / 365)} yıl hareketsizlikte silinir`,
    recipients: 'E-posta sağlayıcısı (SMTP)',
  },
  {
    category: 'Profil',
    tables: ['Profile', 'Photo'],
    data: 'Görünen ad, doğum tarihi, cinsiyet, biyografi, şehir, ilgi alanları, sorular, boy, meslek, eğitim, burç, alışkanlıklar, fotoğraflar',
    purpose: 'Tanışma hizmetinin sunulması',
    basis: ['sözleşme'],
    retention: 'Hesap süresince; kullanıcı istediği an değiştirebilir',
    recipients: 'Diğer kullanıcılar (profilde görünen kısmı)',
  },
  {
    category: 'Cinsel yönelim',
    tables: ['Profile'],
    data: 'Kimi görmek istediği (interestedIn) ve cinsiyetle birlikte çıkarılabilen yönelim',
    purpose: 'Eşleştirme',
    basis: ['rıza'],
    retention: 'Hesap süresince; rıza geri alınınca eşleştirmede kullanılmaz',
    recipients: 'Aktarılmaz',
    special: true,
  },
  {
    category: 'Konum',
    tables: ['Profile'],
    data: 'Yaklaşık konum (~1 km yuvarlanmış), mesafe filtresi',
    purpose: 'Yakındaki kişileri gösterme',
    basis: ['sözleşme'],
    retention: 'Hesap süresince; en son konum saklanır, geçmiş tutulmaz',
    recipients: 'Diğer kullanıcılar (sadece yuvarlanmış mesafe)',
  },
  {
    category: 'Etkileşim',
    tables: ['Swipe', 'Block', 'Conversation', 'ContactRequest'],
    data: 'Beğeni/geçme, engellemeler, eşleşmeler, mesaj istekleri',
    purpose: 'Eşleşme ve iletişim hizmeti, güvenlik',
    basis: ['sözleşme', 'meşru'],
    retention: 'Hesap süresince',
    recipients: 'Aktarılmaz',
  },
  {
    category: 'Mesajlar',
    tables: ['Message'],
    data: 'Mesaj metni, tek seferlik fotoğraf, okunma zamanı',
    purpose: 'İletişim hizmeti',
    basis: ['sözleşme'],
    retention: `Hesap süresince; tek seferlik fotoğraf ilk açılışta, açılmazsa ${g.unopenedViewOnceDays} günde silinir`,
    recipients: 'Karşı taraf',
  },
  {
    category: 'Sesli ve görüntülü arama',
    tables: ['Call', 'CallGift', 'CallDispute'],
    data: 'Arama zamanı, süresi, ücreti, hediyeler, puanlama, ücret itirazları ve incelemesi (ses/görüntü kaydedilmez)',
    purpose: 'Arama hizmeti, ücretlendirme ve itiraz incelemesi',
    basis: ['sözleşme', 'yasal'],
    retention: 'Hesap süresince (finansal kayıtlar yasal süre boyunca)',
    recipients: 'Agora (yurt dışı: ses/görüntü aktarımı, sadece rıza verenler)',
  },
  {
    category: 'Finans',
    tables: ['Wallet', 'WalletEntry', 'Purchase', 'Payout'],
    data: 'Jeton bakiyesi ve hareketleri, satın almalar, para çekme talepleri, IBAN/PayPal (şifreli)',
    purpose: 'Ödeme, muhasebe ve vergi yükümlülükleri, dolandırıcılık önleme',
    basis: ['sözleşme', 'yasal'],
    retention: 'Hesap süresince; ödenmiş para çekme ve satış kayıtları hesap silinse de 10 yıl (VUK/TTK)',
    recipients: 'App Store / Google Play ve RevenueCat (yurt dışı, ödeme); banka / PayPal (para çekme)',
  },
  {
    category: 'Kimlik doğrulama (para çekme)',
    tables: ['KycSubmission'],
    data: 'Ad-soyad, TC kimlik no, kimlik belgesi fotoğrafı (hepsi şifreli); TC tekilliği için anahtarlı özet',
    purpose: 'Kazanç ödemesinin doğru kişiye yapılması, dolandırıcılık ve kara paranın önlenmesi, vergi yükümlülükleri',
    basis: ['sözleşme', 'yasal'],
    // Açık soru (Faz 17, muhasebeci/avukat): ödeme yapılan kişinin TC'si hesap silindikten sonra da saklanmalı mı?
    retention: 'Reddedilen başvurunun belgesi hemen silinir; onaylanan başvuru hesap süresince. Hesap silinince silinir; ödenmiş ödemelerde alıcı adı ödeme kaydında kalır',
    recipients: 'Yetkili makamlar (yasal talep hâlinde)',
  },
  {
    category: 'Ekonomi ayarları (kişisel veri değil)',
    tables: ['FinanceSettings', 'CoinPack'],
    data: 'Paket fiyatları, kurlar, oranlar, son değiştiren yönetici',
    purpose: 'Fiyatlandırma ve ödeme hesapları',
    basis: ['meşru'],
    retention: 'Süresiz (değişiklikler işlem kaydında)',
    recipients: 'Aktarılmaz',
  },
  {
    category: 'Profil doğrulama (selfie)',
    tables: ['VerificationRequest'],
    data: 'Belirli pozla çekilen selfie, inceleme sonucu',
    purpose: 'Sahte profili önleme (mavi tik)',
    basis: ['rıza'],
    retention: 'İnceleme sonrası kanıt olarak saklanır; rıza geri alınınca silinir',
    recipients: 'Aktarılmaz (sadece yetkili yönetici görür)',
    special: true,
  },
  {
    category: 'Güvenlik ve işlem güvenliği',
    tables: ['Session', 'EmailCode', 'RateLimitHit', 'IdempotencyKey', 'Device'],
    data: 'Oturumlar (cihaz adı, IP), e-posta kodları (özet), deneme sayaçları, bildirim cihaz jetonları',
    purpose: 'Hesap güvenliği, kötüye kullanımı önleme, bildirim',
    basis: ['sözleşme', 'meşru'],
    retention: `Kapanan oturum ${g.closedSessionDays} gün, e-posta kodu ${g.emailCodeDays} gün, sayaçlar ve tekrar koruması 1 güne kadar`,
    recipients: 'Firebase (yurt dışı: bildirim, sadece rıza verenler)',
  },
  {
    category: 'Şikayet ve moderasyon',
    tables: ['Report'],
    data: 'Şikayet eden, şikayet edilen, sebep, açıklama, sonuç',
    purpose: 'Topluluk güvenliği, hukuki taleplerin karşılanması',
    basis: ['meşru', 'hak', 'yasal'],
    retention: 'Hesap süresince',
    recipients: 'Yetkili kurumlar (resmi talep hâlinde)',
  },
  {
    category: 'Trafik bilgisi (5651)',
    tables: ['TrafficLog', 'TrafficBatch'],
    data: 'Kaynak IP, port, zaman, kullanıcı kimliği, işlem (içerik oluşturan istekler ve bağlantılar)',
    purpose: '5651 sayılı Kanun kapsamında yer sağlayıcı yükümlülüğü, resmi taleplerin karşılanması',
    basis: ['yasal'],
    retention: `${Math.round(g.trafficLogDays / 365)} yıl; hesap silinse de saklanır, bütünlüğü hash zinciriyle korunur`,
    recipients: 'Yetkili adli ve idari makamlar (talep hâlinde)',
  },
  {
    category: 'Moderasyon',
    tables: ['Sanction', 'Appeal', 'ModerationFlag', 'LegalRequest'],
    data: 'Yaptırımlar ve gerekçeleri, itirazlar, otomatik güvenlik işaretleri, resmi talepler ve yapılan işlemler',
    purpose: 'Topluluk güvenliği, dolandırıcılık ve kötüye kullanımın önlenmesi, resmi taleplerin karşılanması',
    basis: ['meşru', 'yasal', 'hak'],
    retention: 'Hesap süresince; resmi talep kayıtları yasal süre boyunca',
    recipients: 'Yetkili makamlar (resmi talep hâlinde)',
  },
  {
    category: 'Hata kayıtları',
    tables: ['ErrorLog'],
    data: 'Hata mesajı, ekran, uygulama sürümü (kişisel veri içermemeye çalışılır)',
    purpose: 'Hizmetin çalışır tutulması',
    basis: ['meşru'],
    retention: `Çözülen kayıtlar ${g.resolvedErrorDays} gün`,
    recipients: 'Aktarılmaz',
  },
  {
    category: 'KVKK süreç kayıtları',
    tables: ['Consent', 'DataExport', 'DsrRequest', 'DestructionLog', 'BreachRecord'],
    data: 'Rıza verme/geri alma geçmişi, veri indirme talepleri, başvurular ve yanıtları, imha ve ihlal kayıtları',
    purpose: 'KVKK yükümlülüklerinin yerine getirildiğinin kanıtı',
    basis: ['yasal'],
    retention: `İndirme dosyası ${g.exportTtlDays} gün veya ilk indirmede silinir; kayıtlar yasal süre boyunca`,
    recipients: 'Kişisel Verileri Koruma Kurulu (talep hâlinde)',
  },
  {
    category: 'Yönetim işlem kaydı',
    tables: ['AdminAudit'],
    data: 'Yönetici e-postası, işlem, hedef kayıt, IP',
    purpose: 'Yetkisiz erişimin önlenmesi ve denetim',
    basis: ['yasal', 'meşru'],
    retention: 'Değiştirilemez; yasal süre boyunca',
    recipients: 'Aktarılmaz',
  },
  {
    category: 'Destek talepleri',
    tables: ['SupportTicket', 'SupportMessage'],
    data: 'Talep kategorisi, konu, yazışmalar, isteğe bağlı ekran görüntüsü (konum bilgisi silinmiş), ilgili işlem, cihaz türü ve uygulama sürümü',
    purpose: 'Müşteri desteği, tüketici şikayetlerinin çözümü ve kanıtı',
    basis: ['sözleşme', 'yasal', 'hak'],
    retention: `Hesapla birlikte silinir; kapanan talepler ${Math.round(g.supportClosedDays / 365)} yıl sonra silinir`,
    recipients: 'E-posta sağlayıcısı (yanıt bildirimi)',
  },
  {
    category: 'Yardım merkezi ve künye (kişisel veri değil)',
    tables: ['HelpArticle', 'CompanyInfo'],
    data: 'Sık sorulan sorular, şirket bilgileri, son değiştiren yönetici',
    purpose: 'Bilgilendirme ve yasal künye yükümlülüğü',
    basis: ['yasal', 'meşru'],
    retention: 'Süresiz (değişiklikler işlem kaydında)',
    recipients: 'Herkese açık',
  },
  {
    category: 'Teknik (kişisel veri değil)',
    tables: ['SocketIoAttachment'],
    data: 'Sunucular arası anlık olay aktarımı (geçici)',
    purpose: 'Çok sunuculu çalışma',
    basis: ['meşru'],
    retention: 'Dakikalar içinde silinir',
    recipients: 'Aktarılmaz',
  },
];

export function inventoryMarkdown() {
  const lines = [
    '# Kişisel veri envanteri',
    '',
    '> Bu belge `server/src/privacy/inventory.ts` dosyasından üretilir (`npm run kvkk:inventory`). Elle düzenleme.',
    '> Hukuki sebepler ve süreler avukat görüşüyle kesinleşecek (Faz 17).',
    '',
    '| Kategori | Veriler | Amaç | Hukuki sebep | Saklama | Aktarım | Tablolar |',
    '|---|---|---|---|---|---|---|',
    ...INVENTORY.map(
      (e) =>
        `| ${e.special ? '**' + e.category + '** (özel nitelikli)' : e.category} | ${e.data} | ${e.purpose} | ${e.basis.join(', ')} | ${e.retention} | ${e.recipients} | ${e.tables.join(', ')} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
