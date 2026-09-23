DateTime _date(dynamic v) => DateTime.parse(v as String).toLocal();

class Photo {
  final String id;
  final String url;
  const Photo({required this.id, required this.url});
  factory Photo.fromJson(Map<String, dynamic> j) => Photo(id: j['id'], url: j['url']);
}

class ProfilePrompt {
  final String id;
  final String answer;
  const ProfilePrompt(this.id, this.answer);
  factory ProfilePrompt.fromJson(Map<String, dynamic> j) => ProfilePrompt(j['id'], j['answer']);
  Map<String, dynamic> toJson() => {'id': id, 'answer': answer};
}

class PublicProfile {
  final String id;
  final bool verified;
  final int? distanceKm; // yaklaşık mesafe; konum bilinmiyorsa null
  final bool superLikedMe;
  final String displayName;
  final int age;
  final String gender;
  final String bio;
  final String city;
  final String country;
  final List<Photo> photos;
  final List<String> interests;
  final List<ProfilePrompt> prompts;
  final String lookingFor;
  final int? heightCm;
  final String job;
  final String education;
  final String zodiac;
  final String smoking;
  final String drinking;

  const PublicProfile({
    required this.id,
    this.verified = false,
    this.distanceKm,
    this.superLikedMe = false,
    required this.displayName,
    required this.age,
    required this.gender,
    required this.bio,
    required this.city,
    required this.country,
    required this.photos,
    this.interests = const [],
    this.prompts = const [],
    this.lookingFor = '',
    this.heightCm,
    this.job = '',
    this.education = '',
    this.zodiac = '',
    this.smoking = '',
    this.drinking = '',
  });

  String? get coverUrl => photos.isEmpty ? null : photos.first.url;
  String get location => [city, country].where((s) => s.isNotEmpty).join(', ');

  factory PublicProfile.fromJson(Map<String, dynamic> j) => PublicProfile(
        id: j['id'],
        verified: j['verified'] ?? false,
        distanceKm: j['distanceKm'],
        superLikedMe: j['superLikedMe'] ?? false,
        displayName: j['displayName'],
        age: j['age'],
        gender: j['gender'],
        bio: j['bio'] ?? '',
        city: j['city'] ?? '',
        country: j['country'] ?? '',
        photos: [for (final p in (j['photos'] as List)) Photo.fromJson(p)],
        interests: [for (final i in (j['interests'] as List? ?? const [])) i as String],
        prompts: [for (final p in (j['prompts'] as List? ?? const [])) ProfilePrompt.fromJson(p)],
        lookingFor: j['lookingFor'] ?? '',
        heightCm: j['heightCm'],
        job: j['job'] ?? '',
        education: j['education'] ?? '',
        zodiac: j['zodiac'] ?? '',
        smoking: j['smoking'] ?? '',
        drinking: j['drinking'] ?? '',
      );
}

class MyProfile extends PublicProfile {
  final String interestedIn;
  final DateTime birthDate;

  MyProfile.fromJson(Map<String, dynamic> j)
      : interestedIn = j['interestedIn'],
        birthDate = DateTime.parse(j['birthDate']),
        super(
          id: j['id'],
          verified: j['verified'] ?? false,
          displayName: j['displayName'],
          age: j['age'],
          gender: j['gender'],
          bio: j['bio'] ?? '',
          city: j['city'] ?? '',
          country: j['country'] ?? '',
          photos: [for (final p in (j['photos'] as List)) Photo.fromJson(p)],
          interests: [for (final i in (j['interests'] as List? ?? const [])) i as String],
          prompts: [for (final p in (j['prompts'] as List? ?? const [])) ProfilePrompt.fromJson(p)],
          lookingFor: j['lookingFor'] ?? '',
          heightCm: j['heightCm'],
          job: j['job'] ?? '',
          education: j['education'] ?? '',
          zodiac: j['zodiac'] ?? '',
          smoking: j['smoking'] ?? '',
          drinking: j['drinking'] ?? '',
        );
}

// Kayıt sihirbazında ve profil düzenlemede kullanılan değiştirilebilir taslak
class ProfileDraft {
  String displayName = '';
  DateTime? birthDate;
  String gender = '';
  String interestedIn = '';
  List<Photo> photos = [];
  List<String> interests = [];
  String lookingFor = '';
  List<ProfilePrompt> prompts = [];
  String bio = '';
  String city = '';
  String country = '';
  int? heightCm;
  String job = '';
  String education = '';
  String zodiac = '';
  String smoking = '';
  String drinking = '';

  ProfileDraft();

  ProfileDraft.from(MyProfile p)
      : displayName = p.displayName,
        birthDate = p.birthDate,
        gender = p.gender,
        interestedIn = p.interestedIn,
        photos = [...p.photos],
        interests = [...p.interests],
        lookingFor = p.lookingFor,
        prompts = [...p.prompts],
        bio = p.bio,
        city = p.city,
        country = p.country,
        heightCm = p.heightCm,
        job = p.job,
        education = p.education,
        zodiac = p.zodiac,
        smoking = p.smoking,
        drinking = p.drinking;

  ProfileDraft copy() => ProfileDraft()
    ..displayName = displayName
    ..birthDate = birthDate
    ..gender = gender
    ..interestedIn = interestedIn
    ..photos = [...photos]
    ..interests = [...interests]
    ..lookingFor = lookingFor
    ..prompts = [...prompts]
    ..bio = bio
    ..city = city
    ..country = country
    ..heightCm = heightCm
    ..job = job
    ..education = education
    ..zodiac = zodiac
    ..smoking = smoking
    ..drinking = drinking;

  // Önizleme bileşenleri (etiketler, sorular) için salt okunur profil
  PublicProfile toPreview({int age = 0}) => PublicProfile(
        id: '',
        displayName: displayName,
        age: age,
        gender: gender,
        bio: bio,
        city: city,
        country: country,
        photos: photos,
        interests: interests,
        prompts: prompts,
        lookingFor: lookingFor,
        heightCm: heightCm,
        job: job,
        education: education,
        zodiac: zodiac,
        smoking: smoking,
        drinking: drinking,
      );

  Map<String, dynamic> toJson() {
    final d = birthDate!;
    return {
      'displayName': displayName.trim(),
      'birthDate': '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}',
      'gender': gender,
      'interestedIn': interestedIn,
      'interests': interests,
      'lookingFor': lookingFor,
      'prompts': [for (final p in prompts) p.toJson()],
      'bio': bio.trim(),
      'city': city.trim(),
      'country': country.trim(),
      'heightCm': heightCm,
      'job': job.trim(),
      'education': education,
      'zodiac': zodiac,
      'smoking': smoking,
      'drinking': drinking,
    };
  }
}

class Me {
  final String id;
  final String email;
  final String locale;
  final bool emailVerified;
  // Mavi tik durumu: none | pending | approved | rejected
  final String verificationStatus;
  final MyProfile? profile;
  final int balance;
  final int cashable;
  final DateTime? boostedUntil;
  final DateTime? likesUnlockedUntil;
  final bool hasLocation;
  final DiscoverFilters filters;

  const Me({
    required this.id,
    required this.email,
    required this.locale,
    required this.emailVerified,
    required this.verificationStatus,
    required this.profile,
    required this.balance,
    required this.cashable,
    this.boostedUntil,
    this.likesUnlockedUntil,
    this.hasLocation = false,
    this.filters = const DiscoverFilters(),
  });

  factory Me.fromJson(Map<String, dynamic> j) => Me(
        id: j['id'],
        email: j['email'],
        locale: j['locale'],
        emailVerified: j['emailVerified'] ?? false,
        verificationStatus: j['verificationStatus'] ?? 'none',
        profile: j['profile'] == null ? null : MyProfile.fromJson(j['profile']),
        balance: j['balance'],
        cashable: j['cashable'],
        boostedUntil: j['boostedUntil'] == null ? null : _date(j['boostedUntil']),
        likesUnlockedUntil: j['likesUnlockedUntil'] == null ? null : _date(j['likesUnlockedUntil']),
        hasLocation: j['hasLocation'] ?? false,
        filters: DiscoverFilters.fromJson(j['filters']),
      );
}

enum RequestKind { message, voice, video }

RequestKind requestKindFrom(String s) => RequestKind.values.byName(s.toLowerCase());
String requestKindApi(RequestKind k) => k.name.toUpperCase();

class CoinPack {
  final String id; // mağazadaki ürün kimliği
  final int coins;
  final double usd; // referans fiyat; mağaza bağlıysa yerel fiyat gösterilir
  final bool popular;
  const CoinPack({required this.id, required this.coins, required this.usd, this.popular = false});
  factory CoinPack.fromJson(Map<String, dynamic> j) => CoinPack(
      id: j['id'], coins: j['coins'], usd: (j['usd'] as num).toDouble(), popular: j['popular'] ?? false);
}

class WalletEntry {
  final String id;
  final int amount;
  final String type;
  final DateTime createdAt;
  const WalletEntry({required this.id, required this.amount, required this.type, required this.createdAt});
  factory WalletEntry.fromJson(Map<String, dynamic> j) =>
      WalletEntry(id: j['id'], amount: j['amount'], type: j['type'], createdAt: _date(j['createdAt']));
}

class WalletInfo {
  final int balance;
  final int cashable;
  final int promoEarnings; // bonus/hediye jetonlarından kazanç: harcanabilir, paraya çevrilemez
  final double cashableUsd;
  final List<WalletEntry> entries;
  final List<CoinPack> packs;
  final Map<RequestKind, int> requestPrices;
  final Map<CallKind, int> callRates; // dakika başı jeton
  final List<GiftOption> gifts;
  final FeaturePrices featurePrices;
  final int firstPurchaseBonusPct; // 0 = ilk alım bonusu kullanılmış
  final CashoutRules cashout;

  const WalletInfo({
    required this.balance,
    required this.cashable,
    this.promoEarnings = 0,
    required this.cashableUsd,
    required this.entries,
    required this.packs,
    required this.requestPrices,
    this.callRates = const {},
    this.gifts = const [],
    required this.featurePrices,
    this.firstPurchaseBonusPct = 0,
    this.cashout = const CashoutRules(),
  });

  factory WalletInfo.fromJson(Map<String, dynamic> j) => WalletInfo(
        balance: j['balance'],
        cashable: j['cashable'],
        promoEarnings: j['promoEarnings'] ?? 0,
        cashableUsd: (j['cashableUsd'] as num).toDouble(),
        entries: [for (final e in (j['entries'] as List)) WalletEntry.fromJson(e)],
        packs: [for (final p in (j['packs'] as List)) CoinPack.fromJson(p)],
        requestPrices: {
          for (final e in (j['requestPrices'] as Map<String, dynamic>).entries) requestKindFrom(e.key): e.value as int,
        },
        callRates: {
          for (final e in (j['callRates'] as Map<String, dynamic>? ?? const <String, dynamic>{}).entries) callKindFrom(e.key): e.value as int,
        },
        gifts: [for (final g in (j['gifts'] ?? []) as List) GiftOption.fromJson(g)],
        featurePrices: FeaturePrices.fromJson(j['featurePrices']),
        firstPurchaseBonusPct: j['firstPurchaseBonusPct'] ?? 0,
        cashout: j['cashout'] == null ? const CashoutRules() : CashoutRules.fromJson(j['cashout']),
      );
}

class ContactRequest {
  final String id;
  final RequestKind kind;
  final int price;
  final String status;
  final String note;
  final DateTime createdAt;
  final DateTime expiresAt;
  final PublicProfile? user;

  const ContactRequest({
    required this.id,
    required this.kind,
    required this.price,
    required this.status,
    required this.note,
    required this.createdAt,
    required this.expiresAt,
    required this.user,
  });

  bool get isPending => status == 'PENDING';

  factory ContactRequest.fromJson(Map<String, dynamic> j) => ContactRequest(
        id: j['id'],
        kind: requestKindFrom(j['kind']),
        price: j['price'],
        status: j['status'],
        note: j['note'] ?? '',
        createdAt: _date(j['createdAt']),
        expiresAt: _date(j['expiresAt']),
        user: j['user'] == null ? null : PublicProfile.fromJson(j['user']),
      );
}

class ChatMessage {
  final String id;
  final String conversationId;
  final String senderId;
  final String kind; // text | photo (tek seferlik)
  final String body;
  final DateTime? viewedAt; // fotoğraf açıldı mı
  final DateTime? readAt; // okundu mu
  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    this.kind = 'text',
    required this.body,
    this.viewedAt,
    this.readAt,
    required this.createdAt,
  });

  bool get isPhoto => kind == 'photo';

  ChatMessage copyWith({DateTime? viewedAt, DateTime? readAt}) => ChatMessage(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        kind: kind,
        body: body,
        viewedAt: viewedAt ?? this.viewedAt,
        readAt: readAt ?? this.readAt,
        createdAt: createdAt,
      );

  factory ChatMessage.fromJson(Map<String, dynamic> j) => ChatMessage(
        id: j['id'],
        conversationId: j['conversationId'],
        senderId: j['senderId'],
        kind: j['kind'] ?? 'text',
        body: j['body'] ?? '',
        viewedAt: j['viewedAt'] == null ? null : _date(j['viewedAt']),
        readAt: j['readAt'] == null ? null : _date(j['readAt']),
        createdAt: _date(j['createdAt']),
      );
}

class Conversation {
  final String id;
  final String origin;
  final PublicProfile? user;
  final ChatMessage? lastMessage;
  final int unreadCount;

  const Conversation({
    required this.id,
    required this.origin,
    required this.user,
    required this.lastMessage,
    this.unreadCount = 0,
  });

  factory Conversation.fromJson(Map<String, dynamic> j) => Conversation(
        id: j['id'],
        origin: j['origin'],
        user: j['user'] == null ? null : PublicProfile.fromJson(j['user']),
        lastMessage: j['lastMessage'] == null ? null : ChatMessage.fromJson(j['lastMessage']),
        unreadCount: j['unreadCount'] ?? 0,
      );
}

// "Seni beğenenler": kilitliyken sadece sayı gelir
class LikesInfo {
  final bool unlocked;
  final DateTime? unlockedUntil;
  final int count;
  final List<PublicProfile> users;

  const LikesInfo({required this.unlocked, this.unlockedUntil, required this.count, required this.users});

  factory LikesInfo.fromJson(Map<String, dynamic> j) => LikesInfo(
        unlocked: j['unlocked'] ?? false,
        unlockedUntil: j['unlockedUntil'] == null ? null : _date(j['unlockedUntil']),
        count: j['count'] ?? 0,
        users: [for (final u in (j['users'] as List? ?? const [])) PublicProfile.fromJson(u)],
      );
}

class DiscoverFilters {
  final int minAge;
  final int maxAge;
  final int maxKm; // 0 = sınırsız

  const DiscoverFilters({this.minAge = 18, this.maxAge = 80, this.maxKm = 0});

  factory DiscoverFilters.fromJson(Map<String, dynamic>? j) => j == null
      ? const DiscoverFilters()
      : DiscoverFilters(minAge: j['minAge'] ?? 18, maxAge: j['maxAge'] ?? 80, maxKm: j['maxKm'] ?? 0);

  Map<String, dynamic> toJson() => {'minAge': minAge, 'maxAge': maxAge, 'maxKm': maxKm};
}

class FeaturePrices {
  final int superLike;
  final int boost;
  final int boostMinutes;
  final int likesUnlock;
  final int likesUnlockHours;

  const FeaturePrices({
    required this.superLike,
    required this.boost,
    required this.boostMinutes,
    required this.likesUnlock,
    required this.likesUnlockHours,
  });

  factory FeaturePrices.fromJson(Map<String, dynamic> j) => FeaturePrices(
        superLike: j['superLike'],
        boost: j['boost'],
        boostMinutes: j['boostMinutes'],
        likesUnlock: j['likesUnlock'],
        likesUnlockHours: j['likesUnlockHours'],
      );
}

// --- Aramalar (dakika başı ücretli sesli/görüntülü)

enum CallKind { voice, video }

CallKind callKindFrom(String s) => CallKind.values.byName(s.toLowerCase());
String callKindApi(CallKind k) => k.name.toUpperCase();

enum CallStatus { ringing, active, ended, missed, declined, cancelled }

class GiftOption {
  final String id;
  final String emoji;
  final int coins;
  const GiftOption({required this.id, required this.emoji, required this.coins});
  factory GiftOption.fromJson(Map<String, dynamic> j) => GiftOption(id: j['id'], emoji: j['emoji'], coins: j['coins']);
}

// Ses/görüntü kanalı bilgisi (Agora). null ise sunucu simülasyon modunda.
class CallMedia {
  final String appId;
  final String channel;
  final int uid;
  final String? token;
  const CallMedia({required this.appId, required this.channel, required this.uid, this.token});
  factory CallMedia.fromJson(Map<String, dynamic> j) =>
      CallMedia(appId: j['appId'], channel: j['channel'], uid: j['uid'], token: j['token']);
}

class CallInfo {
  final String id;
  final CallKind kind;
  final bool outgoing;
  final CallStatus status;
  final String endReason; // hangup | balance | disconnect | server_restart
  final int ratePerMin;
  final int billedMinutes;
  final int totalCoins;
  final int giftCoins;
  final int? myRating;
  final DateTime createdAt;
  final DateTime? answeredAt;
  final DateTime? endedAt;
  final PublicProfile? user; // karşı taraf
  final CallMedia? media; // sadece kabul yanıtında/olayında gelir

  const CallInfo({
    required this.id,
    required this.kind,
    required this.outgoing,
    required this.status,
    this.endReason = '',
    required this.ratePerMin,
    this.billedMinutes = 0,
    this.totalCoins = 0,
    this.giftCoins = 0,
    this.myRating,
    required this.createdAt,
    this.answeredAt,
    this.endedAt,
    this.user,
    this.media,
  });

  bool get isLive => status == CallStatus.ringing || status == CallStatus.active;
  bool get isVideo => kind == CallKind.video;

  // Konuşma süresi (cevaplanmadıysa sıfır)
  Duration get talkTime =>
      answeredAt == null ? Duration.zero : (endedAt ?? DateTime.now()).difference(answeredAt!);

  factory CallInfo.fromJson(Map<String, dynamic> j) => CallInfo(
        id: j['id'],
        kind: callKindFrom(j['kind']),
        outgoing: j['direction'] == 'out',
        status: CallStatus.values.byName((j['status'] as String).toLowerCase()),
        endReason: j['endReason'] ?? '',
        ratePerMin: j['ratePerMin'],
        billedMinutes: j['billedMinutes'] ?? 0,
        totalCoins: j['totalCoins'] ?? 0,
        giftCoins: j['giftCoins'] ?? 0,
        myRating: j['myRating'],
        createdAt: _date(j['createdAt']),
        answeredAt: j['answeredAt'] == null ? null : _date(j['answeredAt']),
        endedAt: j['endedAt'] == null ? null : _date(j['endedAt']),
        user: j['user'] == null ? null : PublicProfile.fromJson(j['user']),
        media: j['media'] == null ? null : CallMedia.fromJson(j['media']),
      );
}

// --- Para çekme (manuel onaylı)

class CashoutRules {
  final int minCoins;
  final double usdPerCoin;
  final Payout? pending; // incelenen talep (en fazla bir tane)
  const CashoutRules({this.minCoins = 2000, this.usdPerCoin = 0.01, this.pending});
  factory CashoutRules.fromJson(Map<String, dynamic> j) => CashoutRules(
        minCoins: j['minCoins'],
        usdPerCoin: (j['usdPerCoin'] as num).toDouble(),
        pending: j['pending'] == null ? null : Payout.fromJson(j['pending']),
      );

  String usdOf(int coins) => '\$${(coins * usdPerCoin).toStringAsFixed(2)}';
}

enum PayoutMethod { iban, paypal }

enum PayoutStatus { pending, paid, rejected, cancelled }

class Payout {
  final String id;
  final int coins;
  final double usd;
  final PayoutMethod method;
  final String accountHint; // hesabın sadece sonu (•••• 1326)
  final PayoutStatus status;
  final String reference;
  final String adminNote;
  final DateTime createdAt;
  final DateTime? processedAt;

  const Payout({
    required this.id,
    required this.coins,
    required this.usd,
    required this.method,
    required this.accountHint,
    required this.status,
    this.reference = '',
    this.adminNote = '',
    required this.createdAt,
    this.processedAt,
  });

  factory Payout.fromJson(Map<String, dynamic> j) => Payout(
        id: j['id'],
        coins: j['coins'],
        usd: (j['usd'] as num).toDouble(),
        method: PayoutMethod.values.byName(j['method']),
        accountHint: j['accountHint'] ?? '',
        status: PayoutStatus.values.byName((j['status'] as String).toLowerCase()),
        reference: j['reference'] ?? '',
        adminNote: j['adminNote'] ?? '',
        createdAt: _date(j['createdAt']),
        processedAt: j['processedAt'] == null ? null : _date(j['processedAt']),
      );
}
