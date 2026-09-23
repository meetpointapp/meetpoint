import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_tr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('tr'),
  ];

  /// No description provided for @appName.
  ///
  /// In tr, this message translates to:
  /// **'MeetPoint'**
  String get appName;

  /// No description provided for @tagline.
  ///
  /// In tr, this message translates to:
  /// **'Tanış, konuş, kazan.'**
  String get tagline;

  /// No description provided for @loginTitle.
  ///
  /// In tr, this message translates to:
  /// **'Tekrar hoş geldin'**
  String get loginTitle;

  /// No description provided for @registerTitle.
  ///
  /// In tr, this message translates to:
  /// **'Hesap oluştur'**
  String get registerTitle;

  /// No description provided for @email.
  ///
  /// In tr, this message translates to:
  /// **'E-posta'**
  String get email;

  /// No description provided for @password.
  ///
  /// In tr, this message translates to:
  /// **'Şifre'**
  String get password;

  /// No description provided for @passwordHint.
  ///
  /// In tr, this message translates to:
  /// **'En az 8 karakter'**
  String get passwordHint;

  /// No description provided for @login.
  ///
  /// In tr, this message translates to:
  /// **'Giriş yap'**
  String get login;

  /// No description provided for @register.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt ol'**
  String get register;

  /// No description provided for @noAccount.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın yok mu? Kayıt ol'**
  String get noAccount;

  /// No description provided for @haveAccount.
  ///
  /// In tr, this message translates to:
  /// **'Zaten hesabın var mı? Giriş yap'**
  String get haveAccount;

  /// No description provided for @setupTitle.
  ///
  /// In tr, this message translates to:
  /// **'Profilini oluştur'**
  String get setupTitle;

  /// No description provided for @editProfile.
  ///
  /// In tr, this message translates to:
  /// **'Profili düzenle'**
  String get editProfile;

  /// No description provided for @photos.
  ///
  /// In tr, this message translates to:
  /// **'Fotoğraflar'**
  String get photos;

  /// No description provided for @photosHint.
  ///
  /// In tr, this message translates to:
  /// **'En az 1, en fazla {max} fotoğraf. İlk fotoğraf kapak fotoğrafın olur.'**
  String photosHint(int max);

  /// No description provided for @displayName.
  ///
  /// In tr, this message translates to:
  /// **'Görünen ad'**
  String get displayName;

  /// No description provided for @birthDate.
  ///
  /// In tr, this message translates to:
  /// **'Doğum tarihi'**
  String get birthDate;

  /// No description provided for @selectDate.
  ///
  /// In tr, this message translates to:
  /// **'Tarih seç'**
  String get selectDate;

  /// No description provided for @gender.
  ///
  /// In tr, this message translates to:
  /// **'Cinsiyet'**
  String get gender;

  /// No description provided for @male.
  ///
  /// In tr, this message translates to:
  /// **'Erkek'**
  String get male;

  /// No description provided for @female.
  ///
  /// In tr, this message translates to:
  /// **'Kadın'**
  String get female;

  /// No description provided for @other.
  ///
  /// In tr, this message translates to:
  /// **'Diğer'**
  String get other;

  /// No description provided for @interestedIn.
  ///
  /// In tr, this message translates to:
  /// **'İlgilendiğin'**
  String get interestedIn;

  /// No description provided for @men.
  ///
  /// In tr, this message translates to:
  /// **'Erkekler'**
  String get men;

  /// No description provided for @women.
  ///
  /// In tr, this message translates to:
  /// **'Kadınlar'**
  String get women;

  /// No description provided for @everyone.
  ///
  /// In tr, this message translates to:
  /// **'Herkes'**
  String get everyone;

  /// No description provided for @bio.
  ///
  /// In tr, this message translates to:
  /// **'Hakkımda'**
  String get bio;

  /// No description provided for @city.
  ///
  /// In tr, this message translates to:
  /// **'Şehir'**
  String get city;

  /// No description provided for @country.
  ///
  /// In tr, this message translates to:
  /// **'Ülke'**
  String get country;

  /// No description provided for @save.
  ///
  /// In tr, this message translates to:
  /// **'Kaydet'**
  String get save;

  /// No description provided for @continueLabel.
  ///
  /// In tr, this message translates to:
  /// **'Devam et'**
  String get continueLabel;

  /// No description provided for @requiredField.
  ///
  /// In tr, this message translates to:
  /// **'Bu alan zorunlu'**
  String get requiredField;

  /// No description provided for @photoRequired.
  ///
  /// In tr, this message translates to:
  /// **'En az bir fotoğraf ekle'**
  String get photoRequired;

  /// No description provided for @saved.
  ///
  /// In tr, this message translates to:
  /// **'Kaydedildi'**
  String get saved;

  /// No description provided for @navDiscover.
  ///
  /// In tr, this message translates to:
  /// **'Keşfet'**
  String get navDiscover;

  /// No description provided for @navRequests.
  ///
  /// In tr, this message translates to:
  /// **'İstekler'**
  String get navRequests;

  /// No description provided for @navChats.
  ///
  /// In tr, this message translates to:
  /// **'Sohbetler'**
  String get navChats;

  /// No description provided for @navWallet.
  ///
  /// In tr, this message translates to:
  /// **'Cüzdan'**
  String get navWallet;

  /// No description provided for @navProfile.
  ///
  /// In tr, this message translates to:
  /// **'Profil'**
  String get navProfile;

  /// No description provided for @noMoreProfiles.
  ///
  /// In tr, this message translates to:
  /// **'Şimdilik gösterilecek yeni kimse yok'**
  String get noMoreProfiles;

  /// No description provided for @refresh.
  ///
  /// In tr, this message translates to:
  /// **'Yenile'**
  String get refresh;

  /// No description provided for @itsAMatch.
  ///
  /// In tr, this message translates to:
  /// **'Eşleştiniz!'**
  String get itsAMatch;

  /// No description provided for @matchBody.
  ///
  /// In tr, this message translates to:
  /// **'{name} ile eşleştin. Artık ücretsiz mesajlaşabilirsiniz.'**
  String matchBody(String name);

  /// No description provided for @sendMessage.
  ///
  /// In tr, this message translates to:
  /// **'Mesaj gönder'**
  String get sendMessage;

  /// No description provided for @keepSwiping.
  ///
  /// In tr, this message translates to:
  /// **'Keşfetmeye devam'**
  String get keepSwiping;

  /// No description provided for @messageRequest.
  ///
  /// In tr, this message translates to:
  /// **'Mesaj isteği'**
  String get messageRequest;

  /// No description provided for @voiceCall.
  ///
  /// In tr, this message translates to:
  /// **'Sesli arama'**
  String get voiceCall;

  /// No description provided for @videoCall.
  ///
  /// In tr, this message translates to:
  /// **'Görüntülü arama'**
  String get videoCall;

  /// No description provided for @coins.
  ///
  /// In tr, this message translates to:
  /// **'{count} jeton'**
  String coins(int count);

  /// No description provided for @requestDialogTitle.
  ///
  /// In tr, this message translates to:
  /// **'{name} kişisine mesaj isteği'**
  String requestDialogTitle(String name);

  /// No description provided for @requestDialogHint.
  ///
  /// In tr, this message translates to:
  /// **'İlk mesajını yaz...'**
  String get requestDialogHint;

  /// No description provided for @requestCostInfo.
  ///
  /// In tr, this message translates to:
  /// **'{price} jeton bloke edilir. Kabul edilirse karşı tarafa geçer; reddedilir ya da 24 saat içinde cevaplanmazsa sana iade edilir.'**
  String requestCostInfo(int price);

  /// No description provided for @confirmRequestTitle.
  ///
  /// In tr, this message translates to:
  /// **'{kind} isteği gönderilsin mi?'**
  String confirmRequestTitle(String kind);

  /// No description provided for @send.
  ///
  /// In tr, this message translates to:
  /// **'Gönder'**
  String get send;

  /// No description provided for @cancel.
  ///
  /// In tr, this message translates to:
  /// **'Vazgeç'**
  String get cancel;

  /// No description provided for @requestSent.
  ///
  /// In tr, this message translates to:
  /// **'İstek gönderildi'**
  String get requestSent;

  /// No description provided for @topUp.
  ///
  /// In tr, this message translates to:
  /// **'Jeton yükle'**
  String get topUp;

  /// No description provided for @inbox.
  ///
  /// In tr, this message translates to:
  /// **'Gelen'**
  String get inbox;

  /// No description provided for @outbox.
  ///
  /// In tr, this message translates to:
  /// **'Giden'**
  String get outbox;

  /// No description provided for @noRequests.
  ///
  /// In tr, this message translates to:
  /// **'Henüz istek yok'**
  String get noRequests;

  /// No description provided for @accept.
  ///
  /// In tr, this message translates to:
  /// **'Kabul et'**
  String get accept;

  /// No description provided for @reject.
  ///
  /// In tr, this message translates to:
  /// **'Reddet'**
  String get reject;

  /// No description provided for @cancelRequest.
  ///
  /// In tr, this message translates to:
  /// **'Geri çek'**
  String get cancelRequest;

  /// No description provided for @statusPending.
  ///
  /// In tr, this message translates to:
  /// **'Bekliyor'**
  String get statusPending;

  /// No description provided for @statusAccepted.
  ///
  /// In tr, this message translates to:
  /// **'Kabul edildi'**
  String get statusAccepted;

  /// No description provided for @statusRejected.
  ///
  /// In tr, this message translates to:
  /// **'Reddedildi'**
  String get statusRejected;

  /// No description provided for @statusCancelled.
  ///
  /// In tr, this message translates to:
  /// **'Geri çekildi'**
  String get statusCancelled;

  /// No description provided for @statusExpired.
  ///
  /// In tr, this message translates to:
  /// **'Süresi doldu'**
  String get statusExpired;

  /// No description provided for @expiresIn.
  ///
  /// In tr, this message translates to:
  /// **'{hours} sa içinde düşer'**
  String expiresIn(int hours);

  /// No description provided for @earnOnAccept.
  ///
  /// In tr, this message translates to:
  /// **'Kabul edersen +{price} jeton kazanırsın'**
  String earnOnAccept(int price);

  /// No description provided for @callComingSoon.
  ///
  /// In tr, this message translates to:
  /// **'Arama özelliği yakında geliyor. Jetonlar bakiyene eklendi.'**
  String get callComingSoon;

  /// No description provided for @noChats.
  ///
  /// In tr, this message translates to:
  /// **'Henüz sohbet yok. Keşfet\'te birini beğen ya da mesaj isteği gönder.'**
  String get noChats;

  /// No description provided for @typeMessage.
  ///
  /// In tr, this message translates to:
  /// **'Mesaj yaz...'**
  String get typeMessage;

  /// No description provided for @matchedChat.
  ///
  /// In tr, this message translates to:
  /// **'Eşleşme'**
  String get matchedChat;

  /// No description provided for @requestChat.
  ///
  /// In tr, this message translates to:
  /// **'Mesaj isteği'**
  String get requestChat;

  /// No description provided for @balance.
  ///
  /// In tr, this message translates to:
  /// **'Bakiye'**
  String get balance;

  /// No description provided for @cashable.
  ///
  /// In tr, this message translates to:
  /// **'Bozdurulabilir'**
  String get cashable;

  /// No description provided for @cashableInfo.
  ///
  /// In tr, this message translates to:
  /// **'Sadece başkalarından kazandığın jetonlar paraya çevrilebilir.'**
  String get cashableInfo;

  /// No description provided for @cashout.
  ///
  /// In tr, this message translates to:
  /// **'Paraya çevir'**
  String get cashout;

  /// No description provided for @comingSoon.
  ///
  /// In tr, this message translates to:
  /// **'Yakında'**
  String get comingSoon;

  /// No description provided for @buyCoins.
  ///
  /// In tr, this message translates to:
  /// **'Jeton satın al'**
  String get buyCoins;

  /// No description provided for @testModeNote.
  ///
  /// In tr, this message translates to:
  /// **'Test modu: ödeme alınmaz, jetonlar anında eklenir.'**
  String get testModeNote;

  /// No description provided for @history.
  ///
  /// In tr, this message translates to:
  /// **'Hareketler'**
  String get history;

  /// No description provided for @noHistory.
  ///
  /// In tr, this message translates to:
  /// **'Henüz hareket yok'**
  String get noHistory;

  /// No description provided for @txPurchase.
  ///
  /// In tr, this message translates to:
  /// **'Jeton satın alımı'**
  String get txPurchase;

  /// No description provided for @txHold.
  ///
  /// In tr, this message translates to:
  /// **'İstek için bloke'**
  String get txHold;

  /// No description provided for @txRefund.
  ///
  /// In tr, this message translates to:
  /// **'İade'**
  String get txRefund;

  /// No description provided for @txEarn.
  ///
  /// In tr, this message translates to:
  /// **'Kazanç'**
  String get txEarn;

  /// No description provided for @txSpend.
  ///
  /// In tr, this message translates to:
  /// **'Harcama'**
  String get txSpend;

  /// No description provided for @txCashout.
  ///
  /// In tr, this message translates to:
  /// **'Paraya çevirme'**
  String get txCashout;

  /// No description provided for @txGrant.
  ///
  /// In tr, this message translates to:
  /// **'Hediye'**
  String get txGrant;

  /// No description provided for @coinsAdded.
  ///
  /// In tr, this message translates to:
  /// **'{count} jeton eklendi'**
  String coinsAdded(int count);

  /// No description provided for @language.
  ///
  /// In tr, this message translates to:
  /// **'Dil'**
  String get language;

  /// No description provided for @logout.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış yap'**
  String get logout;

  /// No description provided for @block.
  ///
  /// In tr, this message translates to:
  /// **'Engelle'**
  String get block;

  /// No description provided for @report.
  ///
  /// In tr, this message translates to:
  /// **'Şikayet et'**
  String get report;

  /// No description provided for @blockConfirm.
  ///
  /// In tr, this message translates to:
  /// **'{name} engellensin mi? Seni göremez ve sana ulaşamaz.'**
  String blockConfirm(String name);

  /// No description provided for @blocked.
  ///
  /// In tr, this message translates to:
  /// **'Engellendi'**
  String get blocked;

  /// No description provided for @reportTitle.
  ///
  /// In tr, this message translates to:
  /// **'Şikayet sebebi'**
  String get reportTitle;

  /// No description provided for @reportFake.
  ///
  /// In tr, this message translates to:
  /// **'Sahte profil'**
  String get reportFake;

  /// No description provided for @reportInappropriate.
  ///
  /// In tr, this message translates to:
  /// **'Uygunsuz içerik'**
  String get reportInappropriate;

  /// No description provided for @reportHarassment.
  ///
  /// In tr, this message translates to:
  /// **'Taciz'**
  String get reportHarassment;

  /// No description provided for @reportScam.
  ///
  /// In tr, this message translates to:
  /// **'Dolandırıcılık'**
  String get reportScam;

  /// No description provided for @reportUnderage.
  ///
  /// In tr, this message translates to:
  /// **'18 yaş altı'**
  String get reportUnderage;

  /// No description provided for @reportOther.
  ///
  /// In tr, this message translates to:
  /// **'Diğer'**
  String get reportOther;

  /// No description provided for @reportSent.
  ///
  /// In tr, this message translates to:
  /// **'Şikayetin alındı, teşekkürler.'**
  String get reportSent;

  /// No description provided for @errGeneric.
  ///
  /// In tr, this message translates to:
  /// **'Bir şeyler ters gitti. Tekrar dene.'**
  String get errGeneric;

  /// No description provided for @errNetwork.
  ///
  /// In tr, this message translates to:
  /// **'Sunucuya ulaşılamadı.'**
  String get errNetwork;

  /// No description provided for @errInvalidCredentials.
  ///
  /// In tr, this message translates to:
  /// **'E-posta veya şifre hatalı.'**
  String get errInvalidCredentials;

  /// No description provided for @errEmailTaken.
  ///
  /// In tr, this message translates to:
  /// **'Bu e-posta zaten kayıtlı.'**
  String get errEmailTaken;

  /// No description provided for @errUnderage.
  ///
  /// In tr, this message translates to:
  /// **'MeetPoint\'i kullanmak için 18 yaşından büyük olmalısın.'**
  String get errUnderage;

  /// No description provided for @errInsufficientBalance.
  ///
  /// In tr, this message translates to:
  /// **'Yeterli jetonun yok.'**
  String get errInsufficientBalance;

  /// No description provided for @errAlreadyPending.
  ///
  /// In tr, this message translates to:
  /// **'Bu kişiye zaten bekleyen bir isteğin var.'**
  String get errAlreadyPending;

  /// No description provided for @errAlreadyInConversation.
  ///
  /// In tr, this message translates to:
  /// **'Bu kişiyle zaten sohbetin var.'**
  String get errAlreadyInConversation;

  /// No description provided for @errTooManyPhotos.
  ///
  /// In tr, this message translates to:
  /// **'En fazla 6 fotoğraf ekleyebilirsin.'**
  String get errTooManyPhotos;

  /// No description provided for @errValidation.
  ///
  /// In tr, this message translates to:
  /// **'Lütfen bilgileri kontrol et.'**
  String get errValidation;

  /// No description provided for @errExpired.
  ///
  /// In tr, this message translates to:
  /// **'Bu isteğin süresi dolmuş.'**
  String get errExpired;

  /// No description provided for @errNotPending.
  ///
  /// In tr, this message translates to:
  /// **'Bu istek artık geçerli değil.'**
  String get errNotPending;

  /// No description provided for @errBlocked.
  ///
  /// In tr, this message translates to:
  /// **'Bu kişiyle artık mesajlaşamazsın.'**
  String get errBlocked;

  /// No description provided for @interestLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, coffee{Kahve} travel{Seyahat} music{Müzik} concerts{Konserler} movies{Sinema} series{Diziler} books{Kitaplar} photography{Fotoğrafçılık} art{Sanat} cooking{Yemek yapmak} foodie{Gurme} wine{Şarap} fitness{Fitness} yoga{Yoga} running{Koşu} cycling{Bisiklet} hiking{Doğa yürüyüşü} camping{Kamp} football{Futbol} basketball{Basketbol} gaming{Oyun} tech{Teknoloji} fashion{Moda} dancing{Dans} pets{Evcil hayvanlar} nature{Doğa} beach{Plaj} meditation{Meditasyon} anime{Anime} volunteering{Gönüllülük} other{{id}}}'**
  String interestLabel(String id);

  /// No description provided for @promptQuestion.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, perfect_sunday{Mükemmel bir pazar günüm...} laugh{Beni en çok güldüren şey...} green_flag{Birinde aradığım yeşil bayrak...} travel_dream{Hayalimdeki seyahat...} unpopular_opinion{Popüler olmayan bir fikrim...} simple_pleasures{Basit mutluluklarım...} looking_for{Aradığım kişi...} two_truths{İki doğru, bir yalan...} first_date{İdeal ilk buluşma...} song{Şu an dilime dolanan şarkı...} other{{id}}}'**
  String promptQuestion(String id);

  /// No description provided for @lookingForLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, relationship{Ciddi ilişki} casual{Eğlenceli bir şeyler} friendship{Yeni arkadaşlar} chat{Sadece sohbet} unsure{Henüz emin değilim} other{{id}}}'**
  String lookingForLabel(String id);

  /// No description provided for @educationLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, high_school{Lise} bachelor{Lisans} master{Yüksek lisans} phd{Doktora} other{{id}}}'**
  String educationLabel(String id);

  /// No description provided for @zodiacLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, aries{Koç} taurus{Boğa} gemini{İkizler} cancer{Yengeç} leo{Aslan} virgo{Başak} libra{Terazi} scorpio{Akrep} sagittarius{Yay} capricorn{Oğlak} aquarius{Kova} pisces{Balık} other{{id}}}'**
  String zodiacLabel(String id);

  /// No description provided for @habitLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, no{Hayır} sometimes{Bazen} yes{Evet} other{{id}}}'**
  String habitLabel(String id);

  /// No description provided for @obNameTitle.
  ///
  /// In tr, this message translates to:
  /// **'Adın ne?'**
  String get obNameTitle;

  /// No description provided for @obNameHint.
  ///
  /// In tr, this message translates to:
  /// **'Profilinde bu isim görünecek.'**
  String get obNameHint;

  /// No description provided for @obBirthTitle.
  ///
  /// In tr, this message translates to:
  /// **'Doğum tarihin ne?'**
  String get obBirthTitle;

  /// No description provided for @obBirthHint.
  ///
  /// In tr, this message translates to:
  /// **'Profilinde sadece yaşın görünür.'**
  String get obBirthHint;

  /// No description provided for @obAgeLabel.
  ///
  /// In tr, this message translates to:
  /// **'{age} yaşındasın'**
  String obAgeLabel(int age);

  /// No description provided for @obGenderTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kendini nasıl tanımlıyorsun?'**
  String get obGenderTitle;

  /// No description provided for @obInterestedTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kimlerle tanışmak istiyorsun?'**
  String get obInterestedTitle;

  /// No description provided for @obPhotosTitle.
  ///
  /// In tr, this message translates to:
  /// **'Fotoğraflarını ekle'**
  String get obPhotosTitle;

  /// No description provided for @obPhotosHint.
  ///
  /// In tr, this message translates to:
  /// **'En az 1 fotoğraf gerekli. 3 ve üzeri fotoğrafı olan profiller daha çok eşleşiyor.'**
  String get obPhotosHint;

  /// No description provided for @obInterestsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Nelerden hoşlanırsın?'**
  String get obInterestsTitle;

  /// No description provided for @obInterestsHint.
  ///
  /// In tr, this message translates to:
  /// **'{min} ile {max} arası seç'**
  String obInterestsHint(int min, int max);

  /// No description provided for @obLookingTitle.
  ///
  /// In tr, this message translates to:
  /// **'Burada ne arıyorsun?'**
  String get obLookingTitle;

  /// No description provided for @obPromptsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kendinden bahset'**
  String get obPromptsTitle;

  /// No description provided for @obPromptsHint.
  ///
  /// In tr, this message translates to:
  /// **'En fazla 3 soru seçip cevapla. Sohbet başlatmanın en kolay yolu.'**
  String get obPromptsHint;

  /// No description provided for @obBasicsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Biraz daha detay'**
  String get obBasicsTitle;

  /// No description provided for @obBasicsHint.
  ///
  /// In tr, this message translates to:
  /// **'Hepsi isteğe bağlı, istediğin zaman değiştirebilirsin.'**
  String get obBasicsHint;

  /// No description provided for @skip.
  ///
  /// In tr, this message translates to:
  /// **'Atla'**
  String get skip;

  /// No description provided for @finish.
  ///
  /// In tr, this message translates to:
  /// **'Profilimi oluştur'**
  String get finish;

  /// No description provided for @addPrompt.
  ///
  /// In tr, this message translates to:
  /// **'Soru ekle'**
  String get addPrompt;

  /// No description provided for @choosePrompt.
  ///
  /// In tr, this message translates to:
  /// **'Bir soru seç'**
  String get choosePrompt;

  /// No description provided for @yourAnswer.
  ///
  /// In tr, this message translates to:
  /// **'Cevabın'**
  String get yourAnswer;

  /// No description provided for @height.
  ///
  /// In tr, this message translates to:
  /// **'Boy'**
  String get height;

  /// No description provided for @heightCm.
  ///
  /// In tr, this message translates to:
  /// **'{cm} cm'**
  String heightCm(int cm);

  /// No description provided for @job.
  ///
  /// In tr, this message translates to:
  /// **'Meslek'**
  String get job;

  /// No description provided for @education.
  ///
  /// In tr, this message translates to:
  /// **'Eğitim'**
  String get education;

  /// No description provided for @zodiac.
  ///
  /// In tr, this message translates to:
  /// **'Burç'**
  String get zodiac;

  /// No description provided for @smoking.
  ///
  /// In tr, this message translates to:
  /// **'Sigara'**
  String get smoking;

  /// No description provided for @drinking.
  ///
  /// In tr, this message translates to:
  /// **'Alkol'**
  String get drinking;

  /// No description provided for @lookingFor.
  ///
  /// In tr, this message translates to:
  /// **'Aradığı'**
  String get lookingFor;

  /// No description provided for @interests.
  ///
  /// In tr, this message translates to:
  /// **'İlgi alanları'**
  String get interests;

  /// No description provided for @prompts.
  ///
  /// In tr, this message translates to:
  /// **'Sorular'**
  String get prompts;

  /// No description provided for @basics.
  ///
  /// In tr, this message translates to:
  /// **'Temel bilgiler'**
  String get basics;

  /// No description provided for @notSpecified.
  ///
  /// In tr, this message translates to:
  /// **'Belirtilmedi'**
  String get notSpecified;

  /// No description provided for @makeCover.
  ///
  /// In tr, this message translates to:
  /// **'Kapak fotoğrafı yap'**
  String get makeCover;

  /// No description provided for @deletePhoto.
  ///
  /// In tr, this message translates to:
  /// **'Fotoğrafı sil'**
  String get deletePhoto;

  /// No description provided for @cover.
  ///
  /// In tr, this message translates to:
  /// **'Kapak'**
  String get cover;

  /// No description provided for @edit.
  ///
  /// In tr, this message translates to:
  /// **'Düzenle'**
  String get edit;

  /// No description provided for @personalInfo.
  ///
  /// In tr, this message translates to:
  /// **'Kişisel bilgiler'**
  String get personalInfo;

  /// No description provided for @profileCompletion.
  ///
  /// In tr, this message translates to:
  /// **'Profilin %{percent} tamamlandı'**
  String profileCompletion(int percent);

  /// No description provided for @commonInterests.
  ///
  /// In tr, this message translates to:
  /// **'{count} ortak ilgi alanı'**
  String commonInterests(int count);

  /// No description provided for @stepOf.
  ///
  /// In tr, this message translates to:
  /// **'{step}/{total}'**
  String stepOf(int step, int total);

  /// No description provided for @clear.
  ///
  /// In tr, this message translates to:
  /// **'Temizle'**
  String get clear;

  /// No description provided for @previewProfile.
  ///
  /// In tr, this message translates to:
  /// **'Profilimi önizle'**
  String get previewProfile;

  /// No description provided for @viewProfile.
  ///
  /// In tr, this message translates to:
  /// **'Profili gör'**
  String get viewProfile;

  /// No description provided for @done.
  ///
  /// In tr, this message translates to:
  /// **'Tamam'**
  String get done;

  /// No description provided for @forgotPassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifremi unuttum'**
  String get forgotPassword;

  /// No description provided for @resetTitle.
  ///
  /// In tr, this message translates to:
  /// **'Şifreni sıfırla'**
  String get resetTitle;

  /// No description provided for @resetHint.
  ///
  /// In tr, this message translates to:
  /// **'E-posta adresine 6 haneli bir kod göndereceğiz.'**
  String get resetHint;

  /// No description provided for @sendCode.
  ///
  /// In tr, this message translates to:
  /// **'Kod gönder'**
  String get sendCode;

  /// No description provided for @codeSentTo.
  ///
  /// In tr, this message translates to:
  /// **'{email} adresine 6 haneli bir kod gönderdik.'**
  String codeSentTo(String email);

  /// No description provided for @newPassword.
  ///
  /// In tr, this message translates to:
  /// **'Yeni şifre'**
  String get newPassword;

  /// No description provided for @resetDone.
  ///
  /// In tr, this message translates to:
  /// **'Şifren güncellendi'**
  String get resetDone;

  /// No description provided for @verifyEmailTitle.
  ///
  /// In tr, this message translates to:
  /// **'E-postanı doğrula'**
  String get verifyEmailTitle;

  /// No description provided for @code.
  ///
  /// In tr, this message translates to:
  /// **'Kod'**
  String get code;

  /// No description provided for @verify.
  ///
  /// In tr, this message translates to:
  /// **'Doğrula'**
  String get verify;

  /// No description provided for @resendCode.
  ///
  /// In tr, this message translates to:
  /// **'Kodu tekrar gönder'**
  String get resendCode;

  /// No description provided for @resendIn.
  ///
  /// In tr, this message translates to:
  /// **'{seconds} sn sonra tekrar gönderebilirsin'**
  String resendIn(int seconds);

  /// No description provided for @codeResent.
  ///
  /// In tr, this message translates to:
  /// **'Yeni kod gönderildi'**
  String get codeResent;

  /// No description provided for @useAnotherAccount.
  ///
  /// In tr, this message translates to:
  /// **'Başka hesapla giriş yap'**
  String get useAnotherAccount;

  /// No description provided for @termsOfService.
  ///
  /// In tr, this message translates to:
  /// **'Kullanım Koşulları'**
  String get termsOfService;

  /// No description provided for @privacyPolicy.
  ///
  /// In tr, this message translates to:
  /// **'Gizlilik Politikası'**
  String get privacyPolicy;

  /// No description provided for @termsConsent.
  ///
  /// In tr, this message translates to:
  /// **'18 yaşından büyüğüm; {terms} ve {privacy} metinlerini okudum, kabul ediyorum.'**
  String termsConsent(String terms, String privacy);

  /// No description provided for @mustAcceptTerms.
  ///
  /// In tr, this message translates to:
  /// **'Devam etmek için koşulları kabul etmelisin.'**
  String get mustAcceptTerms;

  /// No description provided for @deleteAccount.
  ///
  /// In tr, this message translates to:
  /// **'Hesabı sil'**
  String get deleteAccount;

  /// No description provided for @deleteAccountWarning.
  ///
  /// In tr, this message translates to:
  /// **'Bu işlem geri alınamaz. Profilin, fotoğrafların, eşleşmelerin, mesajların ve jeton bakiyen kalıcı olarak silinir.'**
  String get deleteAccountWarning;

  /// No description provided for @confirmWithPassword.
  ///
  /// In tr, this message translates to:
  /// **'Onaylamak için şifreni gir'**
  String get confirmWithPassword;

  /// No description provided for @accountDeleted.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın silindi'**
  String get accountDeleted;

  /// No description provided for @legal.
  ///
  /// In tr, this message translates to:
  /// **'Yasal'**
  String get legal;

  /// No description provided for @verifyProfile.
  ///
  /// In tr, this message translates to:
  /// **'Profilini doğrula'**
  String get verifyProfile;

  /// No description provided for @verifyProfileHint.
  ///
  /// In tr, this message translates to:
  /// **'Mavi tik al, daha çok güven ve eşleşme kazan.'**
  String get verifyProfileHint;

  /// No description provided for @verifiedLabel.
  ///
  /// In tr, this message translates to:
  /// **'Doğrulanmış profil'**
  String get verifiedLabel;

  /// No description provided for @verificationPendingLabel.
  ///
  /// In tr, this message translates to:
  /// **'Doğrulama inceleniyor'**
  String get verificationPendingLabel;

  /// No description provided for @verificationRejectedLabel.
  ///
  /// In tr, this message translates to:
  /// **'Doğrulama onaylanmadı, tekrar dene'**
  String get verificationRejectedLabel;

  /// No description provided for @verifyTitle.
  ///
  /// In tr, this message translates to:
  /// **'Mavi tik al'**
  String get verifyTitle;

  /// No description provided for @verifyStep.
  ///
  /// In tr, this message translates to:
  /// **'Aşağıdaki pozu yaparak bir selfie çek. Selfie\'n sadece doğrulama ekibimiz tarafından görülür, profilinde yayınlanmaz.'**
  String get verifyStep;

  /// No description provided for @takeSelfie.
  ///
  /// In tr, this message translates to:
  /// **'Selfie çek'**
  String get takeSelfie;

  /// No description provided for @retake.
  ///
  /// In tr, this message translates to:
  /// **'Yeniden çek'**
  String get retake;

  /// No description provided for @verificationSubmitted.
  ///
  /// In tr, this message translates to:
  /// **'Başvurun alındı. Genellikle 24 saat içinde incelenir.'**
  String get verificationSubmitted;

  /// No description provided for @poseLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, peace_sign{✌️ Barış işareti yap} thumbs_up{👍 Başparmağını kaldır} hand_on_head{🙋 Elini başına koy} point_up{☝️ Yukarıyı göster} wave{👋 El salla} other{{id}}}'**
  String poseLabel(String id);

  /// No description provided for @errCodeInvalid.
  ///
  /// In tr, this message translates to:
  /// **'Kod hatalı.'**
  String get errCodeInvalid;

  /// No description provided for @errCodeExpired.
  ///
  /// In tr, this message translates to:
  /// **'Kodun süresi doldu ya da çok fazla deneme yapıldı. Yeni kod iste.'**
  String get errCodeExpired;

  /// No description provided for @errCodeCooldown.
  ///
  /// In tr, this message translates to:
  /// **'Yeni kod istemeden önce biraz bekle.'**
  String get errCodeCooldown;

  /// No description provided for @errRateLimited.
  ///
  /// In tr, this message translates to:
  /// **'Çok hızlı gidiyorsun, biraz bekleyip tekrar dene.'**
  String get errRateLimited;

  /// No description provided for @errBanned.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın topluluk kurallarını ihlal ettiği için askıya alındı.'**
  String get errBanned;

  /// No description provided for @errAlreadyVerified.
  ///
  /// In tr, this message translates to:
  /// **'Profilin zaten doğrulanmış.'**
  String get errAlreadyVerified;

  /// No description provided for @errVerificationPending.
  ///
  /// In tr, this message translates to:
  /// **'Başvurun zaten inceleniyor.'**
  String get errVerificationPending;

  /// No description provided for @kmAway.
  ///
  /// In tr, this message translates to:
  /// **'{km} km uzakta'**
  String kmAway(int km);

  /// No description provided for @filters.
  ///
  /// In tr, this message translates to:
  /// **'Filtreler'**
  String get filters;

  /// No description provided for @ageRange.
  ///
  /// In tr, this message translates to:
  /// **'Yaş aralığı'**
  String get ageRange;

  /// No description provided for @maxDistance.
  ///
  /// In tr, this message translates to:
  /// **'En fazla uzaklık'**
  String get maxDistance;

  /// No description provided for @anyDistance.
  ///
  /// In tr, this message translates to:
  /// **'Fark etmez'**
  String get anyDistance;

  /// No description provided for @apply.
  ///
  /// In tr, this message translates to:
  /// **'Uygula'**
  String get apply;

  /// No description provided for @locationRationale.
  ///
  /// In tr, this message translates to:
  /// **'Yakınındaki kişileri gösterebilmemiz için konumuna ihtiyacımız var. Tam konumun kimseyle paylaşılmaz, sadece yaklaşık mesafe görünür.'**
  String get locationRationale;

  /// No description provided for @enableLocation.
  ///
  /// In tr, this message translates to:
  /// **'Konumu aç'**
  String get enableLocation;

  /// No description provided for @superLike.
  ///
  /// In tr, this message translates to:
  /// **'Süper beğeni'**
  String get superLike;

  /// No description provided for @superLikeSent.
  ///
  /// In tr, this message translates to:
  /// **'Süper beğeni gönderildi ⭐'**
  String get superLikeSent;

  /// No description provided for @superLikedYou.
  ///
  /// In tr, this message translates to:
  /// **'Seni süper beğendi'**
  String get superLikedYou;

  /// No description provided for @boost.
  ///
  /// In tr, this message translates to:
  /// **'Öne çıkar'**
  String get boost;

  /// No description provided for @boostTitle.
  ///
  /// In tr, this message translates to:
  /// **'Profilini öne çıkar'**
  String get boostTitle;

  /// No description provided for @boostBody.
  ///
  /// In tr, this message translates to:
  /// **'{minutes} dakika boyunca keşfette en üstte gösterilirsin. Daha çok kişi seni görür.'**
  String boostBody(int minutes);

  /// No description provided for @boostActive.
  ///
  /// In tr, this message translates to:
  /// **'{minutes} dk'**
  String boostActive(int minutes);

  /// No description provided for @likesYou.
  ///
  /// In tr, this message translates to:
  /// **'Seni beğenenler'**
  String get likesYou;

  /// No description provided for @likesYouCount.
  ///
  /// In tr, this message translates to:
  /// **'{count, plural, =0{Henüz kimse seni beğenmedi} =1{1 kişi seni beğendi} other{{count} kişi seni beğendi}}'**
  String likesYouCount(int count);

  /// No description provided for @likesLockedBody.
  ///
  /// In tr, this message translates to:
  /// **'Seni kimlerin beğendiğini gör, beğenirsen anında eşleş. {hours} saat boyunca açık kalır.'**
  String likesLockedBody(int hours);

  /// No description provided for @seeWhoLikes.
  ///
  /// In tr, this message translates to:
  /// **'Kimler olduğunu gör'**
  String get seeWhoLikes;

  /// No description provided for @noLikesYet.
  ///
  /// In tr, this message translates to:
  /// **'Henüz seni beğenen yok. Profilini tamamla ya da öne çıkar!'**
  String get noLikesYet;

  /// No description provided for @typing.
  ///
  /// In tr, this message translates to:
  /// **'yazıyor...'**
  String get typing;

  /// No description provided for @photo.
  ///
  /// In tr, this message translates to:
  /// **'Fotoğraf'**
  String get photo;

  /// No description provided for @viewOncePhoto.
  ///
  /// In tr, this message translates to:
  /// **'Tek seferlik fotoğraf'**
  String get viewOncePhoto;

  /// No description provided for @tapToView.
  ///
  /// In tr, this message translates to:
  /// **'Görmek için dokun'**
  String get tapToView;

  /// No description provided for @photoOpened.
  ///
  /// In tr, this message translates to:
  /// **'Açıldı'**
  String get photoOpened;

  /// No description provided for @photoSent.
  ///
  /// In tr, this message translates to:
  /// **'Gönderildi'**
  String get photoSent;

  /// No description provided for @viewOnceHint.
  ///
  /// In tr, this message translates to:
  /// **'Fotoğraf bir kez açılabilir, sonra silinir.'**
  String get viewOnceHint;

  /// No description provided for @sendPhoto.
  ///
  /// In tr, this message translates to:
  /// **'Fotoğraf gönder'**
  String get sendPhoto;

  /// No description provided for @newMessageFrom.
  ///
  /// In tr, this message translates to:
  /// **'{name}: {text}'**
  String newMessageFrom(String name, String text);

  /// No description provided for @newMatchWith.
  ///
  /// In tr, this message translates to:
  /// **'Yeni eşleşme: {name} 💞'**
  String newMatchWith(String name);

  /// No description provided for @newRequestBanner.
  ///
  /// In tr, this message translates to:
  /// **'Yeni bir istek aldın'**
  String get newRequestBanner;

  /// No description provided for @view.
  ///
  /// In tr, this message translates to:
  /// **'Gör'**
  String get view;

  /// No description provided for @errAlreadyBoosted.
  ///
  /// In tr, this message translates to:
  /// **'Profilin zaten öne çıkarılmış.'**
  String get errAlreadyBoosted;

  /// No description provided for @errAlreadyViewed.
  ///
  /// In tr, this message translates to:
  /// **'Bu fotoğraf zaten açıldı.'**
  String get errAlreadyViewed;

  /// No description provided for @mostPopular.
  ///
  /// In tr, this message translates to:
  /// **'En popüler'**
  String get mostPopular;

  /// No description provided for @firstPurchaseBanner.
  ///
  /// In tr, this message translates to:
  /// **'İlk alımına %{pct} bonus jeton!'**
  String firstPurchaseBanner(int pct);

  /// No description provided for @bonusCoins.
  ///
  /// In tr, this message translates to:
  /// **'+{count} bonus'**
  String bonusCoins(int count);

  /// No description provided for @paymentProcessing.
  ///
  /// In tr, this message translates to:
  /// **'Ödemen işleniyor...'**
  String get paymentProcessing;

  /// No description provided for @purchaseDone.
  ///
  /// In tr, this message translates to:
  /// **'{count} jeton hesabına eklendi 🎉'**
  String purchaseDone(int count);

  /// No description provided for @txBonus.
  ///
  /// In tr, this message translates to:
  /// **'İlk alım bonusu'**
  String get txBonus;

  /// No description provided for @txClawback.
  ///
  /// In tr, this message translates to:
  /// **'İade (jeton geri alındı)'**
  String get txClawback;

  /// No description provided for @errStoreUnavailable.
  ///
  /// In tr, this message translates to:
  /// **'Mağazaya şu an ulaşılamıyor. Biraz sonra tekrar dene.'**
  String get errStoreUnavailable;

  /// No description provided for @perMinute.
  ///
  /// In tr, this message translates to:
  /// **'{count}/dk'**
  String perMinute(int count);

  /// No description provided for @startCallTitle.
  ///
  /// In tr, this message translates to:
  /// **'{kind} başlatılsın mı?'**
  String startCallTitle(String kind);

  /// No description provided for @startCallInfo.
  ///
  /// In tr, this message translates to:
  /// **'Dakika başı {rate} jeton. İlk dakika karşı taraf açınca düşer, bakiyen bitince arama kendiliğinden sonlanır.'**
  String startCallInfo(int rate);

  /// No description provided for @callAction.
  ///
  /// In tr, this message translates to:
  /// **'Ara'**
  String get callAction;

  /// No description provided for @calling.
  ///
  /// In tr, this message translates to:
  /// **'Aranıyor…'**
  String get calling;

  /// No description provided for @isCallingYou.
  ///
  /// In tr, this message translates to:
  /// **'seni arıyor'**
  String get isCallingYou;

  /// No description provided for @earnPerMinute.
  ///
  /// In tr, this message translates to:
  /// **'Dakika başı {rate} jeton kazanırsın'**
  String earnPerMinute(int rate);

  /// No description provided for @answer.
  ///
  /// In tr, this message translates to:
  /// **'Aç'**
  String get answer;

  /// No description provided for @decline.
  ///
  /// In tr, this message translates to:
  /// **'Reddet'**
  String get decline;

  /// No description provided for @spentCoins.
  ///
  /// In tr, this message translates to:
  /// **'Harcanan: {count}'**
  String spentCoins(int count);

  /// No description provided for @earnedCoins.
  ///
  /// In tr, this message translates to:
  /// **'Kazanılan: {count}'**
  String earnedCoins(int count);

  /// No description provided for @lowBalanceWarning.
  ///
  /// In tr, this message translates to:
  /// **'Bakiyen bir sonraki dakikaya yetmiyor, arama bu dakikanın sonunda bitecek.'**
  String get lowBalanceWarning;

  /// No description provided for @videoBlurred.
  ///
  /// In tr, this message translates to:
  /// **'Güvenliğin için görüntü bulanık başlar'**
  String get videoBlurred;

  /// No description provided for @revealVideo.
  ///
  /// In tr, this message translates to:
  /// **'Görüntüyü aç'**
  String get revealVideo;

  /// No description provided for @waitingVideo.
  ///
  /// In tr, this message translates to:
  /// **'Görüntü bekleniyor…'**
  String get waitingVideo;

  /// No description provided for @simulationMode.
  ///
  /// In tr, this message translates to:
  /// **'Test modu'**
  String get simulationMode;

  /// No description provided for @mute.
  ///
  /// In tr, this message translates to:
  /// **'Sessiz'**
  String get mute;

  /// No description provided for @camera.
  ///
  /// In tr, this message translates to:
  /// **'Kamera'**
  String get camera;

  /// No description provided for @flipCamera.
  ///
  /// In tr, this message translates to:
  /// **'Çevir'**
  String get flipCamera;

  /// No description provided for @speaker.
  ///
  /// In tr, this message translates to:
  /// **'Hoparlör'**
  String get speaker;

  /// No description provided for @gift.
  ///
  /// In tr, this message translates to:
  /// **'Hediye'**
  String get gift;

  /// No description provided for @endCall.
  ///
  /// In tr, this message translates to:
  /// **'Bitir'**
  String get endCall;

  /// No description provided for @sendGiftTitle.
  ///
  /// In tr, this message translates to:
  /// **'Hediye gönder'**
  String get sendGiftTitle;

  /// No description provided for @giftInfo.
  ///
  /// In tr, this message translates to:
  /// **'Jetonların tamamı karşı tarafa geçer.'**
  String get giftInfo;

  /// No description provided for @giftReceived.
  ///
  /// In tr, this message translates to:
  /// **'{emoji} hediye aldın! +{count} jeton'**
  String giftReceived(String emoji, int count);

  /// No description provided for @giftSent.
  ///
  /// In tr, this message translates to:
  /// **'{emoji} gönderildi'**
  String giftSent(String emoji);

  /// No description provided for @callEnded.
  ///
  /// In tr, this message translates to:
  /// **'Arama bitti'**
  String get callEnded;

  /// No description provided for @callEndedBalance.
  ///
  /// In tr, this message translates to:
  /// **'Bakiye bittiği için arama sona erdi.'**
  String get callEndedBalance;

  /// No description provided for @callEndedDisconnect.
  ///
  /// In tr, this message translates to:
  /// **'Bağlantı koptuğu için arama sona erdi.'**
  String get callEndedDisconnect;

  /// No description provided for @callMissed.
  ///
  /// In tr, this message translates to:
  /// **'Cevapsız arama'**
  String get callMissed;

  /// No description provided for @callNoAnswer.
  ///
  /// In tr, this message translates to:
  /// **'Cevap yok'**
  String get callNoAnswer;

  /// No description provided for @callDeclined.
  ///
  /// In tr, this message translates to:
  /// **'Arama reddedildi'**
  String get callDeclined;

  /// No description provided for @callCancelled.
  ///
  /// In tr, this message translates to:
  /// **'Arama iptal edildi'**
  String get callCancelled;

  /// No description provided for @rateCallTitle.
  ///
  /// In tr, this message translates to:
  /// **'Görüşme nasıldı?'**
  String get rateCallTitle;

  /// No description provided for @reportProblem.
  ///
  /// In tr, this message translates to:
  /// **'Sorun mu vardı? Bildir'**
  String get reportProblem;

  /// No description provided for @callHistory.
  ///
  /// In tr, this message translates to:
  /// **'Aramalar'**
  String get callHistory;

  /// No description provided for @noCallsYet.
  ///
  /// In tr, this message translates to:
  /// **'Henüz arama yok. Bir profilden sesli ya da görüntülü arama başlatabilirsin.'**
  String get noCallsYet;

  /// No description provided for @callBack.
  ///
  /// In tr, this message translates to:
  /// **'Geri ara'**
  String get callBack;

  /// No description provided for @missedCallFrom.
  ///
  /// In tr, this message translates to:
  /// **'Cevapsız arama: {name}'**
  String missedCallFrom(String name);

  /// No description provided for @errBusy.
  ///
  /// In tr, this message translates to:
  /// **'Şu an başka bir görüşmede, biraz sonra tekrar dene.'**
  String get errBusy;

  /// No description provided for @errAlreadyInCall.
  ///
  /// In tr, this message translates to:
  /// **'Zaten bir görüşmedesin.'**
  String get errAlreadyInCall;

  /// No description provided for @errCallGone.
  ///
  /// In tr, this message translates to:
  /// **'Bu arama artık geçerli değil.'**
  String get errCallGone;

  /// No description provided for @errCallerBalance.
  ///
  /// In tr, this message translates to:
  /// **'Arayanın bakiyesi yetmediği için arama başlamadı.'**
  String get errCallerBalance;

  /// No description provided for @txCall.
  ///
  /// In tr, this message translates to:
  /// **'Arama'**
  String get txCall;

  /// No description provided for @txGift.
  ///
  /// In tr, this message translates to:
  /// **'Hediye'**
  String get txGift;

  /// No description provided for @cashoutAvailable.
  ///
  /// In tr, this message translates to:
  /// **'Çekilebilir bakiye'**
  String get cashoutAvailable;

  /// No description provided for @cashoutMinInfo.
  ///
  /// In tr, this message translates to:
  /// **'En az {coins} jeton ({usd}) birikince çekebilirsin.'**
  String cashoutMinInfo(int coins, String usd);

  /// No description provided for @cashoutNeedVerify.
  ///
  /// In tr, this message translates to:
  /// **'Para çekmek için profilini mavi tikle doğrulaman gerekiyor. Bu, sahte hesaplara karşı seni ve kazancını korur.'**
  String get cashoutNeedVerify;

  /// No description provided for @cashoutAmount.
  ///
  /// In tr, this message translates to:
  /// **'Tutar'**
  String get cashoutAmount;

  /// No description provided for @cashoutMethod.
  ///
  /// In tr, this message translates to:
  /// **'Ödeme yöntemi'**
  String get cashoutMethod;

  /// No description provided for @accountHolder.
  ///
  /// In tr, this message translates to:
  /// **'Hesap sahibinin adı soyadı'**
  String get accountHolder;

  /// No description provided for @paypalEmail.
  ///
  /// In tr, this message translates to:
  /// **'PayPal e-postası'**
  String get paypalEmail;

  /// No description provided for @cashoutSubmit.
  ///
  /// In tr, this message translates to:
  /// **'Talep gönder · {usd}'**
  String cashoutSubmit(String usd);

  /// No description provided for @cashoutProcessingInfo.
  ///
  /// In tr, this message translates to:
  /// **'Ödemeler 3–5 iş günü içinde yapılır. Talep incelenirken iptal edebilirsin.'**
  String get cashoutProcessingInfo;

  /// No description provided for @cashoutRequested.
  ///
  /// In tr, this message translates to:
  /// **'Talebin alındı 👍'**
  String get cashoutRequested;

  /// No description provided for @cashoutNotEnough.
  ///
  /// In tr, this message translates to:
  /// **'Çekilebilir bakiyen henüz {coins} jetona ulaşmadı. Aramalar ve kabul ettiğin isteklerle kazanmaya devam et!'**
  String cashoutNotEnough(int coins);

  /// No description provided for @payoutStatusPending.
  ///
  /// In tr, this message translates to:
  /// **'İnceleniyor'**
  String get payoutStatusPending;

  /// No description provided for @payoutStatusPaid.
  ///
  /// In tr, this message translates to:
  /// **'Ödendi'**
  String get payoutStatusPaid;

  /// No description provided for @payoutStatusRejected.
  ///
  /// In tr, this message translates to:
  /// **'Reddedildi'**
  String get payoutStatusRejected;

  /// No description provided for @payoutStatusCancelled.
  ///
  /// In tr, this message translates to:
  /// **'İptal edildi'**
  String get payoutStatusCancelled;

  /// No description provided for @payoutCancel.
  ///
  /// In tr, this message translates to:
  /// **'Talebi iptal et'**
  String get payoutCancel;

  /// No description provided for @payoutCancelled.
  ///
  /// In tr, this message translates to:
  /// **'Talep iptal edildi, jetonlar geri eklendi.'**
  String get payoutCancelled;

  /// No description provided for @payoutHistory.
  ///
  /// In tr, this message translates to:
  /// **'Talepler'**
  String get payoutHistory;

  /// No description provided for @payoutReason.
  ///
  /// In tr, this message translates to:
  /// **'Sebep: {reason}'**
  String payoutReason(String reason);

  /// No description provided for @payoutReference.
  ///
  /// In tr, this message translates to:
  /// **'İşlem no: {ref}'**
  String payoutReference(String ref);

  /// No description provided for @errVerificationRequired.
  ///
  /// In tr, this message translates to:
  /// **'Önce profilini mavi tikle doğrulamalısın.'**
  String get errVerificationRequired;

  /// No description provided for @errBelowMinimum.
  ///
  /// In tr, this message translates to:
  /// **'Tutar alt sınırın altında.'**
  String get errBelowMinimum;

  /// No description provided for @errInsufficientCashable.
  ///
  /// In tr, this message translates to:
  /// **'Çekilebilir bakiyen bu tutar için yetmiyor.'**
  String get errInsufficientCashable;

  /// No description provided for @errInvalidIban.
  ///
  /// In tr, this message translates to:
  /// **'IBAN geçersiz görünüyor, kontrol edip tekrar dene.'**
  String get errInvalidIban;

  /// No description provided for @errAccountNameRequired.
  ///
  /// In tr, this message translates to:
  /// **'Hesap sahibinin adını yaz.'**
  String get errAccountNameRequired;

  /// No description provided for @errPayoutPending.
  ///
  /// In tr, this message translates to:
  /// **'Zaten incelenen bir talebin var.'**
  String get errPayoutPending;

  /// No description provided for @txCashoutRefund.
  ///
  /// In tr, this message translates to:
  /// **'Para çekme iadesi'**
  String get txCashoutRefund;

  /// No description provided for @errInvalidImage.
  ///
  /// In tr, this message translates to:
  /// **'Bu fotoğraf biçimi desteklenmiyor. JPG, PNG, WEBP veya HEIC seç.'**
  String get errInvalidImage;

  /// No description provided for @errAlreadyRated.
  ///
  /// In tr, this message translates to:
  /// **'Bu görüşmeyi zaten puanladın.'**
  String get errAlreadyRated;

  /// No description provided for @errPayoutProcessed.
  ///
  /// In tr, this message translates to:
  /// **'Bu talep zaten işleme alınmış.'**
  String get errPayoutProcessed;

  /// No description provided for @errNotFound.
  ///
  /// In tr, this message translates to:
  /// **'Aradığın içerik bulunamadı. Silinmiş veya artık erişilemiyor olabilir.'**
  String get errNotFound;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'tr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'tr':
      return AppLocalizationsTr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
