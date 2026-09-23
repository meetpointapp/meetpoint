import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/models.dart';

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
}
