import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/catalog.dart';
import 'package:meetpoint/core/models.dart';
import 'package:meetpoint/core/vibe.dart';

// Sunucu yanıt biçimleriyle (server/src/*Dto) birebir örnekler
Map<String, dynamic> profileJson({String id = 'u1', String name = 'Deren'}) => {
      'id': id,
      'verified': true,
      'distanceKm': 3,
      'displayName': name,
      'age': 29,
      'gender': 'female',
      'bio': '',
      'city': 'İstanbul',
      'country': '',
      'interests': ['coffee'],
      'prompts': [],
      'lookingFor': '',
      'heightCm': null,
      'job': '',
      'education': '',
      'zodiac': '',
      'smoking': '',
      'drinking': '',
      'photos': [
        {'id': 'p1', 'url': '/uploads/a.png'},
      ],
    };

Map<String, dynamic> callJson({String status = 'ACTIVE', String direction = 'out', Object? media}) => {
      'id': 'c1',
      'kind': 'VIDEO',
      'direction': direction,
      'status': status,
      'endReason': '',
      'ratePerMin': 30,
      'billedMinutes': 2,
      'totalCoins': 60,
      'giftCoins': 20,
      'myRating': null,
      'createdAt': '2026-09-23T11:42:18.030Z',
      'answeredAt': '2026-09-23T11:42:20.000Z',
      'endedAt': status == 'ENDED' ? '2026-09-23T11:43:33.000Z' : null,
      'user': profileJson(),
      'media': ?media,
    };

Map<String, dynamic> walletJson({Map<String, dynamic>? cashout}) => {
      'balance': 1470,
      'cashable': 30,
      'cashableUsd': 0.3,
      'entries': [
        {'id': 'e1', 'amount': -30, 'type': 'CALL', 'createdAt': '2026-09-23T11:42:20.000Z'},
      ],
      'packs': [
        {'id': 'coins_1000', 'coins': 1000, 'usd': 19.99, 'popular': true},
      ],
      'firstPurchaseBonusPct': 0,
      'requestPrices': {'MESSAGE': 50},
      'callRates': {'VOICE': 15, 'VIDEO': 30},
      'gifts': [
        {'id': 'rose', 'emoji': '🌹', 'coins': 20},
      ],
      'featurePrices': {'superLike': 30, 'boost': 150, 'boostMinutes': 30, 'likesUnlock': 200, 'likesUnlockHours': 24},
      'cashout': ?cashout,
    };

void main() {
  group('PublicProfile', () {
    test('ayrıştırma ve kapak fotoğrafı', () {
      final p = PublicProfile.fromJson(profileJson());
      expect(p.displayName, 'Deren');
      expect(p.verified, isTrue);
      expect(p.coverUrl, '/uploads/a.png');
      expect(p.location, 'İstanbul');
    });

    test('fotoğraf boyları; eski yanıtta tek adres her boya düşer', () {
      final sized = Photo.fromJson({'id': 'p', 'url': '/m-md', 'thumbUrl': '/m-sm', 'fullUrl': '/m-lg'});
      expect([sized.thumbUrl, sized.url, sized.fullUrl], ['/m-sm', '/m-md', '/m-lg']);
      final legacy = Photo.fromJson({'id': 'p', 'url': '/old.png'});
      expect([legacy.thumbUrl, legacy.fullUrl], ['/old.png', '/old.png']);
    });

    test('Faz 16 vitrin alanları: eski yanıtta (alan yok) varsayılan, yeni yanıtta ayrıştırılır', () {
      final legacy = PublicProfile.fromJson(profileJson());
      expect([legacy.themeId, legacy.cardBackgroundId, legacy.online], ['', '', false]);
      final showcase = PublicProfile.fromJson({...profileJson(), 'themeId': 'ocean', 'cardBackgroundId': 'sunset', 'online': true});
      expect(showcase.themeId, 'ocean');
      expect(showcase.cardBackgroundId, 'sunset');
      expect(showcase.online, isTrue);
    });

    test('Faz 16 vibe arketipi: eski yanıtta (alan yok) boş, yeni yanıtta ayrıştırılır', () {
      final legacy = PublicProfile.fromJson(profileJson());
      expect(legacy.vibeArchetypeId, '');
      final withVibe = PublicProfile.fromJson({...profileJson(), 'vibeArchetypeId': 'ozgur_ruh'});
      expect(withVibe.vibeArchetypeId, 'ozgur_ruh');
    });
  });

  group('Vitrin kataloğu (Faz 16)', () {
    test('bilinmeyen/boş kimlik varsayılana düşer', () {
      expect(themeColorOf(''), themeAccent['coral']);
      expect(themeColorOf('nope'), themeAccent['coral']);
      expect(cardGradientOf(''), cardBackgroundGradient['default']);
      expect(cardGradientOf('nope'), cardBackgroundGradient['default']);
    });

    test('bilinen kimlik kendi rengini/gradyanını döner', () {
      expect(themeColorOf('ocean'), themeAccent['ocean']);
      expect(cardGradientOf('sunset'), cardBackgroundGradient['sunset']);
    });
  });

  group('"Kendini Keşfet" vibe sistemi (Faz 16)', () {
    test('VibeResult ayrıştırma: tamamlanmamış ve tamamlanmış', () {
      final notTaken = VibeResult.fromJson({'answers': {}, 'archetypeId': ''});
      expect(notTaken.completed, isFalse);
      final taken = VibeResult.fromJson({
        'answers': {'ideal_date': 'road_trip'},
        'archetypeId': 'merakli_kasif',
      });
      expect(taken.completed, isTrue);
      expect(taken.answers['ideal_date'], 'road_trip');
    });

    test('10 soru, her birinin 4 seçeneği var', () {
      expect(vibeQuestions.length, 10);
      for (final q in vibeQuestions) {
        expect(q.optionIds.length, 4, reason: '${q.id} 4 seçenekli olmalı');
      }
    });

    test('aynı arketip her zaman "benzer" çıkar', () {
      expect(vibeCompatibilityTier('maceraci_romantik', 'maceraci_romantik'), VibeCompatTier.similar);
    });

    test('uzak vektörler "zıt kutuplar" çıkar (yol haritasındaki örnek)', () {
      // maceraci_romantik [2,0,1,2] ile sakin_gozlemci [-2,-1,-1,0] arası uzaklık = 5.0 (> 4.5 eşiği)
      expect(vibeCompatibilityTier('maceraci_romantik', 'sakin_gozlemci'), VibeCompatTier.opposite);
    });

    test('bilinmeyen arketip kimliğinde null döner', () {
      expect(vibeCompatibilityTier('nope', 'maceraci_romantik'), isNull);
    });
  });

  group('CallInfo', () {
    test('giden aktif görüntülü arama', () {
      final c = CallInfo.fromJson(callJson());
      expect(c.outgoing, isTrue);
      expect(c.isVideo, isTrue);
      expect(c.status, CallStatus.active);
      expect(c.isLive, isTrue);
      expect(c.user?.displayName, 'Deren');
      expect(c.media, isNull); // simülasyon modu
    });

    test('biten aramada konuşma süresi cevaplanma ile bitiş arası', () {
      final c = CallInfo.fromJson(callJson(status: 'ENDED', direction: 'in'));
      expect(c.outgoing, isFalse);
      expect(c.isLive, isFalse);
      expect(c.talkTime, const Duration(minutes: 1, seconds: 13));
    });

    test('Agora kanal bilgisi', () {
      final c = CallInfo.fromJson(callJson(media: {'appId': 'app', 'channel': 'c1', 'uid': 2, 'token': null}));
      expect(c.media?.channel, 'c1');
      expect(c.media?.uid, 2);
      expect(c.media?.token, isNull);
    });

    test('tüm durumlar tanınır', () {
      for (final s in ['RINGING', 'ACTIVE', 'ENDED', 'MISSED', 'DECLINED', 'CANCELLED']) {
        expect(() => CallInfo.fromJson(callJson(status: s)), returnsNormally, reason: s);
      }
    });
  });

  group('WalletInfo', () {
    test('arama ücretleri, hediyeler ve para çekme kuralları', () {
      final w = WalletInfo.fromJson(walletJson(cashout: {'minCoins': 2000, 'usdPerCoin': 0.01, 'pending': null}));
      expect(w.callRates[CallKind.video], 30);
      expect(w.gifts.single.emoji, '🌹');
      expect(w.requestPrices[RequestKind.message], 50);
      expect(w.cashout.minCoins, 2000);
      expect(w.cashout.pending, isNull);
      expect(w.cashout.usdOf(2500), '\$25.00');
      expect(w.promoEarnings, 0); // alan yoksa 0
    });

    test('eski sunucu yanıtında (callRates/gifts/cashout yok) varsayılanlar', () {
      final j = walletJson()..remove('callRates')..remove('gifts');
      final w = WalletInfo.fromJson(j);
      expect(w.callRates, isEmpty);
      expect(w.gifts, isEmpty);
      expect(w.cashout.minCoins, 2000);
    });
  });

  group('Payout', () {
    test('bekleyen IBAN talebi', () {
      final p = Payout.fromJson({
        'id': 'po1',
        'coins': 2500,
        'usd': 25,
        'method': 'iban',
        'accountName': 'Ece Yılmaz',
        'accountHint': '•••• 1326',
        'status': 'PENDING',
        'reference': '',
        'adminNote': '',
        'createdAt': '2026-09-23T12:08:00.000Z',
        'processedAt': null,
      });
      expect(p.method, PayoutMethod.iban);
      expect(p.status, PayoutStatus.pending);
      expect(p.usd, 25.0);
    });
  });

  group('ChatMessage', () {
    test('tek seferlik fotoğraf ve okundu bilgisi', () {
      final m = ChatMessage.fromJson({
        'id': 'm1',
        'conversationId': 'cv1',
        'senderId': 'u1',
        'kind': 'photo',
        'body': '',
        'viewedAt': null,
        'readAt': '2026-09-23T12:00:00.000Z',
        'createdAt': '2026-09-23T11:59:00.000Z',
      });
      expect(m.isPhoto, isTrue);
      expect(m.readAt, isNotNull);
      expect(m.copyWith(viewedAt: DateTime(2026)).viewedAt, DateTime(2026));
    });
  });

  group('KVKK modelleri', () {
    test('rıza durumu ve eksik rıza türü', () {
      final c = ConsentState.fromJson({'special_category': true, 'overseas_transfer': false, 'selfie': true, 'marketing': false, 'overseasConsentRequired': true});
      expect(c.of(ConsentKind.specialCategory), isTrue);
      expect(c.of(ConsentKind.overseasTransfer), isFalse);
      expect(ConsentKind.fromApi('overseas_transfer'), ConsentKind.overseasTransfer);
      expect(ConsentKind.fromApi('yok'), isNull);
      expect(ConsentKind.selfie.doc, 'consent-selfie');
    });

    test('veri indirme: hazırlanıyor / bekleme süresi', () {
      final preparing = DataExportInfo.fromJson({'status': 'BUILDING', 'createdAt': '2026-09-24T10:00:00Z', 'nextAt': '2099-01-01T00:00:00Z'});
      expect(preparing.preparing, isTrue);
      expect(preparing.canRequest, isFalse);
      final failed = DataExportInfo.fromJson({'status': 'FAILED', 'createdAt': '2026-09-24T10:00:00Z', 'nextAt': null});
      expect(failed.canRequest, isTrue);
    });

    test('Me: yeniden onay bekleyen metinler', () {
      final me = Me.fromJson({
        'id': 'u', 'email': 'a@b.c', 'locale': 'tr', 'balance': 0, 'cashable': 0,
        'consents': {'special_category': true}, 'legalUpdates': ['terms'],
      });
      expect(me.legalUpdates, ['terms']);
      expect(me.consents.specialCategory, isTrue);
    });
  });
}
