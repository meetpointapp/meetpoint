DateTime _date(dynamic v) => DateTime.parse(v as String).toLocal();

// Sunucu her fotoğrafın 3 boyunu üretir: küçük (liste, ~240px), orta (kart, ~720px), büyük (tam ekran, ~1440px)
class Photo {
  final String id;
  final String url; // orta boy
  final String thumbUrl;
  final String fullUrl;
  // Otomatik kontrol şüpheli buldu: incelenene kadar sadece sahibi görür
  final bool underReview;
  const Photo({required this.id, required this.url, String? thumbUrl, String? fullUrl, this.underReview = false})
      : thumbUrl = thumbUrl ?? url,
        fullUrl = fullUrl ?? url;
  factory Photo.fromJson(Map<String, dynamic> j) =>
      Photo(id: j['id'], url: j['url'], thumbUrl: j['thumbUrl'], fullUrl: j['fullUrl'], underReview: j['underReview'] == true);
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
  // Faz 16: kişisel profil vitrini. '' = varsayılan marka görünümü. online: sadece bazı uçlarda
  // (profil detayı, keşfet destesi) doldurulur; başka yerlerde bilinmediği için false gelir.
  final String themeId;
  final String cardBackgroundId;
  final bool online;
  // Faz 16: çizgi avatar (fotoğraf yanında ve sohbette kullanılır). '' = varsayılan.
  final String avatarSkinId;
  final String avatarHairStyle;
  final String avatarHairColorId;
  final String avatarOutfitId;
  final String avatarAccessoryId;
  // Faz 16: "Kendini Keşfet" vibe sistemi. '' = testi henüz tamamlamamış.
  final String vibeArchetypeId;
  // Faz 16: günlük ruh hali. '' = paylaşmamış veya 24 saat dolmuş (sunucu hesaplar).
  final String moodId;

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
    this.themeId = '',
    this.cardBackgroundId = '',
    this.online = false,
    this.avatarSkinId = '',
    this.avatarHairStyle = '',
    this.avatarHairColorId = '',
    this.avatarOutfitId = '',
    this.avatarAccessoryId = '',
    this.vibeArchetypeId = '',
    this.moodId = '',
  });

  String? get coverUrl => photos.isEmpty ? null : photos.first.url;
  String? get coverThumbUrl => photos.isEmpty ? null : photos.first.thumbUrl;
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
        themeId: j['themeId'] ?? '',
        cardBackgroundId: j['cardBackgroundId'] ?? '',
        online: j['online'] ?? false,
        avatarSkinId: j['avatarSkinId'] ?? '',
        avatarHairStyle: j['avatarHairStyle'] ?? '',
        avatarHairColorId: j['avatarHairColorId'] ?? '',
        avatarOutfitId: j['avatarOutfitId'] ?? '',
        avatarAccessoryId: j['avatarAccessoryId'] ?? '',
        vibeArchetypeId: j['vibeArchetypeId'] ?? '',
        moodId: j['moodId'] ?? '',
      );
}

class MyProfile extends PublicProfile {
  final String interestedIn;
  final DateTime birthDate;
  // Faz 16: günlük ruh hali. Sadece sahibine döner (başkası sadece moodId'yi görür).
  final DateTime? moodExpiresAt;

  MyProfile.fromJson(Map<String, dynamic> j)
      : interestedIn = j['interestedIn'],
        birthDate = DateTime.parse(j['birthDate']),
        moodExpiresAt = j['moodExpiresAt'] != null ? DateTime.parse(j['moodExpiresAt']).toLocal() : null,
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
          themeId: j['themeId'] ?? '',
          cardBackgroundId: j['cardBackgroundId'] ?? '',
          avatarSkinId: j['avatarSkinId'] ?? '',
          avatarHairStyle: j['avatarHairStyle'] ?? '',
          avatarHairColorId: j['avatarHairColorId'] ?? '',
          avatarOutfitId: j['avatarOutfitId'] ?? '',
          avatarAccessoryId: j['avatarAccessoryId'] ?? '',
          vibeArchetypeId: j['vibeArchetypeId'] ?? '',
          moodId: j['moodId'] ?? '',
        );
}

// Faz 16: "Kendini Keşfet" vibe sistemi. answers: { soruId: seçenekId }. archetypeId '' ise test
// henüz tamamlanmamış demektir.
class VibeResult {
  final Map<String, String> answers;
  final String archetypeId;
  const VibeResult({this.answers = const {}, this.archetypeId = ''});
  factory VibeResult.fromJson(Map<String, dynamic> j) => VibeResult(
        answers: {for (final e in (j['answers'] as Map? ?? const {}).entries) e.key as String: e.value as String},
        archetypeId: j['archetypeId'] ?? '',
      );
  bool get completed => archetypeId.isNotEmpty;
}

// Faz 16: "İlgi alanı bazlı keşif". Ortak ilgiye göre bir vitrin: kaç uygun aday var ve
// önizlemede gösterilecek birkaç kullanıcı kimliği.
class InterestGroup {
  final String interestId;
  final int count;
  final List<String> previewUserIds;
  const InterestGroup({required this.interestId, required this.count, this.previewUserIds = const []});
  factory InterestGroup.fromJson(Map<String, dynamic> j) => InterestGroup(
        interestId: j['interestId'],
        count: j['count'],
        previewUserIds: [for (final id in (j['previewUserIds'] as List? ?? const [])) id as String],
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
  String themeId = '';
  String cardBackgroundId = '';
  String avatarSkinId = '';
  String avatarHairStyle = '';
  String avatarHairColorId = '';
  String avatarOutfitId = '';
  String avatarAccessoryId = '';

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
        drinking = p.drinking,
        themeId = p.themeId,
        cardBackgroundId = p.cardBackgroundId,
        avatarSkinId = p.avatarSkinId,
        avatarHairStyle = p.avatarHairStyle,
        avatarHairColorId = p.avatarHairColorId,
        avatarOutfitId = p.avatarOutfitId,
        avatarAccessoryId = p.avatarAccessoryId;

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
    ..drinking = drinking
    ..themeId = themeId
    ..cardBackgroundId = cardBackgroundId
    ..avatarSkinId = avatarSkinId
    ..avatarHairStyle = avatarHairStyle
    ..avatarHairColorId = avatarHairColorId
    ..avatarOutfitId = avatarOutfitId
    ..avatarAccessoryId = avatarAccessoryId;

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
        themeId: themeId,
        cardBackgroundId: cardBackgroundId,
        avatarSkinId: avatarSkinId,
        avatarHairStyle: avatarHairStyle,
        avatarHairColorId: avatarHairColorId,
        avatarOutfitId: avatarOutfitId,
        avatarAccessoryId: avatarAccessoryId,
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
      'themeId': themeId,
      'cardBackgroundId': cardBackgroundId,
      'avatarSkinId': avatarSkinId,
      'avatarHairStyle': avatarHairStyle,
      'avatarHairColorId': avatarHairColorId,
      'avatarOutfitId': avatarOutfitId,
      'avatarAccessoryId': avatarAccessoryId,
    };
  }
}

// Faz 16: kendi oda. Statik yerleşim (ızgara hücresi başına bir eşya); eşleşilen/bağlantılı
// kişi salt görüntüleme ile ziyaret edebilir.
class RoomItem {
  final String itemId;
  final int x;
  final int y;
  const RoomItem({required this.itemId, required this.x, required this.y});
  factory RoomItem.fromJson(Map<String, dynamic> j) => RoomItem(itemId: j['itemId'], x: j['x'], y: j['y']);
  Map<String, dynamic> toJson() => {'itemId': itemId, 'x': x, 'y': y};
}

class RoomInfo {
  final String wallpaperId;
  final String floorId;
  final List<RoomItem> items;
  final String displayName; // sadece ziyarette dolu
  const RoomInfo({this.wallpaperId = '', this.floorId = '', this.items = const [], this.displayName = ''});
  factory RoomInfo.fromJson(Map<String, dynamic> j) => RoomInfo(
        wallpaperId: j['wallpaperId'] ?? '',
        floorId: j['floorId'] ?? '',
        items: [for (final i in (j['items'] as List? ?? const [])) RoomItem.fromJson(i)],
        displayName: j['displayName'] ?? '',
      );
  Map<String, dynamic> toJson() => {'wallpaperId': wallpaperId, 'floorId': floorId, 'items': [for (final i in items) i.toJson()]};

  RoomInfo copyWith({String? wallpaperId, String? floorId, List<RoomItem>? items}) =>
      RoomInfo(wallpaperId: wallpaperId ?? this.wallpaperId, floorId: floorId ?? this.floorId, items: items ?? this.items);
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
  final ConsentState consents;
  // Değişen ve yeniden onay bekleyen yasal metinler (terms, privacy)
  final List<String> legalUpdates;
  // Moderasyon: kısıt bitişi ve henüz gösterilmemiş son yaptırım
  final DateTime? restrictedUntil;
  final Sanction? pendingSanction;

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
    this.consents = const ConsentState(),
    this.legalUpdates = const [],
    this.restrictedUntil,
    this.pendingSanction,
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
        consents: j['consents'] == null ? const ConsentState() : ConsentState.fromJson(j['consents']),
        legalUpdates: [for (final d in (j['legalUpdates'] as List? ?? const [])) d as String],
        restrictedUntil: j['restrictedUntil'] == null ? null : _date(j['restrictedUntil']),
        pendingSanction: j['pendingSanction'] == null ? null : Sanction.fromJson(j['pendingSanction']),
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
  // Olgunlaşmayı bekleyen kazanç (iade süresi dolunca bozdurulabilir) ve ilk olgunlaşma zamanı
  final int maturingEarnings;
  final DateTime? nextMatureAt;
  final double cashableUsd;
  final List<WalletEntry> entries;
  final List<CoinPack> packs;
  final Map<RequestKind, int> requestPrices;
  final Map<CallKind, int> callRates; // dakika başı jeton
  final List<GiftOption> gifts;
  final FeaturePrices featurePrices;
  final int firstPurchaseBonusPct; // 0 = ilk alım bonusu kullanılmış
  final CashoutRules cashout;
  final SalesTerms salesTerms;

  const WalletInfo({
    required this.balance,
    required this.cashable,
    this.promoEarnings = 0,
    this.maturingEarnings = 0,
    this.nextMatureAt,
    required this.cashableUsd,
    required this.entries,
    required this.packs,
    required this.requestPrices,
    this.callRates = const {},
    this.gifts = const [],
    required this.featurePrices,
    this.firstPurchaseBonusPct = 0,
    this.cashout = const CashoutRules(),
    this.salesTerms = const SalesTerms(),
  });

  factory WalletInfo.fromJson(Map<String, dynamic> j) => WalletInfo(
        balance: j['balance'],
        cashable: j['cashable'],
        promoEarnings: j['promoEarnings'] ?? 0,
        maturingEarnings: j['maturingEarnings'] ?? 0,
        nextMatureAt: j['nextMatureAt'] == null ? null : _date(j['nextMatureAt']),
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
        salesTerms: j['salesTerms'] == null ? const SalesTerms() : SalesTerms.fromJson(j['salesTerms']),
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
  final DateTime? deliveredAt; // alıcının cihazına ulaştı mı
  final DateTime? readAt; // okundu mu
  final DateTime createdAt;
  // contact: telefon/IBAN/sosyal medya paylaşıldı → alıcıya güvenlik ipucu
  final String flag;
  // Gönderene: az önce iletişim bilgisi paylaştın uyarısı (sadece gönderme yanıtında)
  final bool contactWarning;
  // Faz 15: çevrimdışı kuyruk. Sunucuya henüz ulaşmadıysa yerel kuyruk anahtarı (id geçicidir);
  // ulaştıysa null. failed: sunucu kalıcı olarak reddetti (tekrar denenmeyecek).
  final String? pendingKey;
  final bool failed;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    this.kind = 'text',
    required this.body,
    this.viewedAt,
    this.deliveredAt,
    this.readAt,
    required this.createdAt,
    this.flag = '',
    this.contactWarning = false,
    this.pendingKey,
    this.failed = false,
  });

  // Çevrimdışı kuyruğa eklenirken gösterilen iyimser (geçici) balon
  factory ChatMessage.pending({
    required String conversationId,
    required String senderId,
    required String body,
    required String key,
    DateTime? createdAt,
  }) =>
      ChatMessage(
        id: 'pending:$key',
        conversationId: conversationId,
        senderId: senderId,
        body: body,
        createdAt: createdAt ?? DateTime.now(),
        pendingKey: key,
      );

  bool get isPending => pendingKey != null;

  bool get isPhoto => kind == 'photo';

  ChatMessage copyWith({DateTime? viewedAt, DateTime? deliveredAt, DateTime? readAt, bool? failed}) => ChatMessage(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        kind: kind,
        body: body,
        viewedAt: viewedAt ?? this.viewedAt,
        deliveredAt: deliveredAt ?? this.deliveredAt,
        readAt: readAt ?? this.readAt,
        createdAt: createdAt,
        flag: flag,
        contactWarning: contactWarning,
        pendingKey: pendingKey,
        failed: failed ?? this.failed,
      );

  factory ChatMessage.fromJson(Map<String, dynamic> j) => ChatMessage(
        id: j['id'],
        conversationId: j['conversationId'],
        senderId: j['senderId'],
        kind: j['kind'] ?? 'text',
        body: j['body'] ?? '',
        flag: j['flag'] ?? '',
        contactWarning: j['warning'] == 'contact_info',
        viewedAt: j['viewedAt'] == null ? null : _date(j['viewedAt']),
        deliveredAt: j['deliveredAt'] == null ? null : _date(j['deliveredAt']),
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
  final String endReason; // hangup | balance | disconnect | server_restart | connect_failed
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
  // Faz 15: arama itirazı. "" | PENDING | APPROVED | REJECTED. Sadece arayan (ücretlendirilen taraf) açabilir.
  final String disputeStatus;

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
    this.disputeStatus = '',
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
        disputeStatus: j['disputeStatus'] ?? '',
      );
}

// --- Para çekme (manuel onaylı)

class CashoutRules {
  final int minCoins;
  final double usdPerCoin;
  final double withholdingRate; // stopaj (0 = yok)
  final int maturityDays; // kazancın bozdurulabilir olması için bekleme
  final double monthlyCapUsd;
  final String kycStatus; // none | pending | approved | rejected
  final Payout? pending; // incelenen talep (en fazla bir tane)
  const CashoutRules({
    this.minCoins = 2000,
    this.usdPerCoin = 0.01,
    this.withholdingRate = 0,
    this.maturityDays = 14,
    this.monthlyCapUsd = 1000,
    this.kycStatus = 'none',
    this.pending,
  });
  factory CashoutRules.fromJson(Map<String, dynamic> j) => CashoutRules(
        minCoins: j['minCoins'],
        usdPerCoin: (j['usdPerCoin'] as num).toDouble(),
        withholdingRate: (j['withholdingRate'] as num? ?? 0).toDouble(),
        maturityDays: j['maturityDays'] ?? 14,
        monthlyCapUsd: (j['monthlyCapUsd'] as num? ?? 1000).toDouble(),
        kycStatus: j['kycStatus'] ?? 'none',
        pending: j['pending'] == null ? null : Payout.fromJson(j['pending']),
      );

  String usdOf(int coins) => '\$${(coins * usdPerCoin).toStringAsFixed(2)}';
  // Stopaj sonrası net
  String netUsdOf(int coins) {
    final gross = double.parse((coins * usdPerCoin).toStringAsFixed(2));
    return '\$${(gross - double.parse((gross * withholdingRate).toStringAsFixed(2))).toStringAsFixed(2)}';
  }
}

// Yıllık kazanç dökümü
class EarningsStatement {
  final int year;
  final int earnedCoins;
  final int payoutCount;
  final double grossUsd;
  final double withholdingUsd;
  final double netUsd;
  const EarningsStatement({
    required this.year,
    required this.earnedCoins,
    required this.payoutCount,
    required this.grossUsd,
    required this.withholdingUsd,
    required this.netUsd,
  });
  factory EarningsStatement.fromJson(Map<String, dynamic> j) {
    final t = j['totals'] as Map<String, dynamic>;
    return EarningsStatement(
      year: j['year'],
      earnedCoins: j['earnedCoins'],
      payoutCount: t['count'],
      grossUsd: (t['grossUsd'] as num).toDouble(),
      withholdingUsd: (t['withholdingUsd'] as num).toDouble(),
      netUsd: (t['netUsd'] as num).toDouble(),
    );
  }
}

enum PayoutMethod { iban, paypal }

enum PayoutStatus { pending, paid, rejected, cancelled }

class Payout {
  final String id;
  final int coins;
  final double usd; // brüt
  final double netUsd; // stopaj sonrası ödenen
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
    double? netUsd,
    required this.method,
    required this.accountHint,
    required this.status,
    this.reference = '',
    this.adminNote = '',
    required this.createdAt,
    this.processedAt,
  }) : netUsd = netUsd ?? usd;

  factory Payout.fromJson(Map<String, dynamic> j) => Payout(
        id: j['id'],
        coins: j['coins'],
        usd: (j['usd'] as num).toDouble(),
        netUsd: (j['netUsd'] as num?)?.toDouble(),
        method: PayoutMethod.values.byName(j['method']),
        accountHint: j['accountHint'] ?? '',
        status: PayoutStatus.values.byName((j['status'] as String).toLowerCase()),
        reference: j['reference'] ?? '',
        adminNote: j['adminNote'] ?? '',
        createdAt: _date(j['createdAt']),
        processedAt: j['processedAt'] == null ? null : _date(j['processedAt']),
      );
}

// Açık oturum (Profil > Cihazlarım)
class DeviceSession {
  final String id;
  final String deviceName;
  final String platform;
  final String ip; // son bölümü gizli
  final DateTime createdAt;
  final DateTime lastUsedAt;
  final bool current;

  const DeviceSession({
    required this.id,
    required this.deviceName,
    required this.platform,
    required this.ip,
    required this.createdAt,
    required this.lastUsedAt,
    required this.current,
  });

  factory DeviceSession.fromJson(Map<String, dynamic> j) => DeviceSession(
        id: j['id'],
        deviceName: j['deviceName'] ?? '',
        platform: j['platform'] ?? '',
        ip: j['ip'] ?? '',
        createdAt: DateTime.parse(j['createdAt']).toLocal(),
        lastUsedAt: DateTime.parse(j['lastUsedAt']).toLocal(),
        current: j['current'] == true,
      );
}

// KVKK açık rızaları
enum ConsentKind {
  specialCategory('special_category', 'consent-special'),
  overseasTransfer('overseas_transfer', 'consent-overseas'),
  selfie('selfie', 'consent-selfie'),
  marketing('marketing', 'consent-marketing'),
  marketingPush('marketing_push', 'consent-marketing'),
  analytics('analytics', 'consent-analytics');

  const ConsentKind(this.api, this.doc);
  final String api; // sunucudaki adı
  final String doc; // yasal metin adresi (/legal/<doc>)

  static ConsentKind? fromApi(Object? v) => values.where((k) => k.api == v).firstOrNull;
}

class ConsentState {
  final bool specialCategory;
  final bool overseasTransfer;
  final bool selfie;
  final bool marketing;
  final bool marketingPush;
  final bool analytics;
  // false ise yurt dışı aktarım için ayrı rıza sorulmaz (standart sözleşme yeterli görülmüş)
  final bool overseasConsentRequired;

  const ConsentState({
    this.specialCategory = false,
    this.overseasTransfer = false,
    this.selfie = false,
    this.marketing = false,
    this.marketingPush = false,
    this.analytics = false,
    this.overseasConsentRequired = true,
  });

  bool of(ConsentKind k) => switch (k) {
        ConsentKind.specialCategory => specialCategory,
        ConsentKind.overseasTransfer => overseasTransfer,
        ConsentKind.selfie => selfie,
        ConsentKind.marketing => marketing,
        ConsentKind.marketingPush => marketingPush,
        ConsentKind.analytics => analytics,
      };

  factory ConsentState.fromJson(Map<String, dynamic> j) => ConsentState(
        specialCategory: j['special_category'] == true,
        overseasTransfer: j['overseas_transfer'] == true,
        selfie: j['selfie'] == true,
        marketing: j['marketing'] == true,
        marketingPush: j['marketing_push'] == true,
        analytics: j['analytics'] == true,
        overseasConsentRequired: j['overseasConsentRequired'] != false,
      );
}

// "Verilerimi indir" son talebi
class DataExportInfo {
  final String status; // PENDING | BUILDING | READY | DOWNLOADED | EXPIRED | FAILED
  final DateTime createdAt;
  final DateTime? nextAt; // bir sonraki talep tarihi
  final DateTime? expiresAt;

  const DataExportInfo({required this.status, required this.createdAt, this.nextAt, this.expiresAt});

  bool get preparing => status == 'PENDING' || status == 'BUILDING';
  bool get canRequest => nextAt == null || DateTime.now().isAfter(nextAt!);

  factory DataExportInfo.fromJson(Map<String, dynamic> j) => DataExportInfo(
        status: j['status'],
        createdAt: _date(j['createdAt']),
        nextAt: j['nextAt'] == null ? null : _date(j['nextAt']),
        expiresAt: j['expiresAt'] == null ? null : _date(j['expiresAt']),
      );
}

// KVKK başvurusu (ilgili kişi hakları)
class KvkkRequest {
  final String id;
  final String kind; // info | correction | deletion | objection | other
  final String message;
  final String status; // OPEN | ANSWERED | REJECTED
  final String answer;
  final DateTime dueAt;
  final DateTime createdAt;

  const KvkkRequest({
    required this.id,
    required this.kind,
    required this.message,
    required this.status,
    required this.answer,
    required this.dueAt,
    required this.createdAt,
  });

  factory KvkkRequest.fromJson(Map<String, dynamic> j) => KvkkRequest(
        id: j['id'],
        kind: j['kind'],
        message: j['message'],
        status: j['status'],
        answer: j['answer'] ?? '',
        dueAt: _date(j['dueAt']),
        createdAt: _date(j['createdAt']),
      );
}

// Moderasyon yaptırımı: warning | restrict_24h | restrict_7d | ban
class Sanction {
  final String id;
  final String level;
  final String reason;
  final String note;
  final DateTime? endsAt;
  final DateTime createdAt;
  final String? appealStatus; // OPEN | ACCEPTED | REJECTED; null = itiraz yok

  const Sanction({
    required this.id,
    required this.level,
    required this.reason,
    required this.note,
    this.endsAt,
    required this.createdAt,
    this.appealStatus,
  });

  bool get canAppeal => appealStatus == null;

  factory Sanction.fromJson(Map<String, dynamic> j) => Sanction(
        id: j['id'],
        level: j['level'],
        reason: j['reason'] ?? '',
        note: j['note'] ?? '',
        endsAt: j['endsAt'] == null ? null : _date(j['endsAt']),
        createdAt: _date(j['createdAt']),
        appealStatus: (j['appeal'] as Map?)?['status'] as String?,
      );
}

// Satın alma öncesi onay (ön bilgilendirme + mesafeli satış + cayma hakkı istisnası)
class SalesTerms {
  final bool required; // satın almadan önce onay gerekli
  final bool updated; // daha önce onaylanmış ama metin değişmiş
  final String version;
  const SalesTerms({this.required = false, this.updated = false, this.version = ''});
  factory SalesTerms.fromJson(Map<String, dynamic> j) =>
      SalesTerms(required: j['required'] == true, updated: j['updated'] == true, version: j['version'] ?? '');
}

// ---------- Destek ----------

enum SupportCategory { coins, calls, cashout, safety, account, bug, suggestion, other }

enum TicketStatus { open, answered, closed }

TicketStatus _ticketStatus(Object? v) => switch (v) {
      'ANSWERED' => TicketStatus.answered,
      'CLOSED' => TicketStatus.closed,
      _ => TicketStatus.open,
    };

class SupportMessage {
  final String id;
  final bool fromStaff;
  final String body;
  final bool hasAttachment;
  final DateTime createdAt;
  const SupportMessage({required this.id, required this.fromStaff, required this.body, required this.hasAttachment, required this.createdAt});
  factory SupportMessage.fromJson(Map<String, dynamic> j) => SupportMessage(
        id: j['id'],
        fromStaff: j['fromStaff'] == true,
        body: j['body'] ?? '',
        hasAttachment: j['hasAttachment'] == true,
        createdAt: _date(j['createdAt']),
      );
}

class SupportTicket {
  final String id;
  final SupportCategory category;
  final String subject;
  final TicketStatus status;
  final bool unread; // destekten yanıt geldi, henüz açılmadı
  final DateTime lastMessageAt;
  final DateTime createdAt;
  final List<SupportMessage> messages; // listede boş; ayrıntıda dolu

  const SupportTicket({
    required this.id,
    required this.category,
    required this.subject,
    required this.status,
    required this.unread,
    required this.lastMessageAt,
    required this.createdAt,
    this.messages = const [],
  });

  factory SupportTicket.fromJson(Map<String, dynamic> j) => SupportTicket(
        id: j['id'],
        category: SupportCategory.values.asNameMap()[j['category']] ?? SupportCategory.other,
        subject: j['subject'] ?? '',
        status: _ticketStatus(j['status']),
        unread: j['unread'] == true,
        lastMessageAt: _date(j['lastMessageAt']),
        createdAt: _date(j['createdAt']),
        messages: [for (final m in (j['messages'] ?? const []) as List) SupportMessage.fromJson(m)],
      );
}

class SupportInbox {
  final List<SupportTicket> tickets;
  final int unread;
  const SupportInbox({this.tickets = const [], this.unread = 0});
  factory SupportInbox.fromJson(Map<String, dynamic> j) => SupportInbox(
        tickets: [for (final t in (j['tickets'] as List)) SupportTicket.fromJson(t)],
        unread: j['unread'] ?? 0,
      );
}

// Talebe iliştirilen işlem (cüzdan hareketi, para çekme, arama)
typedef RelatedRecord = ({String type, String id});

// ---------- Yardım merkezi ----------

class HelpArticle {
  final String id;
  final String question;
  final String answer;
  const HelpArticle({required this.id, required this.question, required this.answer});
  factory HelpArticle.fromJson(Map<String, dynamic> j) => HelpArticle(id: j['id'], question: j['question'] ?? '', answer: j['answer'] ?? '');
}

class HelpCategory {
  final String id;
  final String title;
  final String icon;
  final List<HelpArticle> articles;
  const HelpCategory({required this.id, required this.title, required this.icon, required this.articles});
  factory HelpCategory.fromJson(Map<String, dynamic> j) => HelpCategory(
        id: j['id'],
        title: j['title'] ?? '',
        icon: j['icon'] ?? '',
        articles: [for (final a in (j['articles'] as List)) HelpArticle.fromJson(a)],
      );
}

// ---------- Bildirim tercihleri ----------

enum NotifyType { message, match, request, call, like }

class NotificationPrefs {
  final Map<NotifyType, bool> prefs;
  final bool quietEnabled;
  final int quietStart; // yerel saat, dakika (0-1439)
  final int quietEnd;

  const NotificationPrefs({this.prefs = const {}, this.quietEnabled = false, this.quietStart = 23 * 60, this.quietEnd = 8 * 60});

  bool of(NotifyType t) => prefs[t] ?? true;

  factory NotificationPrefs.fromJson(Map<String, dynamic> j) {
    final p = (j['prefs'] as Map<String, dynamic>? ?? const {});
    final q = (j['quietHours'] as Map<String, dynamic>? ?? const {});
    return NotificationPrefs(
      prefs: {for (final t in NotifyType.values) t: p[t.name] != false},
      quietEnabled: q['enabled'] == true,
      quietStart: q['start'] ?? 23 * 60,
      quietEnd: q['end'] ?? 8 * 60,
    );
  }
}
