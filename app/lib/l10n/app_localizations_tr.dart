// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Turkish (`tr`).
class AppLocalizationsTr extends AppLocalizations {
  AppLocalizationsTr([String locale = 'tr']) : super(locale);

  @override
  String get appName => 'MeetPoint';

  @override
  String get tagline => 'Tanış, konuş, kazan.';

  @override
  String get loginTitle => 'Tekrar hoş geldin';

  @override
  String get registerTitle => 'Hesap oluştur';

  @override
  String get email => 'E-posta';

  @override
  String get password => 'Şifre';

  @override
  String get passwordHint => 'En az 8 karakter';

  @override
  String get login => 'Giriş yap';

  @override
  String get register => 'Kayıt ol';

  @override
  String get noAccount => 'Hesabın yok mu? Kayıt ol';

  @override
  String get haveAccount => 'Zaten hesabın var mı? Giriş yap';

  @override
  String get setupTitle => 'Profilini oluştur';

  @override
  String get editProfile => 'Profili düzenle';

  @override
  String get photos => 'Fotoğraflar';

  @override
  String photosHint(int max) {
    return 'En az 1, en fazla $max fotoğraf. İlk fotoğraf kapak fotoğrafın olur.';
  }

  @override
  String get displayName => 'Görünen ad';

  @override
  String get birthDate => 'Doğum tarihi';

  @override
  String get selectDate => 'Tarih seç';

  @override
  String get gender => 'Cinsiyet';

  @override
  String get male => 'Erkek';

  @override
  String get female => 'Kadın';

  @override
  String get other => 'Diğer';

  @override
  String get interestedIn => 'İlgilendiğin';

  @override
  String get men => 'Erkekler';

  @override
  String get women => 'Kadınlar';

  @override
  String get everyone => 'Herkes';

  @override
  String get bio => 'Hakkımda';

  @override
  String get city => 'Şehir';

  @override
  String get country => 'Ülke';

  @override
  String get save => 'Kaydet';

  @override
  String get continueLabel => 'Devam et';

  @override
  String get requiredField => 'Bu alan zorunlu';

  @override
  String get photoRequired => 'En az bir fotoğraf ekle';

  @override
  String get saved => 'Kaydedildi';

  @override
  String get navDiscover => 'Keşfet';

  @override
  String get navRequests => 'İstekler';

  @override
  String get navChats => 'Sohbetler';

  @override
  String get navWallet => 'Cüzdan';

  @override
  String get navProfile => 'Profil';

  @override
  String get noMoreProfiles => 'Şimdilik gösterilecek yeni kimse yok';

  @override
  String get refresh => 'Yenile';

  @override
  String get itsAMatch => 'Eşleştiniz!';

  @override
  String matchBody(String name) {
    return '$name ile eşleştin. Artık ücretsiz mesajlaşabilirsiniz.';
  }

  @override
  String get sendMessage => 'Mesaj gönder';

  @override
  String get keepSwiping => 'Keşfetmeye devam';

  @override
  String get messageRequest => 'Mesaj isteği';

  @override
  String get voiceCall => 'Sesli arama';

  @override
  String get videoCall => 'Görüntülü arama';

  @override
  String coins(int count) {
    return '$count jeton';
  }

  @override
  String requestDialogTitle(String name) {
    return '$name kişisine mesaj isteği';
  }

  @override
  String get requestDialogHint => 'İlk mesajını yaz...';

  @override
  String requestCostInfo(int price) {
    return '$price jeton bloke edilir. Kabul edilirse karşı tarafa geçer; reddedilir ya da 24 saat içinde cevaplanmazsa sana iade edilir.';
  }

  @override
  String confirmRequestTitle(String kind) {
    return '$kind isteği gönderilsin mi?';
  }

  @override
  String get send => 'Gönder';

  @override
  String get cancel => 'Vazgeç';

  @override
  String get requestSent => 'İstek gönderildi';

  @override
  String get topUp => 'Jeton yükle';

  @override
  String get inbox => 'Gelen';

  @override
  String get outbox => 'Giden';

  @override
  String get noRequests => 'Henüz istek yok';

  @override
  String get accept => 'Kabul et';

  @override
  String get reject => 'Reddet';

  @override
  String get cancelRequest => 'Geri çek';

  @override
  String get statusPending => 'Bekliyor';

  @override
  String get statusAccepted => 'Kabul edildi';

  @override
  String get statusRejected => 'Reddedildi';

  @override
  String get statusCancelled => 'Geri çekildi';

  @override
  String get statusExpired => 'Süresi doldu';

  @override
  String expiresIn(int hours) {
    return '$hours sa içinde düşer';
  }

  @override
  String earnOnAccept(int price) {
    return 'Kabul edersen +$price jeton kazanırsın';
  }

  @override
  String get callComingSoon =>
      'Arama özelliği yakında geliyor. Jetonlar bakiyene eklendi.';

  @override
  String get noChats =>
      'Henüz sohbet yok. Keşfet\'te birini beğen ya da mesaj isteği gönder.';

  @override
  String get typeMessage => 'Mesaj yaz...';

  @override
  String get sendFailedRetry => 'Gönderilemedi, tekrar denemek için dokun';

  @override
  String get matchedChat => 'Eşleşme';

  @override
  String get requestChat => 'Mesaj isteği';

  @override
  String get balance => 'Bakiye';

  @override
  String get cashable => 'Bozdurulabilir';

  @override
  String get cashableInfo =>
      'Satın alınmış jetonlarla sana ödenen kazançlar paraya çevrilebilir.';

  @override
  String get cashout => 'Paraya çevir';

  @override
  String get comingSoon => 'Yakında';

  @override
  String get buyCoins => 'Jeton satın al';

  @override
  String get testModeNote =>
      'Test modu: ödeme alınmaz, jetonlar anında eklenir.';

  @override
  String get history => 'Hareketler';

  @override
  String get noHistory => 'Henüz hareket yok';

  @override
  String get txPurchase => 'Jeton satın alımı';

  @override
  String get txHold => 'İstek için bloke';

  @override
  String get txRefund => 'İade';

  @override
  String get txEarn => 'Kazanç';

  @override
  String get txSpend => 'Harcama';

  @override
  String get txCashout => 'Paraya çevirme';

  @override
  String get txGrant => 'Hediye';

  @override
  String coinsAdded(int count) {
    return '$count jeton eklendi';
  }

  @override
  String get language => 'Dil';

  @override
  String get logout => 'Çıkış yap';

  @override
  String get block => 'Engelle';

  @override
  String get report => 'Şikayet et';

  @override
  String blockConfirm(String name) {
    return '$name engellensin mi? Seni göremez ve sana ulaşamaz.';
  }

  @override
  String get blocked => 'Engellendi';

  @override
  String get reportTitle => 'Şikayet sebebi';

  @override
  String get reportFake => 'Sahte profil';

  @override
  String get reportInappropriate => 'Uygunsuz içerik';

  @override
  String get reportHarassment => 'Taciz';

  @override
  String get reportScam => 'Dolandırıcılık';

  @override
  String get reportUnderage => '18 yaş altı';

  @override
  String get reportOther => 'Diğer';

  @override
  String get reportSent => 'Şikayetin alındı, teşekkürler.';

  @override
  String get errGeneric => 'Bir şeyler ters gitti. Tekrar dene.';

  @override
  String get errNetwork => 'Sunucuya ulaşılamadı.';

  @override
  String get errInvalidCredentials => 'E-posta veya şifre hatalı.';

  @override
  String get errEmailTaken => 'Bu e-posta zaten kayıtlı.';

  @override
  String get errUnderage =>
      'MeetPoint\'i kullanmak için 18 yaşından büyük olmalısın.';

  @override
  String get errInsufficientBalance => 'Yeterli jetonun yok.';

  @override
  String get errAlreadyPending => 'Bu kişiye zaten bekleyen bir isteğin var.';

  @override
  String get errAlreadyInConversation => 'Bu kişiyle zaten sohbetin var.';

  @override
  String get errTooManyPhotos => 'En fazla 6 fotoğraf ekleyebilirsin.';

  @override
  String get errValidation => 'Lütfen bilgileri kontrol et.';

  @override
  String get errExpired => 'Bu isteğin süresi dolmuş.';

  @override
  String get errNotPending => 'Bu istek artık geçerli değil.';

  @override
  String get errBlocked => 'Bu kişiyle artık mesajlaşamazsın.';

  @override
  String interestLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'coffee': 'Kahve',
      'travel': 'Seyahat',
      'music': 'Müzik',
      'concerts': 'Konserler',
      'movies': 'Sinema',
      'series': 'Diziler',
      'books': 'Kitaplar',
      'photography': 'Fotoğrafçılık',
      'art': 'Sanat',
      'cooking': 'Yemek yapmak',
      'foodie': 'Gurme',
      'wine': 'Şarap',
      'fitness': 'Fitness',
      'yoga': 'Yoga',
      'running': 'Koşu',
      'cycling': 'Bisiklet',
      'hiking': 'Doğa yürüyüşü',
      'camping': 'Kamp',
      'football': 'Futbol',
      'basketball': 'Basketbol',
      'gaming': 'Oyun',
      'tech': 'Teknoloji',
      'fashion': 'Moda',
      'dancing': 'Dans',
      'pets': 'Evcil hayvanlar',
      'nature': 'Doğa',
      'beach': 'Plaj',
      'meditation': 'Meditasyon',
      'anime': 'Anime',
      'volunteering': 'Gönüllülük',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String promptQuestion(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'perfect_sunday': 'Mükemmel bir pazar günüm...',
      'laugh': 'Beni en çok güldüren şey...',
      'green_flag': 'Birinde aradığım yeşil bayrak...',
      'travel_dream': 'Hayalimdeki seyahat...',
      'unpopular_opinion': 'Popüler olmayan bir fikrim...',
      'simple_pleasures': 'Basit mutluluklarım...',
      'looking_for': 'Aradığım kişi...',
      'two_truths': 'İki doğru, bir yalan...',
      'first_date': 'İdeal ilk buluşma...',
      'song': 'Şu an dilime dolanan şarkı...',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String lookingForLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'relationship': 'Ciddi ilişki',
      'casual': 'Eğlenceli bir şeyler',
      'friendship': 'Yeni arkadaşlar',
      'chat': 'Sadece sohbet',
      'unsure': 'Henüz emin değilim',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String educationLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'high_school': 'Lise',
      'bachelor': 'Lisans',
      'master': 'Yüksek lisans',
      'phd': 'Doktora',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String zodiacLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'aries': 'Koç',
      'taurus': 'Boğa',
      'gemini': 'İkizler',
      'cancer': 'Yengeç',
      'leo': 'Aslan',
      'virgo': 'Başak',
      'libra': 'Terazi',
      'scorpio': 'Akrep',
      'sagittarius': 'Yay',
      'capricorn': 'Oğlak',
      'aquarius': 'Kova',
      'pisces': 'Balık',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String habitLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'no': 'Hayır',
      'sometimes': 'Bazen',
      'yes': 'Evet',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String get obNameTitle => 'Adın ne?';

  @override
  String get obNameHint => 'Profilinde bu isim görünecek.';

  @override
  String get obBirthTitle => 'Doğum tarihin ne?';

  @override
  String get obBirthHint => 'Profilinde sadece yaşın görünür.';

  @override
  String obAgeLabel(int age) {
    return '$age yaşındasın';
  }

  @override
  String get obGenderTitle => 'Kendini nasıl tanımlıyorsun?';

  @override
  String get obInterestedTitle => 'Kimlerle tanışmak istiyorsun?';

  @override
  String get obPhotosTitle => 'Fotoğraflarını ekle';

  @override
  String get obPhotosHint =>
      'En az 1 fotoğraf gerekli. 3 ve üzeri fotoğrafı olan profiller daha çok eşleşiyor.';

  @override
  String get obInterestsTitle => 'Nelerden hoşlanırsın?';

  @override
  String obInterestsHint(int min, int max) {
    return '$min ile $max arası seç';
  }

  @override
  String get obLookingTitle => 'Burada ne arıyorsun?';

  @override
  String get obPromptsTitle => 'Kendinden bahset';

  @override
  String get obPromptsHint =>
      'En fazla 3 soru seçip cevapla. Sohbet başlatmanın en kolay yolu.';

  @override
  String get obBasicsTitle => 'Biraz daha detay';

  @override
  String get obBasicsHint =>
      'Hepsi isteğe bağlı, istediğin zaman değiştirebilirsin.';

  @override
  String get skip => 'Atla';

  @override
  String get finish => 'Profilimi oluştur';

  @override
  String get addPrompt => 'Soru ekle';

  @override
  String get choosePrompt => 'Bir soru seç';

  @override
  String get yourAnswer => 'Cevabın';

  @override
  String get height => 'Boy';

  @override
  String heightCm(int cm) {
    return '$cm cm';
  }

  @override
  String get job => 'Meslek';

  @override
  String get education => 'Eğitim';

  @override
  String get zodiac => 'Burç';

  @override
  String get smoking => 'Sigara';

  @override
  String get drinking => 'Alkol';

  @override
  String get lookingFor => 'Aradığı';

  @override
  String get interests => 'İlgi alanları';

  @override
  String get prompts => 'Sorular';

  @override
  String get basics => 'Temel bilgiler';

  @override
  String get notSpecified => 'Belirtilmedi';

  @override
  String get makeCover => 'Kapak fotoğrafı yap';

  @override
  String get deletePhoto => 'Fotoğrafı sil';

  @override
  String get cover => 'Kapak';

  @override
  String get edit => 'Düzenle';

  @override
  String get personalInfo => 'Kişisel bilgiler';

  @override
  String profileCompletion(int percent) {
    return 'Profilin %$percent tamamlandı';
  }

  @override
  String commonInterests(int count) {
    return '$count ortak ilgi alanı';
  }

  @override
  String stepOf(int step, int total) {
    return '$step/$total';
  }

  @override
  String get clear => 'Temizle';

  @override
  String get previewProfile => 'Profilimi önizle';

  @override
  String get viewProfile => 'Profili gör';

  @override
  String get done => 'Tamam';

  @override
  String get forgotPassword => 'Şifremi unuttum';

  @override
  String get resetTitle => 'Şifreni sıfırla';

  @override
  String get resetHint => 'E-posta adresine 6 haneli bir kod göndereceğiz.';

  @override
  String get sendCode => 'Kod gönder';

  @override
  String codeSentTo(String email) {
    return '$email adresine 6 haneli bir kod gönderdik.';
  }

  @override
  String get newPassword => 'Yeni şifre';

  @override
  String get resetDone => 'Şifren güncellendi';

  @override
  String get verifyEmailTitle => 'E-postanı doğrula';

  @override
  String get code => 'Kod';

  @override
  String get verify => 'Doğrula';

  @override
  String get resendCode => 'Kodu tekrar gönder';

  @override
  String resendIn(int seconds) {
    return '$seconds sn sonra tekrar gönderebilirsin';
  }

  @override
  String get codeResent => 'Yeni kod gönderildi';

  @override
  String get useAnotherAccount => 'Başka hesapla giriş yap';

  @override
  String get termsOfService => 'Kullanım Koşulları';

  @override
  String get privacyPolicy => 'Gizlilik Politikası';

  @override
  String termsConsent(String terms, String privacy) {
    return '18 yaşından büyüğüm; $terms ve $privacy metinlerini okudum, kabul ediyorum.';
  }

  @override
  String get mustAcceptTerms => 'Devam etmek için koşulları kabul etmelisin.';

  @override
  String get deleteAccount => 'Hesabı sil';

  @override
  String get deleteAccountWarning =>
      'Hesabın hemen gizlenir ve oturumların kapanır. 30 gün içinde giriş yaparsan hesabın geri gelir; sonra profilin, fotoğrafların, eşleşmelerin, mesajların ve jeton bakiyen kalıcı olarak silinir.';

  @override
  String get confirmWithPassword => 'Onaylamak için şifreni gir';

  @override
  String get accountDeleted =>
      'Hesabın silinmek üzere kapatıldı. 30 gün içinde giriş yaparsan geri gelir.';

  @override
  String get legal => 'Yasal';

  @override
  String get verifyProfile => 'Profilini doğrula';

  @override
  String get verifyProfileHint =>
      'Mavi tik al, daha çok güven ve eşleşme kazan.';

  @override
  String get verifiedLabel => 'Doğrulanmış profil';

  @override
  String get verificationPendingLabel => 'Doğrulama inceleniyor';

  @override
  String get verificationRejectedLabel => 'Doğrulama onaylanmadı, tekrar dene';

  @override
  String get verifyTitle => 'Mavi tik al';

  @override
  String get verifyStep =>
      'Aşağıdaki pozu yaparak bir selfie çek. Selfie\'n sadece doğrulama ekibimiz tarafından görülür, profilinde yayınlanmaz.';

  @override
  String get takeSelfie => 'Selfie çek';

  @override
  String get retake => 'Yeniden çek';

  @override
  String get verificationSubmitted =>
      'Başvurun alındı. Genellikle 24 saat içinde incelenir.';

  @override
  String poseLabel(String id) {
    String _temp0 = intl.Intl.selectLogic(id, {
      'peace_sign': '✌️ Barış işareti yap',
      'thumbs_up': '👍 Başparmağını kaldır',
      'hand_on_head': '🙋 Elini başına koy',
      'point_up': '☝️ Yukarıyı göster',
      'wave': '👋 El salla',
      'other': '$id',
    });
    return '$_temp0';
  }

  @override
  String get errCodeInvalid => 'Kod hatalı.';

  @override
  String get errCodeExpired =>
      'Kodun süresi doldu ya da çok fazla deneme yapıldı. Yeni kod iste.';

  @override
  String get errCodeCooldown => 'Yeni kod istemeden önce biraz bekle.';

  @override
  String get errRateLimited =>
      'Çok hızlı gidiyorsun, biraz bekleyip tekrar dene.';

  @override
  String get errBanned =>
      'Hesabın topluluk kurallarını ihlal ettiği için askıya alındı.';

  @override
  String get errAlreadyVerified => 'Profilin zaten doğrulanmış.';

  @override
  String get errVerificationPending => 'Başvurun zaten inceleniyor.';

  @override
  String kmAway(int km) {
    return '$km km uzakta';
  }

  @override
  String get filters => 'Filtreler';

  @override
  String get ageRange => 'Yaş aralığı';

  @override
  String get maxDistance => 'En fazla uzaklık';

  @override
  String get anyDistance => 'Fark etmez';

  @override
  String get apply => 'Uygula';

  @override
  String get locationRationale =>
      'Yakınındaki kişileri gösterebilmemiz için konumuna ihtiyacımız var. Tam konumun kimseyle paylaşılmaz, sadece yaklaşık mesafe görünür.';

  @override
  String get enableLocation => 'Konumu aç';

  @override
  String get superLike => 'Süper beğeni';

  @override
  String get superLikeSent => 'Süper beğeni gönderildi ⭐';

  @override
  String get superLikedYou => 'Seni süper beğendi';

  @override
  String get boost => 'Öne çıkar';

  @override
  String get boostTitle => 'Profilini öne çıkar';

  @override
  String boostBody(int minutes) {
    return '$minutes dakika boyunca keşfette en üstte gösterilirsin. Daha çok kişi seni görür.';
  }

  @override
  String boostActive(int minutes) {
    return '$minutes dk';
  }

  @override
  String get likesYou => 'Seni beğenenler';

  @override
  String likesYouCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count kişi seni beğendi',
      one: '1 kişi seni beğendi',
      zero: 'Henüz kimse seni beğenmedi',
    );
    return '$_temp0';
  }

  @override
  String likesLockedBody(int hours) {
    return 'Seni kimlerin beğendiğini gör, beğenirsen anında eşleş. $hours saat boyunca açık kalır.';
  }

  @override
  String get seeWhoLikes => 'Kimler olduğunu gör';

  @override
  String get noLikesYet =>
      'Henüz seni beğenen yok. Profilini tamamla ya da öne çıkar!';

  @override
  String get typing => 'yazıyor...';

  @override
  String get photo => 'Fotoğraf';

  @override
  String get viewOncePhoto => 'Tek seferlik fotoğraf';

  @override
  String get tapToView => 'Görmek için dokun';

  @override
  String get photoOpened => 'Açıldı';

  @override
  String get photoSent => 'Gönderildi';

  @override
  String get viewOnceHint => 'Fotoğraf bir kez açılabilir, sonra silinir.';

  @override
  String get sendPhoto => 'Fotoğraf gönder';

  @override
  String newMessageFrom(String name, String text) {
    return '$name: $text';
  }

  @override
  String newMatchWith(String name) {
    return 'Yeni eşleşme: $name 💞';
  }

  @override
  String get newRequestBanner => 'Yeni bir istek aldın';

  @override
  String get view => 'Gör';

  @override
  String get errAlreadyBoosted => 'Profilin zaten öne çıkarılmış.';

  @override
  String get errAlreadyViewed => 'Bu fotoğraf zaten açıldı.';

  @override
  String get mostPopular => 'En popüler';

  @override
  String firstPurchaseBanner(int pct) {
    return 'İlk alımına %$pct bonus jeton!';
  }

  @override
  String bonusCoins(int count) {
    return '+$count bonus';
  }

  @override
  String get paymentProcessing => 'Ödemen işleniyor...';

  @override
  String purchaseDone(int count) {
    return '$count jeton hesabına eklendi 🎉';
  }

  @override
  String get txBonus => 'İlk alım bonusu';

  @override
  String get txClawback => 'İade (jeton geri alındı)';

  @override
  String get errStoreUnavailable =>
      'Mağazaya şu an ulaşılamıyor. Biraz sonra tekrar dene.';

  @override
  String perMinute(int count) {
    return '$count/dk';
  }

  @override
  String startCallTitle(String kind) {
    return '$kind başlatılsın mı?';
  }

  @override
  String startCallInfo(int rate) {
    return 'Dakika başı $rate jeton. İlk dakika karşı taraf açınca düşer, bakiyen bitince arama kendiliğinden sonlanır.';
  }

  @override
  String get callAction => 'Ara';

  @override
  String get calling => 'Aranıyor…';

  @override
  String get isCallingYou => 'seni arıyor';

  @override
  String earnPerMinute(int rate) {
    return 'Dakika başı $rate jeton kazanırsın';
  }

  @override
  String get answer => 'Aç';

  @override
  String get decline => 'Reddet';

  @override
  String spentCoins(int count) {
    return 'Harcanan: $count';
  }

  @override
  String earnedCoins(int count) {
    return 'Kazanılan: $count';
  }

  @override
  String get lowBalanceWarning =>
      'Bakiyen bir sonraki dakikaya yetmiyor, arama bu dakikanın sonunda bitecek.';

  @override
  String get weakConnectionWarning =>
      'Bağlantın zayıf, ses veya görüntü kesilebilir.';

  @override
  String get videoBlurred => 'Güvenliğin için görüntü bulanık başlar';

  @override
  String get revealVideo => 'Görüntüyü aç';

  @override
  String get waitingVideo => 'Görüntü bekleniyor…';

  @override
  String get simulationMode => 'Test modu';

  @override
  String get mute => 'Sessiz';

  @override
  String get camera => 'Kamera';

  @override
  String get flipCamera => 'Çevir';

  @override
  String get speaker => 'Hoparlör';

  @override
  String get gift => 'Hediye';

  @override
  String get endCall => 'Bitir';

  @override
  String get sendGiftTitle => 'Hediye gönder';

  @override
  String get giftInfo => 'Jetonların tamamı karşı tarafa geçer.';

  @override
  String giftReceived(String emoji, int count) {
    return '$emoji hediye aldın! +$count jeton';
  }

  @override
  String giftSent(String emoji) {
    return '$emoji gönderildi';
  }

  @override
  String get callEnded => 'Arama bitti';

  @override
  String get callEndedBalance => 'Bakiye bittiği için arama sona erdi.';

  @override
  String get callEndedDisconnect => 'Bağlantı koptuğu için arama sona erdi.';

  @override
  String get callEndedConnectFailed => 'Bağlantı kurulamadı, ücret alınmadı.';

  @override
  String get callMissed => 'Cevapsız arama';

  @override
  String get callNoAnswer => 'Cevap yok';

  @override
  String get callDeclined => 'Arama reddedildi';

  @override
  String get callCancelled => 'Arama iptal edildi';

  @override
  String get rateCallTitle => 'Görüşme nasıldı?';

  @override
  String get reportProblem => 'Sorun mu vardı? Bildir';

  @override
  String get callHistory => 'Aramalar';

  @override
  String get noCallsYet =>
      'Henüz arama yok. Bir profilden sesli ya da görüntülü arama başlatabilirsin.';

  @override
  String get callBack => 'Geri ara';

  @override
  String missedCallFrom(String name) {
    return 'Cevapsız arama: $name';
  }

  @override
  String get errBusy => 'Şu an başka bir görüşmede, biraz sonra tekrar dene.';

  @override
  String get errAlreadyInCall => 'Zaten bir görüşmedesin.';

  @override
  String get errCallGone => 'Bu arama artık geçerli değil.';

  @override
  String get errCallerBalance =>
      'Arayanın bakiyesi yetmediği için arama başlamadı.';

  @override
  String get txCall => 'Arama';

  @override
  String get txGift => 'Hediye';

  @override
  String get cashoutAvailable => 'Çekilebilir bakiye';

  @override
  String cashoutMinInfo(int coins, String usd) {
    return 'En az $coins jeton ($usd) birikince çekebilirsin.';
  }

  @override
  String get cashoutNeedVerify =>
      'Para çekmek için profilini mavi tikle doğrulaman gerekiyor. Bu, sahte hesaplara karşı seni ve kazancını korur.';

  @override
  String get cashoutAmount => 'Tutar';

  @override
  String get cashoutMethod => 'Ödeme yöntemi';

  @override
  String get accountHolder => 'Hesap sahibinin adı soyadı';

  @override
  String get paypalEmail => 'PayPal e-postası';

  @override
  String cashoutSubmit(String usd) {
    return 'Talep gönder · $usd';
  }

  @override
  String get cashoutProcessingInfo =>
      'Ödemeler 3–5 iş günü içinde yapılır. Talep incelenirken iptal edebilirsin.';

  @override
  String get cashoutRequested => 'Talebin alındı 👍';

  @override
  String cashoutNotEnough(int coins) {
    return 'Çekilebilir bakiyen henüz $coins jetona ulaşmadı. Aramalar ve kabul ettiğin isteklerle kazanmaya devam et!';
  }

  @override
  String get payoutStatusPending => 'İnceleniyor';

  @override
  String get payoutStatusPaid => 'Ödendi';

  @override
  String get payoutStatusRejected => 'Reddedildi';

  @override
  String get payoutStatusCancelled => 'İptal edildi';

  @override
  String get payoutCancel => 'Talebi iptal et';

  @override
  String get payoutCancelled => 'Talep iptal edildi, jetonlar geri eklendi.';

  @override
  String get payoutHistory => 'Talepler';

  @override
  String payoutReason(String reason) {
    return 'Sebep: $reason';
  }

  @override
  String payoutReference(String ref) {
    return 'İşlem no: $ref';
  }

  @override
  String get errVerificationRequired =>
      'Önce profilini mavi tikle doğrulamalısın.';

  @override
  String get errBelowMinimum => 'Tutar alt sınırın altında.';

  @override
  String get errInsufficientCashable =>
      'Çekilebilir bakiyen bu tutar için yetmiyor.';

  @override
  String get errInvalidIban =>
      'IBAN geçersiz görünüyor, kontrol edip tekrar dene.';

  @override
  String get errAccountNameRequired => 'Hesap sahibinin adını yaz.';

  @override
  String get errPayoutPending => 'Zaten incelenen bir talebin var.';

  @override
  String get txCashoutRefund => 'Para çekme iadesi';

  @override
  String get errInvalidImage =>
      'Bu fotoğraf biçimi desteklenmiyor. JPG, PNG, WEBP veya HEIC seç.';

  @override
  String get errAlreadyRated => 'Bu görüşmeyi zaten puanladın.';

  @override
  String get errPayoutProcessed => 'Bu talep zaten işleme alınmış.';

  @override
  String get errNotFound =>
      'Aradığın içerik bulunamadı. Silinmiş veya artık erişilemiyor olabilir.';

  @override
  String promoEarnings(int count) {
    return 'Bonus jetonlardan kazanç: $count';
  }

  @override
  String get promoEarningsInfo =>
      'Bonus ve hediye jetonlarıyla yapılan ödemelerden gelir. Uygulamada harcayabilirsin, paraya çevrilemez.';

  @override
  String get errRequestInProgress =>
      'İsteğin hâlâ işleniyor, birkaç saniye sonra tekrar dene.';

  @override
  String get errPasswordTooCommon =>
      'Bu şifre çok yaygın ve kolay tahmin edilir. Daha güçlü bir şifre seç.';

  @override
  String get errPasswordBreached =>
      'Bu şifre bilinen bir veri sızıntısında yer alıyor. Güvenliğin için başka bir şifre seç.';

  @override
  String get errPasswordSame => 'Yeni şifre mevcut şifrenle aynı olamaz.';

  @override
  String get errAccountLocked =>
      'Çok fazla hatalı deneme yapıldı. Güvenliğin için 15 dakika sonra tekrar dene.';

  @override
  String get errTooManyAccounts =>
      'Bu cihazdan kısa sürede çok fazla hesap açıldı.';

  @override
  String get errCaptcha => 'Güvenlik doğrulaması tamamlanamadı. Tekrar dene.';

  @override
  String get devicesTitle => 'Cihazlarım';

  @override
  String get devicesSubtitle =>
      'Hesabının açık olduğu cihazlar. Tanımadığın bir cihaz görürsen oturumunu kapat ve şifreni değiştir.';

  @override
  String get thisDevice => 'Bu cihaz';

  @override
  String lastActive(String time) {
    return 'Son etkinlik: $time';
  }

  @override
  String get signOutDevice => 'Çıkış yaptır';

  @override
  String get signOutOthers => 'Diğer tüm cihazlardan çıkış yap';

  @override
  String get signOutOthersConfirm =>
      'Bu cihaz dışındaki tüm oturumların kapatılacak.';

  @override
  String get deviceSignedOut => 'Cihazın oturumu kapatıldı';

  @override
  String get othersSignedOut => 'Diğer cihazlardan çıkış yapıldı';

  @override
  String get changePassword => 'Şifre değiştir';

  @override
  String get currentPassword => 'Mevcut şifre';

  @override
  String get changePasswordNote =>
      'Şifren değişince bu cihaz dışındaki tüm oturumların kapanır.';

  @override
  String get passwordChanged =>
      'Şifren değiştirildi, diğer cihazlardan çıkış yapıldı.';

  @override
  String get accountRestored =>
      'Hesabın geri yüklendi, silme talebin iptal edildi.';

  @override
  String get privacyAndData => 'Gizlilik ve verilerim';

  @override
  String get myConsents => 'Açık rızalarım';

  @override
  String get myData => 'Verilerim';

  @override
  String get legalTexts => 'Metinler';

  @override
  String get retentionPolicy => 'Saklama ve imha politikası';

  @override
  String get readConsentText => 'Metni oku';

  @override
  String get giveConsent => 'Rıza veriyorum';

  @override
  String get notNow => 'Şimdi değil';

  @override
  String get consentSpecialTitle => 'Eşleştirme için yönelim bilgisi';

  @override
  String get consentSpecialText =>
      'Kimi görmek istediğin, sana uygun kişileri göstermek için kullanılır.';

  @override
  String get consentSpecialAsk =>
      'Kimi görmek istediğin özel nitelikli bir veridir; eşleştirme için açık rızan gerekir.';

  @override
  String get consentSpecialOnboarding =>
      'Kimi görmek istediğim bilgisinin (cinsel yönelim) eşleştirme için işlenmesine açık rıza veriyorum.';

  @override
  String get consentOverseasTitle => 'Arama ve bildirimler';

  @override
  String get consentOverseasText =>
      'Sesli/görüntülü arama ve telefon bildirimleri yurt dışındaki sunuculardan geçer.';

  @override
  String get consentOverseasAsk =>
      'Aramalar yurt dışındaki bir hizmet (Agora) üzerinden yapılır. Arama yapıp alabilmen için bu aktarıma açık rızan gerekir. Ses ve görüntü kaydedilmez.';

  @override
  String get consentOverseasRegister =>
      'Sesli/görüntülü arama ve bildirimler için verilerimin yurt dışına aktarılmasına açık rıza veriyorum (isteğe bağlı).';

  @override
  String get consentSelfieTitle => 'Mavi tik selfie\'si';

  @override
  String get consentSelfieText =>
      'Doğrulama için çektiğin selfie sadece ekibimizce, elle incelenir.';

  @override
  String get consentSelfieAsk =>
      'Mavi tik için belirli bir pozla selfie çekeceksin. Selfie\'n sadece doğrulama ekibimizce incelenir, kimseye gösterilmez; rızanı geri alınca silinir.';

  @override
  String get consentMarketingTitle => 'Kampanya e-postaları';

  @override
  String get consentMarketingText => 'İndirim ve yeni özellik duyuruları.';

  @override
  String get consentMarketingRegister =>
      'Kampanya ve duyuru e-postaları almak istiyorum (isteğe bağlı).';

  @override
  String get revokeConsentTitle => 'Rızanı geri almak istiyor musun?';

  @override
  String get revokeConsent => 'Geri al';

  @override
  String get revokeSpecialWarning =>
      'Profilin keşfetten kalkar, keşfet ve beğeniler kullanılamaz. Var olan sohbetlerin sürer.';

  @override
  String get revokeOverseasWarning =>
      'Arama yapamaz ve alamazsın, telefon bildirimi almazsın.';

  @override
  String get revokeSelfieWarning =>
      'Saklanan selfie\'lerin silinir; bekleyen mavi tik başvurun iptal edilir. Mavi tikin varsa kalır.';

  @override
  String get dataExportTitle => 'Verilerimi indir';

  @override
  String get dataExportSubtitle =>
      'Tüm verilerinin bir kopyası e-postana bağlantı olarak gelir.';

  @override
  String get dataExportAction => 'İste';

  @override
  String get dataExportRequested =>
      'Talebin alındı. Hazır olunca e-postana bağlantı gelecek.';

  @override
  String get dataExportPreparing =>
      'Hazırlanıyor… Hazır olunca e-postana gelecek.';

  @override
  String dataExportReady(String date) {
    return 'E-postana gönderildi ($date tarihine kadar geçerli).';
  }

  @override
  String dataExportNextAt(String date) {
    return 'Bir sonraki talep: $date';
  }

  @override
  String get kvkkRequestTitle => 'KVKK başvurusu';

  @override
  String get kvkkRequestSubtitle => 'Bilgi, düzeltme, silme veya itiraz talebi';

  @override
  String get kvkkRequestInfo =>
      'Başvurun en geç 30 gün içinde yanıtlanır; yanıt e-postana ve buraya gelir.';

  @override
  String get kvkkRequestHint => 'Talebini yaz (en az 10 karakter)';

  @override
  String get kvkkRequestSent => 'Başvurun alındı.';

  @override
  String kvkkRequestPending(String date) {
    return 'İnceleniyor · son gün $date';
  }

  @override
  String get kvkkMyRequests => 'Başvurularım';

  @override
  String get kvkkKindInfo => 'Bilgi talebi';

  @override
  String get kvkkKindCorrection => 'Düzeltme';

  @override
  String get kvkkKindDeletion => 'Silme';

  @override
  String get kvkkKindObjection => 'İtiraz';

  @override
  String get kvkkKindOther => 'Diğer';

  @override
  String get reconsentTitle => 'Metinlerimizi güncelledik';

  @override
  String get reconsentBody =>
      'Devam etmek için güncellenen metinleri okuyup onaylaman gerekiyor. Onaylamak istemezsen verilerini indirebilir veya hesabını silebilirsin.';

  @override
  String get reconsentAccept => 'Okudum, kabul ediyorum';

  @override
  String get errConsentRequired => 'Bu özellik için açık rızan gerekiyor.';

  @override
  String get errPeerCallsDisabled => 'Bu kişi aramaları kapatmış.';

  @override
  String get errExportCooldown => 'Verilerini ayda bir indirebilirsin.';

  @override
  String get contactWarningSender =>
      'İletişim bilgisi paylaştın. Güvenliğin için para, IBAN veya uygulama dışında görüşme isteyenlere dikkat et.';

  @override
  String get contactSafetyTip =>
      'İletişim bilgisi paylaşıldı. Para isteyen veya seni uygulama dışına çağıran kişilere dikkat et.';

  @override
  String get photoUnderReview => 'İncelemede';

  @override
  String get callRulesReminder =>
      'Saygılı ol: çıplaklık, taciz ve para isteme yasaktır. Rahatsız olursan aramadaki bayrakla bildirip kapatabilirsin.';

  @override
  String get reportAndEnd => 'Bildir ve kapat';

  @override
  String get reportAndEndTitle => 'Neden bildiriyorsun? Arama hemen kapanır.';

  @override
  String get safetyCenter => 'Güvenlik merkezi';

  @override
  String get errRestricted =>
      'Hesabın geçici olarak kısıtlı. Bu sürede mesaj, beğeni, istek ve arama yapamazsın.';

  @override
  String get errAlreadyAppealed => 'Bu karara zaten itiraz ettin.';

  @override
  String get sanctionWarningTitle => 'Uyarı aldın';

  @override
  String get sanctionRestrictTitle => 'Hesabın kısıtlandı';

  @override
  String get sanctionBanTitle => 'Hesabın kapatıldı';

  @override
  String sanctionReason(String reason) {
    return 'Sebep: $reason';
  }

  @override
  String sanctionUntil(String date) {
    return '$date tarihine kadar mesaj, beğeni, istek ve arama yapamazsın.';
  }

  @override
  String get sanctionWarningBody =>
      'Topluluk kurallarımıza aykırı bir davranış tespit edildi. Tekrarı hâlinde hesabın kısıtlanabilir.';

  @override
  String get sanctionAppealed => 'İtirazın inceleniyor.';

  @override
  String get appeal => 'İtiraz et';

  @override
  String get appealHint =>
      'Neden yanlış olduğunu düşünüyorsun? (en az 10 karakter)';

  @override
  String get appealSent => 'İtirazın alındı; sonucu e-postayla bildirilecek.';

  @override
  String get understood => 'Anladım';

  @override
  String get reasonFake => 'Sahte profil';

  @override
  String get reasonInappropriate => 'Uygunsuz içerik';

  @override
  String get reasonHarassment => 'Taciz';

  @override
  String get reasonScam => 'Dolandırıcılık';

  @override
  String get reasonUnderage => '18 yaş altı';

  @override
  String get reasonSpam => 'Toplu / istenmeyen mesaj';

  @override
  String get reasonReportBurst => 'Kısa sürede birden çok şikayet';

  @override
  String get reasonOther => 'Diğer';

  @override
  String maturingEarnings(int coins, String date) {
    return '$coins jeton olgunlaşıyor · ilki $date tarihinde bozdurulabilir';
  }

  @override
  String maturingInfo(int days) {
    return 'Yeni kazançlar iade süresi nedeniyle $days gün sonra bozdurulabilir.';
  }

  @override
  String get accountHolderMustMatch => 'Kimliğinde yazan adla aynı olmalı';

  @override
  String cashoutNetAfterTax(String net, String rate) {
    return 'Stopaj (%$rate) sonrası net: $net';
  }

  @override
  String get earningsStatement => 'Yıllık kazanç dökümü';

  @override
  String earningsStatementBody(
    int year,
    int coins,
    int count,
    String gross,
    String tax,
    String net,
  ) {
    return '$year yılı\nKazanılan jeton: $coins\nÖdeme sayısı: $count\nBrüt: $gross\nStopaj: $tax\nNet ödenen: $net';
  }

  @override
  String get kycTitle => 'Kimlik doğrulama';

  @override
  String get kycInfo =>
      'Kazancını doğru kişiye ödeyebilmemiz için bir kez kimliğini doğruluyoruz. Bilgilerin şifreli saklanır ve sadece yetkili finans ekibimiz görür.';

  @override
  String get kycFullName => 'Ad soyad (kimlikteki gibi)';

  @override
  String get kycTcNo => 'TC kimlik numarası';

  @override
  String get kycDocument => 'Kimlik kartının ön yüzü';

  @override
  String get kycPickDocument => 'Fotoğraf seç';

  @override
  String get kycSubmit => 'Doğrulamaya gönder';

  @override
  String get kycSent => 'Kimlik bilgilerin incelemeye gönderildi.';

  @override
  String get kycPending =>
      'Kimlik bilgilerin inceleniyor. Sonuç e-postayla gelecek.';

  @override
  String get kycRejected =>
      'Kimlik doğrulaman onaylanmadı. Bilgilerini kontrol edip tekrar gönderebilirsin.';

  @override
  String get errKycRequired =>
      'Para çekmek için önce kimliğini doğrulamalısın.';

  @override
  String get errKycPending => 'Kimlik doğrulaman zaten inceleniyor.';

  @override
  String get errKycApproved => 'Kimliğin zaten doğrulanmış.';

  @override
  String get errInvalidTc => 'TC kimlik numarası geçersiz.';

  @override
  String get errTcInUse =>
      'Bu TC kimlik numarasıyla başka bir hesap doğrulanmış.';

  @override
  String get errFullNameRequired => 'Adını ve soyadını kimliğindeki gibi yaz.';

  @override
  String get errAccountNameMismatch =>
      'IBAN sahibi, kimliği doğrulanan kişiyle aynı olmalı.';

  @override
  String get salesTermsTitle => 'Satın almadan önce';

  @override
  String get salesTermsUpdatedTitle => 'Satış koşulları güncellendi';

  @override
  String get salesTermsIntro =>
      'Jetonlar dijital içeriktir ve ödeme onaylanır onaylanmaz hesabına yüklenir. Bu yüzden satın aldıktan sonra cayma hakkı kullanılamaz. Bu onayı bir kez verirsin.';

  @override
  String get preInfoForm => 'Ön Bilgilendirme Formu';

  @override
  String get distanceSalesContract => 'Mesafeli Satış Sözleşmesi';

  @override
  String get salesTermsCheckboxA => '';

  @override
  String get salesTermsCheckboxAnd => ' ve ';

  @override
  String get salesTermsCheckboxB =>
      '\'ni okudum, onaylıyorum. Jetonların hemen hesabıma yüklenmesini istiyorum ve bu nedenle cayma hakkımın olmadığını kabul ediyorum.';

  @override
  String get salesTermsAccept => 'Onayla ve devam et';

  @override
  String get salesTermsLineA => 'Satın alma ';

  @override
  String get salesTermsLineB =>
      '\'ne tabidir · Dijital içerik: cayma hakkı yoktur · Jetonların süresi dolmaz';

  @override
  String get supportAboutEntry => 'Bu işlemle ilgili yardım al';

  @override
  String get helpAndSupport => 'Yardım ve destek';

  @override
  String get helpSearchHint => 'Ne arıyorsun? (ör. arama ücreti)';

  @override
  String get helpNoResults =>
      'Sonuç bulunamadı. Farklı kelimelerle dene ya da bize yaz.';

  @override
  String get helpStillNeed => 'Cevabını bulamadın mı?';

  @override
  String get contactSupport => 'Bize yaz';

  @override
  String get imprint => 'Künye';

  @override
  String get myTickets => 'Destek taleplerim';

  @override
  String get newTicket => 'Yeni talep';

  @override
  String get noTickets => 'Henüz destek talebin yok.';

  @override
  String get supportTicket => 'Destek talebi';

  @override
  String get ticketOpen => 'Yanıt bekliyor';

  @override
  String get ticketAnswered => 'Yanıtlandı';

  @override
  String get ticketClosed => 'Kapandı';

  @override
  String get ticketSent => 'Talebin alındı, en kısa sürede dönüyoruz.';

  @override
  String get ticketCategory => 'Konu ne hakkında?';

  @override
  String get ticketSubject => 'Başlık';

  @override
  String get ticketBodyHint =>
      'Ne oldu? Ne zaman oldu? Ne kadar ayrıntı verirsen o kadar hızlı çözeriz.';

  @override
  String get relatedRecord => 'İlgili işlem';

  @override
  String get addScreenshot => 'Ekran görüntüsü ekle';

  @override
  String get screenshotAttached => 'Ekran görüntüsü eklendi';

  @override
  String get viewScreenshot => 'Ekran görüntüsü';

  @override
  String get remove => 'Kaldır';

  @override
  String get ticketResponseTime =>
      'Genellikle 48 saat içinde yanıtlarız. Yanıt gelince bildirim ve e-posta alırsın.';

  @override
  String get ticketWaiting =>
      'Talebin ekibimizde. Yanıt gelince haber vereceğiz.';

  @override
  String get ticketClosedNote =>
      'Bu talep kapandı. Yeni bir sorun için yeni talep açabilirsin.';

  @override
  String get closeTicket => 'Talebi kapat';

  @override
  String get closeTicketConfirm =>
      'Sorunun çözüldüyse talebi kapatabilirsin. Kapanan talebe mesaj yazılamaz.';

  @override
  String get writeReply => 'Yanıt yaz…';

  @override
  String get supportTeam => 'MeetPoint Destek';

  @override
  String get supportCatCoins => 'Jeton ve ödeme';

  @override
  String get supportCatCalls => 'Arama ve hediye';

  @override
  String get supportCatCashout => 'Para çekme';

  @override
  String get supportCatSafety => 'Güvenlik';

  @override
  String get supportCatAccount => 'Hesap';

  @override
  String get supportCatBug => 'Hata bildir';

  @override
  String get supportCatOther => 'Diğer';

  @override
  String get notificationsTitle => 'Bildirimler';

  @override
  String get notifyTypesTitle => 'Bildirim türleri';

  @override
  String get notifyTypesHint =>
      'Kapattığın türler telefonuna gelmez; uygulamada görmeye devam edersin.';

  @override
  String get notifyMessages => 'Mesajlar';

  @override
  String get notifyMatches => 'Eşleşmeler';

  @override
  String get notifyRequests => 'Mesaj istekleri';

  @override
  String get notifyCalls => 'Aramalar';

  @override
  String get notifyLikes => 'Süper beğeniler';

  @override
  String get quietHoursTitle => 'Sessiz saatler';

  @override
  String get quietHoursHint => 'Bu saatlerde aramalar dışında bildirim gelmez.';

  @override
  String get quietHours => 'Sessiz saatleri aç';

  @override
  String get quietFrom => 'Başlangıç';

  @override
  String get quietTo => 'Bitiş';

  @override
  String get marketingTitle => 'Kampanya ve duyurular';

  @override
  String get marketingHint =>
      'İzin kanal bazındadır; istediğin an geri alabilirsin.';

  @override
  String get consentMarketingPushTitle => 'Kampanya bildirimleri';

  @override
  String get consentMarketingPushText =>
      'İndirim ve yeni özellik duyuruları bildirim olarak.';

  @override
  String get requiredNotificationsNote =>
      'Ödeme, destek yanıtı ve güvenlik bildirimleri hesabınla ilgili olduğu için her zaman gönderilir.';

  @override
  String get errSalesTermsRequired =>
      'Satın almadan önce satış koşullarını onaylaman gerekiyor.';

  @override
  String get errSupportLimit =>
      'Çok fazla açık talebin var. Önce mevcut taleplerinden birini kapat.';

  @override
  String get errTicketClosed => 'Bu talep kapandı. Yeni bir talep açabilirsin.';
}
