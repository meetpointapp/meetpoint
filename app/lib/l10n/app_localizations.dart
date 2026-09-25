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

  /// No description provided for @sendFailedRetry.
  ///
  /// In tr, this message translates to:
  /// **'Gönderilemedi, tekrar denemek için dokun'**
  String get sendFailedRetry;

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
  /// **'Satın alınmış jetonlarla sana ödenen kazançlar paraya çevrilebilir.'**
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
  /// **'Hesabın hemen gizlenir ve oturumların kapanır. 30 gün içinde giriş yaparsan hesabın geri gelir; sonra profilin, fotoğrafların, eşleşmelerin, mesajların ve jeton bakiyen kalıcı olarak silinir.'**
  String get deleteAccountWarning;

  /// No description provided for @confirmWithPassword.
  ///
  /// In tr, this message translates to:
  /// **'Onaylamak için şifreni gir'**
  String get confirmWithPassword;

  /// No description provided for @accountDeleted.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın silinmek üzere kapatıldı. 30 gün içinde giriş yaparsan geri gelir.'**
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

  /// No description provided for @weakConnectionWarning.
  ///
  /// In tr, this message translates to:
  /// **'Bağlantın zayıf, ses veya görüntü kesilebilir.'**
  String get weakConnectionWarning;

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

  /// No description provided for @callEndedConnectFailed.
  ///
  /// In tr, this message translates to:
  /// **'Bağlantı kurulamadı, ücret alınmadı.'**
  String get callEndedConnectFailed;

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

  /// No description provided for @disputeCall.
  ///
  /// In tr, this message translates to:
  /// **'Ücrete itiraz et'**
  String get disputeCall;

  /// No description provided for @disputeCallTitle.
  ///
  /// In tr, this message translates to:
  /// **'Bu arama için itiraz'**
  String get disputeCallTitle;

  /// No description provided for @disputeCallHint.
  ///
  /// In tr, this message translates to:
  /// **'Onaylanırsa alınan ücret iade edilir. Panel inceler, sonucu bildiriminden görürsün.'**
  String get disputeCallHint;

  /// No description provided for @disputeWrongAmount.
  ///
  /// In tr, this message translates to:
  /// **'Yanlış tutar alındı'**
  String get disputeWrongAmount;

  /// No description provided for @disputeNoConnection.
  ///
  /// In tr, this message translates to:
  /// **'Hiç bağlanamadık'**
  String get disputeNoConnection;

  /// No description provided for @disputeDisconnected.
  ///
  /// In tr, this message translates to:
  /// **'Bağlantı koptu ama ücretlendirildim'**
  String get disputeDisconnected;

  /// No description provided for @disputeOther.
  ///
  /// In tr, this message translates to:
  /// **'Diğer'**
  String get disputeOther;

  /// No description provided for @disputeSent.
  ///
  /// In tr, this message translates to:
  /// **'İtirazın alındı, incelenecek.'**
  String get disputeSent;

  /// No description provided for @disputePending.
  ///
  /// In tr, this message translates to:
  /// **'İtiraz inceleniyor'**
  String get disputePending;

  /// No description provided for @disputeApproved.
  ///
  /// In tr, this message translates to:
  /// **'İtiraz onaylandı, iade edildi'**
  String get disputeApproved;

  /// No description provided for @disputeRejected.
  ///
  /// In tr, this message translates to:
  /// **'İtiraz reddedildi'**
  String get disputeRejected;

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

  /// No description provided for @errAlreadyDisputed.
  ///
  /// In tr, this message translates to:
  /// **'Bu arama için zaten itiraz açtın.'**
  String get errAlreadyDisputed;

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

  /// No description provided for @promoEarnings.
  ///
  /// In tr, this message translates to:
  /// **'Bonus jetonlardan kazanç: {count}'**
  String promoEarnings(int count);

  /// No description provided for @promoEarningsInfo.
  ///
  /// In tr, this message translates to:
  /// **'Bonus ve hediye jetonlarıyla yapılan ödemelerden gelir. Uygulamada harcayabilirsin, paraya çevrilemez.'**
  String get promoEarningsInfo;

  /// No description provided for @errRequestInProgress.
  ///
  /// In tr, this message translates to:
  /// **'İsteğin hâlâ işleniyor, birkaç saniye sonra tekrar dene.'**
  String get errRequestInProgress;

  /// No description provided for @errPasswordTooCommon.
  ///
  /// In tr, this message translates to:
  /// **'Bu şifre çok yaygın ve kolay tahmin edilir. Daha güçlü bir şifre seç.'**
  String get errPasswordTooCommon;

  /// No description provided for @errPasswordBreached.
  ///
  /// In tr, this message translates to:
  /// **'Bu şifre bilinen bir veri sızıntısında yer alıyor. Güvenliğin için başka bir şifre seç.'**
  String get errPasswordBreached;

  /// No description provided for @errPasswordSame.
  ///
  /// In tr, this message translates to:
  /// **'Yeni şifre mevcut şifrenle aynı olamaz.'**
  String get errPasswordSame;

  /// No description provided for @errAccountLocked.
  ///
  /// In tr, this message translates to:
  /// **'Çok fazla hatalı deneme yapıldı. Güvenliğin için 15 dakika sonra tekrar dene.'**
  String get errAccountLocked;

  /// No description provided for @errTooManyAccounts.
  ///
  /// In tr, this message translates to:
  /// **'Bu cihazdan kısa sürede çok fazla hesap açıldı.'**
  String get errTooManyAccounts;

  /// No description provided for @errCaptcha.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik doğrulaması tamamlanamadı. Tekrar dene.'**
  String get errCaptcha;

  /// No description provided for @devicesTitle.
  ///
  /// In tr, this message translates to:
  /// **'Cihazlarım'**
  String get devicesTitle;

  /// No description provided for @devicesSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Hesabının açık olduğu cihazlar. Tanımadığın bir cihaz görürsen oturumunu kapat ve şifreni değiştir.'**
  String get devicesSubtitle;

  /// No description provided for @thisDevice.
  ///
  /// In tr, this message translates to:
  /// **'Bu cihaz'**
  String get thisDevice;

  /// No description provided for @lastActive.
  ///
  /// In tr, this message translates to:
  /// **'Son etkinlik: {time}'**
  String lastActive(String time);

  /// No description provided for @signOutDevice.
  ///
  /// In tr, this message translates to:
  /// **'Çıkış yaptır'**
  String get signOutDevice;

  /// No description provided for @signOutOthers.
  ///
  /// In tr, this message translates to:
  /// **'Diğer tüm cihazlardan çıkış yap'**
  String get signOutOthers;

  /// No description provided for @signOutOthersConfirm.
  ///
  /// In tr, this message translates to:
  /// **'Bu cihaz dışındaki tüm oturumların kapatılacak.'**
  String get signOutOthersConfirm;

  /// No description provided for @deviceSignedOut.
  ///
  /// In tr, this message translates to:
  /// **'Cihazın oturumu kapatıldı'**
  String get deviceSignedOut;

  /// No description provided for @othersSignedOut.
  ///
  /// In tr, this message translates to:
  /// **'Diğer cihazlardan çıkış yapıldı'**
  String get othersSignedOut;

  /// No description provided for @changePassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifre değiştir'**
  String get changePassword;

  /// No description provided for @currentPassword.
  ///
  /// In tr, this message translates to:
  /// **'Mevcut şifre'**
  String get currentPassword;

  /// No description provided for @changePasswordNote.
  ///
  /// In tr, this message translates to:
  /// **'Şifren değişince bu cihaz dışındaki tüm oturumların kapanır.'**
  String get changePasswordNote;

  /// No description provided for @passwordChanged.
  ///
  /// In tr, this message translates to:
  /// **'Şifren değiştirildi, diğer cihazlardan çıkış yapıldı.'**
  String get passwordChanged;

  /// No description provided for @accountRestored.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın geri yüklendi, silme talebin iptal edildi.'**
  String get accountRestored;

  /// No description provided for @privacyAndData.
  ///
  /// In tr, this message translates to:
  /// **'Gizlilik ve verilerim'**
  String get privacyAndData;

  /// No description provided for @myConsents.
  ///
  /// In tr, this message translates to:
  /// **'Açık rızalarım'**
  String get myConsents;

  /// No description provided for @myData.
  ///
  /// In tr, this message translates to:
  /// **'Verilerim'**
  String get myData;

  /// No description provided for @legalTexts.
  ///
  /// In tr, this message translates to:
  /// **'Metinler'**
  String get legalTexts;

  /// No description provided for @retentionPolicy.
  ///
  /// In tr, this message translates to:
  /// **'Saklama ve imha politikası'**
  String get retentionPolicy;

  /// No description provided for @readConsentText.
  ///
  /// In tr, this message translates to:
  /// **'Metni oku'**
  String get readConsentText;

  /// No description provided for @giveConsent.
  ///
  /// In tr, this message translates to:
  /// **'Rıza veriyorum'**
  String get giveConsent;

  /// No description provided for @notNow.
  ///
  /// In tr, this message translates to:
  /// **'Şimdi değil'**
  String get notNow;

  /// No description provided for @consentSpecialTitle.
  ///
  /// In tr, this message translates to:
  /// **'Eşleştirme için yönelim bilgisi'**
  String get consentSpecialTitle;

  /// No description provided for @consentSpecialText.
  ///
  /// In tr, this message translates to:
  /// **'Kimi görmek istediğin, sana uygun kişileri göstermek için kullanılır.'**
  String get consentSpecialText;

  /// No description provided for @consentSpecialAsk.
  ///
  /// In tr, this message translates to:
  /// **'Kimi görmek istediğin özel nitelikli bir veridir; eşleştirme için açık rızan gerekir.'**
  String get consentSpecialAsk;

  /// No description provided for @consentSpecialOnboarding.
  ///
  /// In tr, this message translates to:
  /// **'Kimi görmek istediğim bilgisinin (cinsel yönelim) eşleştirme için işlenmesine açık rıza veriyorum.'**
  String get consentSpecialOnboarding;

  /// No description provided for @consentOverseasTitle.
  ///
  /// In tr, this message translates to:
  /// **'Arama ve bildirimler'**
  String get consentOverseasTitle;

  /// No description provided for @consentOverseasText.
  ///
  /// In tr, this message translates to:
  /// **'Sesli/görüntülü arama ve telefon bildirimleri yurt dışındaki sunuculardan geçer.'**
  String get consentOverseasText;

  /// No description provided for @consentOverseasAsk.
  ///
  /// In tr, this message translates to:
  /// **'Aramalar yurt dışındaki bir hizmet (Agora) üzerinden yapılır. Arama yapıp alabilmen için bu aktarıma açık rızan gerekir. Ses ve görüntü kaydedilmez.'**
  String get consentOverseasAsk;

  /// No description provided for @consentOverseasRegister.
  ///
  /// In tr, this message translates to:
  /// **'Sesli/görüntülü arama ve bildirimler için verilerimin yurt dışına aktarılmasına açık rıza veriyorum (isteğe bağlı).'**
  String get consentOverseasRegister;

  /// No description provided for @consentSelfieTitle.
  ///
  /// In tr, this message translates to:
  /// **'Mavi tik selfie\'si'**
  String get consentSelfieTitle;

  /// No description provided for @consentSelfieText.
  ///
  /// In tr, this message translates to:
  /// **'Doğrulama için çektiğin selfie sadece ekibimizce, elle incelenir.'**
  String get consentSelfieText;

  /// No description provided for @consentSelfieAsk.
  ///
  /// In tr, this message translates to:
  /// **'Mavi tik için belirli bir pozla selfie çekeceksin. Selfie\'n sadece doğrulama ekibimizce incelenir, kimseye gösterilmez; rızanı geri alınca silinir.'**
  String get consentSelfieAsk;

  /// No description provided for @consentMarketingTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kampanya e-postaları'**
  String get consentMarketingTitle;

  /// No description provided for @consentMarketingText.
  ///
  /// In tr, this message translates to:
  /// **'İndirim ve yeni özellik duyuruları.'**
  String get consentMarketingText;

  /// No description provided for @consentMarketingRegister.
  ///
  /// In tr, this message translates to:
  /// **'Kampanya ve duyuru e-postaları almak istiyorum (isteğe bağlı).'**
  String get consentMarketingRegister;

  /// No description provided for @revokeConsentTitle.
  ///
  /// In tr, this message translates to:
  /// **'Rızanı geri almak istiyor musun?'**
  String get revokeConsentTitle;

  /// No description provided for @revokeConsent.
  ///
  /// In tr, this message translates to:
  /// **'Geri al'**
  String get revokeConsent;

  /// No description provided for @revokeSpecialWarning.
  ///
  /// In tr, this message translates to:
  /// **'Profilin keşfetten kalkar, keşfet ve beğeniler kullanılamaz. Var olan sohbetlerin sürer.'**
  String get revokeSpecialWarning;

  /// No description provided for @revokeOverseasWarning.
  ///
  /// In tr, this message translates to:
  /// **'Arama yapamaz ve alamazsın, telefon bildirimi almazsın.'**
  String get revokeOverseasWarning;

  /// No description provided for @revokeSelfieWarning.
  ///
  /// In tr, this message translates to:
  /// **'Saklanan selfie\'lerin silinir; bekleyen mavi tik başvurun iptal edilir. Mavi tikin varsa kalır.'**
  String get revokeSelfieWarning;

  /// No description provided for @dataExportTitle.
  ///
  /// In tr, this message translates to:
  /// **'Verilerimi indir'**
  String get dataExportTitle;

  /// No description provided for @dataExportSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Tüm verilerinin bir kopyası e-postana bağlantı olarak gelir.'**
  String get dataExportSubtitle;

  /// No description provided for @dataExportAction.
  ///
  /// In tr, this message translates to:
  /// **'İste'**
  String get dataExportAction;

  /// No description provided for @dataExportRequested.
  ///
  /// In tr, this message translates to:
  /// **'Talebin alındı. Hazır olunca e-postana bağlantı gelecek.'**
  String get dataExportRequested;

  /// No description provided for @dataExportPreparing.
  ///
  /// In tr, this message translates to:
  /// **'Hazırlanıyor… Hazır olunca e-postana gelecek.'**
  String get dataExportPreparing;

  /// No description provided for @dataExportReady.
  ///
  /// In tr, this message translates to:
  /// **'E-postana gönderildi ({date} tarihine kadar geçerli).'**
  String dataExportReady(String date);

  /// No description provided for @dataExportNextAt.
  ///
  /// In tr, this message translates to:
  /// **'Bir sonraki talep: {date}'**
  String dataExportNextAt(String date);

  /// No description provided for @kvkkRequestTitle.
  ///
  /// In tr, this message translates to:
  /// **'KVKK başvurusu'**
  String get kvkkRequestTitle;

  /// No description provided for @kvkkRequestSubtitle.
  ///
  /// In tr, this message translates to:
  /// **'Bilgi, düzeltme, silme veya itiraz talebi'**
  String get kvkkRequestSubtitle;

  /// No description provided for @kvkkRequestInfo.
  ///
  /// In tr, this message translates to:
  /// **'Başvurun en geç 30 gün içinde yanıtlanır; yanıt e-postana ve buraya gelir.'**
  String get kvkkRequestInfo;

  /// No description provided for @kvkkRequestHint.
  ///
  /// In tr, this message translates to:
  /// **'Talebini yaz (en az 10 karakter)'**
  String get kvkkRequestHint;

  /// No description provided for @kvkkRequestSent.
  ///
  /// In tr, this message translates to:
  /// **'Başvurun alındı.'**
  String get kvkkRequestSent;

  /// No description provided for @kvkkRequestPending.
  ///
  /// In tr, this message translates to:
  /// **'İnceleniyor · son gün {date}'**
  String kvkkRequestPending(String date);

  /// No description provided for @kvkkMyRequests.
  ///
  /// In tr, this message translates to:
  /// **'Başvurularım'**
  String get kvkkMyRequests;

  /// No description provided for @kvkkKindInfo.
  ///
  /// In tr, this message translates to:
  /// **'Bilgi talebi'**
  String get kvkkKindInfo;

  /// No description provided for @kvkkKindCorrection.
  ///
  /// In tr, this message translates to:
  /// **'Düzeltme'**
  String get kvkkKindCorrection;

  /// No description provided for @kvkkKindDeletion.
  ///
  /// In tr, this message translates to:
  /// **'Silme'**
  String get kvkkKindDeletion;

  /// No description provided for @kvkkKindObjection.
  ///
  /// In tr, this message translates to:
  /// **'İtiraz'**
  String get kvkkKindObjection;

  /// No description provided for @kvkkKindOther.
  ///
  /// In tr, this message translates to:
  /// **'Diğer'**
  String get kvkkKindOther;

  /// No description provided for @reconsentTitle.
  ///
  /// In tr, this message translates to:
  /// **'Metinlerimizi güncelledik'**
  String get reconsentTitle;

  /// No description provided for @reconsentBody.
  ///
  /// In tr, this message translates to:
  /// **'Devam etmek için güncellenen metinleri okuyup onaylaman gerekiyor. Onaylamak istemezsen verilerini indirebilir veya hesabını silebilirsin.'**
  String get reconsentBody;

  /// No description provided for @reconsentAccept.
  ///
  /// In tr, this message translates to:
  /// **'Okudum, kabul ediyorum'**
  String get reconsentAccept;

  /// No description provided for @errConsentRequired.
  ///
  /// In tr, this message translates to:
  /// **'Bu özellik için açık rızan gerekiyor.'**
  String get errConsentRequired;

  /// No description provided for @errPeerCallsDisabled.
  ///
  /// In tr, this message translates to:
  /// **'Bu kişi aramaları kapatmış.'**
  String get errPeerCallsDisabled;

  /// No description provided for @errExportCooldown.
  ///
  /// In tr, this message translates to:
  /// **'Verilerini ayda bir indirebilirsin.'**
  String get errExportCooldown;

  /// No description provided for @contactWarningSender.
  ///
  /// In tr, this message translates to:
  /// **'İletişim bilgisi paylaştın. Güvenliğin için para, IBAN veya uygulama dışında görüşme isteyenlere dikkat et.'**
  String get contactWarningSender;

  /// No description provided for @contactSafetyTip.
  ///
  /// In tr, this message translates to:
  /// **'İletişim bilgisi paylaşıldı. Para isteyen veya seni uygulama dışına çağıran kişilere dikkat et.'**
  String get contactSafetyTip;

  /// No description provided for @photoUnderReview.
  ///
  /// In tr, this message translates to:
  /// **'İncelemede'**
  String get photoUnderReview;

  /// No description provided for @callRulesReminder.
  ///
  /// In tr, this message translates to:
  /// **'Saygılı ol: çıplaklık, taciz ve para isteme yasaktır. Rahatsız olursan aramadaki bayrakla bildirip kapatabilirsin.'**
  String get callRulesReminder;

  /// No description provided for @reportAndEnd.
  ///
  /// In tr, this message translates to:
  /// **'Bildir ve kapat'**
  String get reportAndEnd;

  /// No description provided for @reportAndEndTitle.
  ///
  /// In tr, this message translates to:
  /// **'Neden bildiriyorsun? Arama hemen kapanır.'**
  String get reportAndEndTitle;

  /// No description provided for @safetyCenter.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik merkezi'**
  String get safetyCenter;

  /// No description provided for @errRestricted.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın geçici olarak kısıtlı. Bu sürede mesaj, beğeni, istek ve arama yapamazsın.'**
  String get errRestricted;

  /// No description provided for @errAlreadyAppealed.
  ///
  /// In tr, this message translates to:
  /// **'Bu karara zaten itiraz ettin.'**
  String get errAlreadyAppealed;

  /// No description provided for @sanctionWarningTitle.
  ///
  /// In tr, this message translates to:
  /// **'Uyarı aldın'**
  String get sanctionWarningTitle;

  /// No description provided for @sanctionRestrictTitle.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın kısıtlandı'**
  String get sanctionRestrictTitle;

  /// No description provided for @sanctionBanTitle.
  ///
  /// In tr, this message translates to:
  /// **'Hesabın kapatıldı'**
  String get sanctionBanTitle;

  /// No description provided for @sanctionReason.
  ///
  /// In tr, this message translates to:
  /// **'Sebep: {reason}'**
  String sanctionReason(String reason);

  /// No description provided for @sanctionUntil.
  ///
  /// In tr, this message translates to:
  /// **'{date} tarihine kadar mesaj, beğeni, istek ve arama yapamazsın.'**
  String sanctionUntil(String date);

  /// No description provided for @sanctionWarningBody.
  ///
  /// In tr, this message translates to:
  /// **'Topluluk kurallarımıza aykırı bir davranış tespit edildi. Tekrarı hâlinde hesabın kısıtlanabilir.'**
  String get sanctionWarningBody;

  /// No description provided for @sanctionAppealed.
  ///
  /// In tr, this message translates to:
  /// **'İtirazın inceleniyor.'**
  String get sanctionAppealed;

  /// No description provided for @appeal.
  ///
  /// In tr, this message translates to:
  /// **'İtiraz et'**
  String get appeal;

  /// No description provided for @appealHint.
  ///
  /// In tr, this message translates to:
  /// **'Neden yanlış olduğunu düşünüyorsun? (en az 10 karakter)'**
  String get appealHint;

  /// No description provided for @appealSent.
  ///
  /// In tr, this message translates to:
  /// **'İtirazın alındı; sonucu e-postayla bildirilecek.'**
  String get appealSent;

  /// No description provided for @understood.
  ///
  /// In tr, this message translates to:
  /// **'Anladım'**
  String get understood;

  /// No description provided for @reasonFake.
  ///
  /// In tr, this message translates to:
  /// **'Sahte profil'**
  String get reasonFake;

  /// No description provided for @reasonInappropriate.
  ///
  /// In tr, this message translates to:
  /// **'Uygunsuz içerik'**
  String get reasonInappropriate;

  /// No description provided for @reasonHarassment.
  ///
  /// In tr, this message translates to:
  /// **'Taciz'**
  String get reasonHarassment;

  /// No description provided for @reasonScam.
  ///
  /// In tr, this message translates to:
  /// **'Dolandırıcılık'**
  String get reasonScam;

  /// No description provided for @reasonUnderage.
  ///
  /// In tr, this message translates to:
  /// **'18 yaş altı'**
  String get reasonUnderage;

  /// No description provided for @reasonSpam.
  ///
  /// In tr, this message translates to:
  /// **'Toplu / istenmeyen mesaj'**
  String get reasonSpam;

  /// No description provided for @reasonReportBurst.
  ///
  /// In tr, this message translates to:
  /// **'Kısa sürede birden çok şikayet'**
  String get reasonReportBurst;

  /// No description provided for @reasonOther.
  ///
  /// In tr, this message translates to:
  /// **'Diğer'**
  String get reasonOther;

  /// No description provided for @maturingEarnings.
  ///
  /// In tr, this message translates to:
  /// **'{coins} jeton olgunlaşıyor · ilki {date} tarihinde bozdurulabilir'**
  String maturingEarnings(int coins, String date);

  /// No description provided for @maturingInfo.
  ///
  /// In tr, this message translates to:
  /// **'Yeni kazançlar iade süresi nedeniyle {days} gün sonra bozdurulabilir.'**
  String maturingInfo(int days);

  /// No description provided for @accountHolderMustMatch.
  ///
  /// In tr, this message translates to:
  /// **'Kimliğinde yazan adla aynı olmalı'**
  String get accountHolderMustMatch;

  /// No description provided for @cashoutNetAfterTax.
  ///
  /// In tr, this message translates to:
  /// **'Stopaj (%{rate}) sonrası net: {net}'**
  String cashoutNetAfterTax(String net, String rate);

  /// No description provided for @earningsStatement.
  ///
  /// In tr, this message translates to:
  /// **'Yıllık kazanç dökümü'**
  String get earningsStatement;

  /// No description provided for @earningsStatementBody.
  ///
  /// In tr, this message translates to:
  /// **'{year} yılı\nKazanılan jeton: {coins}\nÖdeme sayısı: {count}\nBrüt: {gross}\nStopaj: {tax}\nNet ödenen: {net}'**
  String earningsStatementBody(
    int year,
    int coins,
    int count,
    String gross,
    String tax,
    String net,
  );

  /// No description provided for @kycTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kimlik doğrulama'**
  String get kycTitle;

  /// No description provided for @kycInfo.
  ///
  /// In tr, this message translates to:
  /// **'Kazancını doğru kişiye ödeyebilmemiz için bir kez kimliğini doğruluyoruz. Bilgilerin şifreli saklanır ve sadece yetkili finans ekibimiz görür.'**
  String get kycInfo;

  /// No description provided for @kycFullName.
  ///
  /// In tr, this message translates to:
  /// **'Ad soyad (kimlikteki gibi)'**
  String get kycFullName;

  /// No description provided for @kycTcNo.
  ///
  /// In tr, this message translates to:
  /// **'TC kimlik numarası'**
  String get kycTcNo;

  /// No description provided for @kycDocument.
  ///
  /// In tr, this message translates to:
  /// **'Kimlik kartının ön yüzü'**
  String get kycDocument;

  /// No description provided for @kycPickDocument.
  ///
  /// In tr, this message translates to:
  /// **'Fotoğraf seç'**
  String get kycPickDocument;

  /// No description provided for @kycSubmit.
  ///
  /// In tr, this message translates to:
  /// **'Doğrulamaya gönder'**
  String get kycSubmit;

  /// No description provided for @kycSent.
  ///
  /// In tr, this message translates to:
  /// **'Kimlik bilgilerin incelemeye gönderildi.'**
  String get kycSent;

  /// No description provided for @kycPending.
  ///
  /// In tr, this message translates to:
  /// **'Kimlik bilgilerin inceleniyor. Sonuç e-postayla gelecek.'**
  String get kycPending;

  /// No description provided for @kycRejected.
  ///
  /// In tr, this message translates to:
  /// **'Kimlik doğrulaman onaylanmadı. Bilgilerini kontrol edip tekrar gönderebilirsin.'**
  String get kycRejected;

  /// No description provided for @errKycRequired.
  ///
  /// In tr, this message translates to:
  /// **'Para çekmek için önce kimliğini doğrulamalısın.'**
  String get errKycRequired;

  /// No description provided for @errKycPending.
  ///
  /// In tr, this message translates to:
  /// **'Kimlik doğrulaman zaten inceleniyor.'**
  String get errKycPending;

  /// No description provided for @errKycApproved.
  ///
  /// In tr, this message translates to:
  /// **'Kimliğin zaten doğrulanmış.'**
  String get errKycApproved;

  /// No description provided for @errInvalidTc.
  ///
  /// In tr, this message translates to:
  /// **'TC kimlik numarası geçersiz.'**
  String get errInvalidTc;

  /// No description provided for @errTcInUse.
  ///
  /// In tr, this message translates to:
  /// **'Bu TC kimlik numarasıyla başka bir hesap doğrulanmış.'**
  String get errTcInUse;

  /// No description provided for @errFullNameRequired.
  ///
  /// In tr, this message translates to:
  /// **'Adını ve soyadını kimliğindeki gibi yaz.'**
  String get errFullNameRequired;

  /// No description provided for @errAccountNameMismatch.
  ///
  /// In tr, this message translates to:
  /// **'IBAN sahibi, kimliği doğrulanan kişiyle aynı olmalı.'**
  String get errAccountNameMismatch;

  /// No description provided for @salesTermsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Satın almadan önce'**
  String get salesTermsTitle;

  /// No description provided for @salesTermsUpdatedTitle.
  ///
  /// In tr, this message translates to:
  /// **'Satış koşulları güncellendi'**
  String get salesTermsUpdatedTitle;

  /// No description provided for @salesTermsIntro.
  ///
  /// In tr, this message translates to:
  /// **'Jetonlar dijital içeriktir ve ödeme onaylanır onaylanmaz hesabına yüklenir. Bu yüzden satın aldıktan sonra cayma hakkı kullanılamaz. Bu onayı bir kez verirsin.'**
  String get salesTermsIntro;

  /// No description provided for @preInfoForm.
  ///
  /// In tr, this message translates to:
  /// **'Ön Bilgilendirme Formu'**
  String get preInfoForm;

  /// No description provided for @distanceSalesContract.
  ///
  /// In tr, this message translates to:
  /// **'Mesafeli Satış Sözleşmesi'**
  String get distanceSalesContract;

  /// No description provided for @salesTermsCheckboxA.
  ///
  /// In tr, this message translates to:
  /// **''**
  String get salesTermsCheckboxA;

  /// No description provided for @salesTermsCheckboxAnd.
  ///
  /// In tr, this message translates to:
  /// **' ve '**
  String get salesTermsCheckboxAnd;

  /// No description provided for @salesTermsCheckboxB.
  ///
  /// In tr, this message translates to:
  /// **'\'ni okudum, onaylıyorum. Jetonların hemen hesabıma yüklenmesini istiyorum ve bu nedenle cayma hakkımın olmadığını kabul ediyorum.'**
  String get salesTermsCheckboxB;

  /// No description provided for @salesTermsAccept.
  ///
  /// In tr, this message translates to:
  /// **'Onayla ve devam et'**
  String get salesTermsAccept;

  /// No description provided for @salesTermsLineA.
  ///
  /// In tr, this message translates to:
  /// **'Satın alma '**
  String get salesTermsLineA;

  /// No description provided for @salesTermsLineB.
  ///
  /// In tr, this message translates to:
  /// **'\'ne tabidir · Dijital içerik: cayma hakkı yoktur · Jetonların süresi dolmaz'**
  String get salesTermsLineB;

  /// No description provided for @supportAboutEntry.
  ///
  /// In tr, this message translates to:
  /// **'Bu işlemle ilgili yardım al'**
  String get supportAboutEntry;

  /// No description provided for @helpAndSupport.
  ///
  /// In tr, this message translates to:
  /// **'Yardım ve destek'**
  String get helpAndSupport;

  /// No description provided for @helpSearchHint.
  ///
  /// In tr, this message translates to:
  /// **'Ne arıyorsun? (ör. arama ücreti)'**
  String get helpSearchHint;

  /// No description provided for @helpNoResults.
  ///
  /// In tr, this message translates to:
  /// **'Sonuç bulunamadı. Farklı kelimelerle dene ya da bize yaz.'**
  String get helpNoResults;

  /// No description provided for @helpStillNeed.
  ///
  /// In tr, this message translates to:
  /// **'Cevabını bulamadın mı?'**
  String get helpStillNeed;

  /// No description provided for @contactSupport.
  ///
  /// In tr, this message translates to:
  /// **'Bize yaz'**
  String get contactSupport;

  /// No description provided for @imprint.
  ///
  /// In tr, this message translates to:
  /// **'Künye'**
  String get imprint;

  /// No description provided for @myTickets.
  ///
  /// In tr, this message translates to:
  /// **'Destek taleplerim'**
  String get myTickets;

  /// No description provided for @newTicket.
  ///
  /// In tr, this message translates to:
  /// **'Yeni talep'**
  String get newTicket;

  /// No description provided for @noTickets.
  ///
  /// In tr, this message translates to:
  /// **'Henüz destek talebin yok.'**
  String get noTickets;

  /// No description provided for @supportTicket.
  ///
  /// In tr, this message translates to:
  /// **'Destek talebi'**
  String get supportTicket;

  /// No description provided for @ticketOpen.
  ///
  /// In tr, this message translates to:
  /// **'Yanıt bekliyor'**
  String get ticketOpen;

  /// No description provided for @ticketAnswered.
  ///
  /// In tr, this message translates to:
  /// **'Yanıtlandı'**
  String get ticketAnswered;

  /// No description provided for @ticketClosed.
  ///
  /// In tr, this message translates to:
  /// **'Kapandı'**
  String get ticketClosed;

  /// No description provided for @ticketSent.
  ///
  /// In tr, this message translates to:
  /// **'Talebin alındı, en kısa sürede dönüyoruz.'**
  String get ticketSent;

  /// No description provided for @ticketCategory.
  ///
  /// In tr, this message translates to:
  /// **'Konu ne hakkında?'**
  String get ticketCategory;

  /// No description provided for @ticketSubject.
  ///
  /// In tr, this message translates to:
  /// **'Başlık'**
  String get ticketSubject;

  /// No description provided for @ticketBodyHint.
  ///
  /// In tr, this message translates to:
  /// **'Ne oldu? Ne zaman oldu? Ne kadar ayrıntı verirsen o kadar hızlı çözeriz.'**
  String get ticketBodyHint;

  /// No description provided for @relatedRecord.
  ///
  /// In tr, this message translates to:
  /// **'İlgili işlem'**
  String get relatedRecord;

  /// No description provided for @addScreenshot.
  ///
  /// In tr, this message translates to:
  /// **'Ekran görüntüsü ekle'**
  String get addScreenshot;

  /// No description provided for @screenshotAttached.
  ///
  /// In tr, this message translates to:
  /// **'Ekran görüntüsü eklendi'**
  String get screenshotAttached;

  /// No description provided for @viewScreenshot.
  ///
  /// In tr, this message translates to:
  /// **'Ekran görüntüsü'**
  String get viewScreenshot;

  /// No description provided for @remove.
  ///
  /// In tr, this message translates to:
  /// **'Kaldır'**
  String get remove;

  /// No description provided for @ticketResponseTime.
  ///
  /// In tr, this message translates to:
  /// **'Genellikle 48 saat içinde yanıtlarız. Yanıt gelince bildirim ve e-posta alırsın.'**
  String get ticketResponseTime;

  /// No description provided for @ticketWaiting.
  ///
  /// In tr, this message translates to:
  /// **'Talebin ekibimizde. Yanıt gelince haber vereceğiz.'**
  String get ticketWaiting;

  /// No description provided for @ticketClosedNote.
  ///
  /// In tr, this message translates to:
  /// **'Bu talep kapandı. Yeni bir sorun için yeni talep açabilirsin.'**
  String get ticketClosedNote;

  /// No description provided for @closeTicket.
  ///
  /// In tr, this message translates to:
  /// **'Talebi kapat'**
  String get closeTicket;

  /// No description provided for @closeTicketConfirm.
  ///
  /// In tr, this message translates to:
  /// **'Sorunun çözüldüyse talebi kapatabilirsin. Kapanan talebe mesaj yazılamaz.'**
  String get closeTicketConfirm;

  /// No description provided for @writeReply.
  ///
  /// In tr, this message translates to:
  /// **'Yanıt yaz…'**
  String get writeReply;

  /// No description provided for @supportTeam.
  ///
  /// In tr, this message translates to:
  /// **'MeetPoint Destek'**
  String get supportTeam;

  /// No description provided for @supportCatCoins.
  ///
  /// In tr, this message translates to:
  /// **'Jeton ve ödeme'**
  String get supportCatCoins;

  /// No description provided for @supportCatCalls.
  ///
  /// In tr, this message translates to:
  /// **'Arama ve hediye'**
  String get supportCatCalls;

  /// No description provided for @supportCatCashout.
  ///
  /// In tr, this message translates to:
  /// **'Para çekme'**
  String get supportCatCashout;

  /// No description provided for @supportCatSafety.
  ///
  /// In tr, this message translates to:
  /// **'Güvenlik'**
  String get supportCatSafety;

  /// No description provided for @supportCatAccount.
  ///
  /// In tr, this message translates to:
  /// **'Hesap'**
  String get supportCatAccount;

  /// No description provided for @supportCatBug.
  ///
  /// In tr, this message translates to:
  /// **'Hata bildir'**
  String get supportCatBug;

  /// No description provided for @supportCatSuggestion.
  ///
  /// In tr, this message translates to:
  /// **'Öneri'**
  String get supportCatSuggestion;

  /// No description provided for @supportCatOther.
  ///
  /// In tr, this message translates to:
  /// **'Diğer'**
  String get supportCatOther;

  /// No description provided for @notificationsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Bildirimler'**
  String get notificationsTitle;

  /// No description provided for @notifyTypesTitle.
  ///
  /// In tr, this message translates to:
  /// **'Bildirim türleri'**
  String get notifyTypesTitle;

  /// No description provided for @notifyTypesHint.
  ///
  /// In tr, this message translates to:
  /// **'Kapattığın türler telefonuna gelmez; uygulamada görmeye devam edersin.'**
  String get notifyTypesHint;

  /// No description provided for @notifyMessages.
  ///
  /// In tr, this message translates to:
  /// **'Mesajlar'**
  String get notifyMessages;

  /// No description provided for @notifyMatches.
  ///
  /// In tr, this message translates to:
  /// **'Eşleşmeler'**
  String get notifyMatches;

  /// No description provided for @notifyRequests.
  ///
  /// In tr, this message translates to:
  /// **'Mesaj istekleri'**
  String get notifyRequests;

  /// No description provided for @notifyCalls.
  ///
  /// In tr, this message translates to:
  /// **'Aramalar'**
  String get notifyCalls;

  /// No description provided for @notifyLikes.
  ///
  /// In tr, this message translates to:
  /// **'Süper beğeniler'**
  String get notifyLikes;

  /// No description provided for @quietHoursTitle.
  ///
  /// In tr, this message translates to:
  /// **'Sessiz saatler'**
  String get quietHoursTitle;

  /// No description provided for @quietHoursHint.
  ///
  /// In tr, this message translates to:
  /// **'Bu saatlerde aramalar dışında bildirim gelmez.'**
  String get quietHoursHint;

  /// No description provided for @quietHours.
  ///
  /// In tr, this message translates to:
  /// **'Sessiz saatleri aç'**
  String get quietHours;

  /// No description provided for @quietFrom.
  ///
  /// In tr, this message translates to:
  /// **'Başlangıç'**
  String get quietFrom;

  /// No description provided for @quietTo.
  ///
  /// In tr, this message translates to:
  /// **'Bitiş'**
  String get quietTo;

  /// No description provided for @marketingTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kampanya ve duyurular'**
  String get marketingTitle;

  /// No description provided for @marketingHint.
  ///
  /// In tr, this message translates to:
  /// **'İzin kanal bazındadır; istediğin an geri alabilirsin.'**
  String get marketingHint;

  /// No description provided for @consentMarketingPushTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kampanya bildirimleri'**
  String get consentMarketingPushTitle;

  /// No description provided for @consentMarketingPushText.
  ///
  /// In tr, this message translates to:
  /// **'İndirim ve yeni özellik duyuruları bildirim olarak.'**
  String get consentMarketingPushText;

  /// No description provided for @requiredNotificationsNote.
  ///
  /// In tr, this message translates to:
  /// **'Ödeme, destek yanıtı ve güvenlik bildirimleri hesabınla ilgili olduğu için her zaman gönderilir.'**
  String get requiredNotificationsNote;

  /// No description provided for @errSalesTermsRequired.
  ///
  /// In tr, this message translates to:
  /// **'Satın almadan önce satış koşullarını onaylaman gerekiyor.'**
  String get errSalesTermsRequired;

  /// No description provided for @errSupportLimit.
  ///
  /// In tr, this message translates to:
  /// **'Çok fazla açık talebin var. Önce mevcut taleplerinden birini kapat.'**
  String get errSupportLimit;

  /// No description provided for @errTicketClosed.
  ///
  /// In tr, this message translates to:
  /// **'Bu talep kapandı. Yeni bir talep açabilirsin.'**
  String get errTicketClosed;

  /// No description provided for @howItWorks.
  ///
  /// In tr, this message translates to:
  /// **'Nasıl çalışır?'**
  String get howItWorks;

  /// No description provided for @nextStep.
  ///
  /// In tr, this message translates to:
  /// **'İleri'**
  String get nextStep;

  /// No description provided for @introPage1Title.
  ///
  /// In tr, this message translates to:
  /// **'Keşfet'**
  String get introPage1Title;

  /// No description provided for @introPage1Body.
  ///
  /// In tr, this message translates to:
  /// **'Profilleri kaydırarak keşfet. Sağa kaydır: beğen. Sola kaydır: geç.'**
  String get introPage1Body;

  /// No description provided for @introPage2Title.
  ///
  /// In tr, this message translates to:
  /// **'İstek gönder'**
  String get introPage2Title;

  /// No description provided for @introPage2Body.
  ///
  /// In tr, this message translates to:
  /// **'Bir profille konuşmak için mesaj, sesli ya da görüntülü arama isteği gönder. Kabul edilirse sohbet açılır.'**
  String get introPage2Body;

  /// No description provided for @introPage3Title.
  ///
  /// In tr, this message translates to:
  /// **'Jetonlar'**
  String get introPage3Title;

  /// No description provided for @introPage3Body.
  ///
  /// In tr, this message translates to:
  /// **'İstekler ve aramalar jetonla ücretlendirilir. Aramalar dakika başına, sadece karşı taraf gerçekten bağlandığında ücretlendirilir.'**
  String get introPage3Body;

  /// No description provided for @introPage4Title.
  ///
  /// In tr, this message translates to:
  /// **'Kazanç'**
  String get introPage4Title;

  /// No description provided for @introPage4Body.
  ///
  /// In tr, this message translates to:
  /// **'Biri seninle konuşmak için jeton harcarsa payın cüzdanına kazanç olarak eklenir; {days} gün sonra paraya çevirebilirsin.'**
  String introPage4Body(int days);

  /// No description provided for @coinsInfoTitle.
  ///
  /// In tr, this message translates to:
  /// **'Jetonlar nasıl çalışır?'**
  String get coinsInfoTitle;

  /// No description provided for @coinsInfoRequestsTitle.
  ///
  /// In tr, this message translates to:
  /// **'İstek ücretleri'**
  String get coinsInfoRequestsTitle;

  /// No description provided for @coinsInfoCallsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Arama ücretleri'**
  String get coinsInfoCallsTitle;

  /// No description provided for @coinsInfoCallsBody.
  ///
  /// In tr, this message translates to:
  /// **'Dakika başına ücretlendirilir; karşı taraf gerçekten bağlanmazsa ücret alınmaz.'**
  String get coinsInfoCallsBody;

  /// No description provided for @coinsInfoEarnTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kazanç'**
  String get coinsInfoEarnTitle;

  /// No description provided for @coinsInfoEarnBody.
  ///
  /// In tr, this message translates to:
  /// **'Biri seninle konuşmak için jeton harcarsa payın cüzdanına kazanç olarak eklenir; {days} gün sonra paraya çevirebilirsin.'**
  String coinsInfoEarnBody(int days);

  /// No description provided for @coinsInfoPromoBody.
  ///
  /// In tr, this message translates to:
  /// **'Bonus ve hediye jetonlarıyla ödenen tutarlardan gelen kazanç uygulamada harcanabilir, paraya çevrilemez.'**
  String get coinsInfoPromoBody;

  /// No description provided for @callFairBillingTip.
  ///
  /// In tr, this message translates to:
  /// **'İlk aramandır: karşı taraf gerçekten bağlanmazsa ücret alınmaz, kesintide kalan saniye orantılı iade edilir.'**
  String get callFairBillingTip;

  /// No description provided for @offlineBanner.
  ///
  /// In tr, this message translates to:
  /// **'Çevrimdışısın, yeniden bağlanılıyor…'**
  String get offlineBanner;

  /// No description provided for @back.
  ///
  /// In tr, this message translates to:
  /// **'Geri'**
  String get back;

  /// No description provided for @showPassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifreyi göster'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In tr, this message translates to:
  /// **'Şifreyi gizle'**
  String get hidePassword;

  /// No description provided for @consentAnalyticsTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kullanım analitiği'**
  String get consentAnalyticsTitle;

  /// No description provided for @consentAnalyticsText.
  ///
  /// In tr, this message translates to:
  /// **'Kayıt, eşleşme, ilk mesaj ve ilk satın alma gibi kilometre taşlarının anonim sayılarla kendi sunucumuzda tutulması (uygulamayı iyileştirmek için); üçüncü tarafa gitmez.'**
  String get consentAnalyticsText;

  /// No description provided for @sendFeedback.
  ///
  /// In tr, this message translates to:
  /// **'Öneri ve hata bildir'**
  String get sendFeedback;

  /// No description provided for @sendFeedbackHint.
  ///
  /// In tr, this message translates to:
  /// **'Fikrini paylaş ya da karşılaştığın bir sorunu anlat'**
  String get sendFeedbackHint;

  /// No description provided for @showcaseSection.
  ///
  /// In tr, this message translates to:
  /// **'Vitrin'**
  String get showcaseSection;

  /// No description provided for @showcaseTheme.
  ///
  /// In tr, this message translates to:
  /// **'Renk'**
  String get showcaseTheme;

  /// No description provided for @showcaseThemeHint.
  ///
  /// In tr, this message translates to:
  /// **'Profilinde ve rozetlerinde kullanılan vurgu rengi'**
  String get showcaseThemeHint;

  /// No description provided for @showcaseBackground.
  ///
  /// In tr, this message translates to:
  /// **'Kart zemini'**
  String get showcaseBackground;

  /// No description provided for @showcaseDefault.
  ///
  /// In tr, this message translates to:
  /// **'Varsayılan görünüm'**
  String get showcaseDefault;

  /// No description provided for @showcaseCustom.
  ///
  /// In tr, this message translates to:
  /// **'Kişiselleştirildi'**
  String get showcaseCustom;

  /// No description provided for @activeNow.
  ///
  /// In tr, this message translates to:
  /// **'Şu an aktif'**
  String get activeNow;

  /// No description provided for @none.
  ///
  /// In tr, this message translates to:
  /// **'Yok'**
  String get none;

  /// No description provided for @avatarSection.
  ///
  /// In tr, this message translates to:
  /// **'Avatar'**
  String get avatarSection;

  /// No description provided for @avatarSkin.
  ///
  /// In tr, this message translates to:
  /// **'Ten rengi'**
  String get avatarSkin;

  /// No description provided for @avatarHairStyle.
  ///
  /// In tr, this message translates to:
  /// **'Saç şekli'**
  String get avatarHairStyle;

  /// No description provided for @avatarHairColor.
  ///
  /// In tr, this message translates to:
  /// **'Saç rengi'**
  String get avatarHairColor;

  /// No description provided for @avatarOutfit.
  ///
  /// In tr, this message translates to:
  /// **'Kıyafet rengi'**
  String get avatarOutfit;

  /// No description provided for @avatarAccessory.
  ///
  /// In tr, this message translates to:
  /// **'Aksesuar'**
  String get avatarAccessory;

  /// No description provided for @avatarHairStyleLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, bald{Kel} short{Kısa} long{Uzun} curly{Kıvırcık} other{{id}}}'**
  String avatarHairStyleLabel(String id);

  /// No description provided for @avatarAccessoryLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, glasses{Gözlük} hat{Şapka} headphones{Kulaklık} other{{id}}}'**
  String avatarAccessoryLabel(String id);

  /// No description provided for @roomSection.
  ///
  /// In tr, this message translates to:
  /// **'Odam'**
  String get roomSection;

  /// No description provided for @roomEditTitle.
  ///
  /// In tr, this message translates to:
  /// **'Odanı dekore et'**
  String get roomEditTitle;

  /// No description provided for @roomWallpaper.
  ///
  /// In tr, this message translates to:
  /// **'Duvar kağıdı'**
  String get roomWallpaper;

  /// No description provided for @roomFloor.
  ///
  /// In tr, this message translates to:
  /// **'Zemin'**
  String get roomFloor;

  /// No description provided for @roomItemsHint.
  ///
  /// In tr, this message translates to:
  /// **'Bir eşya seç, ızgarada boş bir yere dokun. Yerleştirilmiş bir eşyaya dokunmak kaldırır.'**
  String get roomItemsHint;

  /// No description provided for @roomVisit.
  ///
  /// In tr, this message translates to:
  /// **'Odasını gör'**
  String get roomVisit;

  /// No description provided for @roomVisitTitle.
  ///
  /// In tr, this message translates to:
  /// **'{name} kişisinin odası'**
  String roomVisitTitle(String name);

  /// No description provided for @roomNotConnected.
  ///
  /// In tr, this message translates to:
  /// **'Bu odayı görebilmek için önce bir sohbetiniz olmalı.'**
  String get roomNotConnected;

  /// No description provided for @roomItemLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, sofa{Koltuk} bed{Yatak} plant{Bitki} lamp{Lamba} tv{Televizyon} bookshelf{Kitaplık} table{Masa} rug{Halı} window{Pencere} picture{Tablo} other{{id}}}'**
  String roomItemLabel(String id);

  /// No description provided for @roomFull.
  ///
  /// In tr, this message translates to:
  /// **'Oda dolu, önce bir eşya kaldır'**
  String get roomFull;

  /// No description provided for @vibeQuestionLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, ideal_date{İdeal bir randevu senin için nasıl olur?} flirt_style{Flört tarzını nasıl tanımlarsın?} weekend{Tipik bir hafta sonun nasıl geçer?} communication{İletişim tarzın nasıl?} conflict{Bir anlaşmazlık çıktığında ne yaparsın?} dream_trip{Hayalindeki seyahat nasıl?} friday_night{Cuma akşamı tercihin?} gift_style{Nasıl hediye vermeyi seversin?} social_battery{Sosyal enerjini ne besler?} love_language{Sevgini nasıl gösterirsin?} other{{id}}}'**
  String vibeQuestionLabel(String id);

  /// No description provided for @vibeOptionLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, road_trip{Spontane bir yol gezisi} cafe_chat{Sakin bir kafede sohbet} concert{Kalabalık bir konser/etkinlik} candlelit_dinner{Özenle planlanmış romantik bir akşam yemeği} direct{Doğrudan ve cesur} slow_burn{Yavaş yavaş, güven inşa ederek} playful{Şakacı ve eğlenceli} deep_talk{Derin sohbetlerle bağ kurarım} explore_new_place{Yeni bir yer keşfederim} stay_in{Evde kitap ya da film ile dinlenirim} spontaneous_hangout{Arkadaşlarla plansız buluşurum} planned_activity{Önceden planlanmış bir aktiviteye giderim} frequent_texts{Sık sık, anlık mesajlaşırım} rare_deep{Az ama derin sohbetler tercih ederim} voice_notes{Sesli mesajlarla, spontane} plans_ahead{Netlik severim, önceden planlarım} talk_now{Hemen konuşup çözerim} cool_off_first{Önce sakinleşmem gerekir} bring_others{Ortak arkadaşlara danışırım} write_it_out{Düşüncelerimi yazarak ifade ederim} backpacking{Sırt çantayla plansız bir keşif} quiet_cabin{Sessiz bir dağ evinde huzur} group_tour{Kalabalık bir grup turu} romantic_getaway{Romantik, baş başa bir kaçamak} new_experience{Hiç denemediğim yeni bir şey} movie_at_home{Evde film gecesi} party{Kalabalık bir parti} one_on_one{Tek bir kişiyle baş başa zaman} surprise_adventure{Sürpriz bir macera} practical{Kullanışlı, pratik bir şey} shared_experience{Birlikte yaşanacak bir deneyim} handwritten_note{El yazısıyla, içten bir not} crowd_energizes{Kalabalık beni enerjilendirir} small_group{Küçük, yakın bir grup yeter} one_friend{Tek bir yakın arkadaş} alone_time{Yalnız zaman bana iyi gelir} adventure_together{Birlikte maceraya atılarak} words{Sözlerle, içten ifadelerle} fun_together{Birlikte eğlenerek} reliability{Güvenilir ve istikrarlı olarak} other{{id}}}'**
  String vibeOptionLabel(String id);

  /// No description provided for @vibeArchetypeName.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, maceraci_romantik{Maceracı Romantik} sakin_gozlemci{Sakin Gözlemci} sosyal_kelebek{Sosyal Kelebek} pragmatik_planlayici{Pragmatik Planlayıcı} tutkulu_idealist{Tutkulu İdealist} ozgur_ruh{Özgür Ruh} sadik_yoldas{Sadık Yoldaş} merakli_kasif{Meraklı Kaşif} duygusal_derinlik{Duygusal Derinlik} eglence_duskunu{Eğlence Düşkünü} sessiz_guc{Sessiz Güç} dengeli_ruh{Dengeli Ruh} other{{id}}}'**
  String vibeArchetypeName(String id);

  /// No description provided for @vibeArchetypeDesc.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, maceraci_romantik{Yeni deneyimleri sevdiğin kadar, kalbini de tam anlamıyla verirsin.} sakin_gozlemci{Gürültüden çok, derin ve sakin anları tercih edersin.} sosyal_kelebek{Enerjini kalabalıktan alır, herkesle kolayca kaynaşırsın.} pragmatik_planlayici{Ayakların yere sağlam basar, sürprizlerden çok net planları seversin.} tutkulu_idealist{Büyük duygulara ve anlamlı bağlara inanırsın.} ozgur_ruh{Plansız programlar ve yeni maceralar seni heyecanlandırır.} sadik_yoldas{Sessiz ama güvenilir; yanındakiler için hep oradasın.} merakli_kasif{Her köşede yeni bir deneyim ararsın, rutin sana göre değil.} duygusal_derinlik{Yüzeysel sohbetler yerine gerçek, derin bağlar kurmayı seçersin.} eglence_duskunu{Hayatı kutlama fırsatı olarak görür, anı dolu dolu yaşarsın.} sessiz_guc{Az konuşur, çok şey ifade edersin; içten ve derin bir enerjin var.} dengeli_ruh{Ne çok maceracı ne çok sakin — dengeyi bulmayı bilirsin.} other{{id}}}'**
  String vibeArchetypeDesc(String id);

  /// No description provided for @vibeCompatNote.
  ///
  /// In tr, this message translates to:
  /// **'{tier, select, similar{{name1} + {name2}: aynı frekanstasınız, birbirinizi hemen anlarsınız} complementary{{name1} + {name2}: birbirini tamamlayan farklı enerjiler} opposite{{name1} + {name2}: zıt kutuplar çekişimi} other{}}'**
  String vibeCompatNote(String tier, String name1, String name2);

  /// No description provided for @vibeSection.
  ///
  /// In tr, this message translates to:
  /// **'Vibe’ın'**
  String get vibeSection;

  /// No description provided for @vibeTitle.
  ///
  /// In tr, this message translates to:
  /// **'Kendini Keşfet'**
  String get vibeTitle;

  /// No description provided for @vibeIntro.
  ///
  /// In tr, this message translates to:
  /// **'Kısa bir soru seti seni en iyi anlatan \"vibe\" arketipini bulur. Yapay zekâ kullanılmaz; cevapların ilgi alanlarınla birlikte kendi kuralımızla eşleştirilir.'**
  String get vibeIntro;

  /// No description provided for @vibeStart.
  ///
  /// In tr, this message translates to:
  /// **'Testi başlat'**
  String get vibeStart;

  /// No description provided for @vibeRetake.
  ///
  /// In tr, this message translates to:
  /// **'Yeniden yap'**
  String get vibeRetake;

  /// No description provided for @vibeNotTaken.
  ///
  /// In tr, this message translates to:
  /// **'Henüz vibe testini tamamlamadın.'**
  String get vibeNotTaken;

  /// No description provided for @vibeCompatTitle.
  ///
  /// In tr, this message translates to:
  /// **'Uyum notu'**
  String get vibeCompatTitle;

  /// No description provided for @vibeFinish.
  ///
  /// In tr, this message translates to:
  /// **'Bitir'**
  String get vibeFinish;

  /// No description provided for @moodLabel.
  ///
  /// In tr, this message translates to:
  /// **'{id, select, happy{Mutlu} excited{Heyecanlı} relaxed{Sakin} romantic{Aşık} tired{Yorgun} stressed{Stresli} grateful{Minnettar} adventurous{Maceraperest} lonely{Yalnız} busy{Meşgul} hopeful{Umutlu} bored{Sıkılmış} other{{id}}}'**
  String moodLabel(String id);

  /// No description provided for @moodSection.
  ///
  /// In tr, this message translates to:
  /// **'Ruh halin'**
  String get moodSection;

  /// No description provided for @moodTitle.
  ///
  /// In tr, this message translates to:
  /// **'Bugün nasılsın?'**
  String get moodTitle;

  /// No description provided for @moodPromptBanner.
  ///
  /// In tr, this message translates to:
  /// **'Bugün nasıl hissediyorsun? Paylaş, eşleştiklerin görsün.'**
  String get moodPromptBanner;

  /// No description provided for @moodNotSet.
  ///
  /// In tr, this message translates to:
  /// **'Bugün ruh halini henüz paylaşmadın.'**
  String get moodNotSet;

  /// No description provided for @moodClear.
  ///
  /// In tr, this message translates to:
  /// **'Kaldır'**
  String get moodClear;

  /// No description provided for @moodChange.
  ///
  /// In tr, this message translates to:
  /// **'Değiştir'**
  String get moodChange;
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
