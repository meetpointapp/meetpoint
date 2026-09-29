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

    test('Faz 16 günlük ruh hali: eski yanıtta (alan yok) boş, yeni yanıtta ayrıştırılır', () {
      final legacy = PublicProfile.fromJson(profileJson());
      expect(legacy.moodId, '');
      final withMood = PublicProfile.fromJson({...profileJson(), 'moodId': 'happy'});
      expect(withMood.moodId, 'happy');
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

  group('İlgi alanı bazlı keşif (Faz 16)', () {
    test('InterestGroup ayrıştırma', () {
      final g = InterestGroup.fromJson({'interestId': 'coffee', 'count': 4, 'previewUserIds': ['u1', 'u2']});
      expect(g.interestId, 'coffee');
      expect(g.count, 4);
      expect(g.previewUserIds, ['u1', 'u2']);
    });

    test('previewUserIds eksikse boş liste olur', () {
      final g = InterestGroup.fromJson({'interestId': 'travel', 'count': 0});
      expect(g.previewUserIds, isEmpty);
    });
  });

  group('Kozmetik mağaza (Faz 16)', () {
    test('StoreItem ayrıştırma: sahip olunmamış ve olunmuş', () {
      final notOwned = StoreItem.fromJson({'id': 'badge_crown', 'category': 'badge', 'priceCoins': 200});
      expect(notOwned.owned, isFalse);
      final owned = StoreItem.fromJson({'id': 'badge_crown', 'category': 'badge', 'priceCoins': 200, 'owned': true});
      expect(owned.owned, isTrue);
      expect(owned.priceCoins, 200);
    });

    test('Faz 16 çerçeve/rozet: eski yanıtta (alan yok) boş, yeni yanıtta ayrıştırılır', () {
      final legacy = PublicProfile.fromJson(profileJson());
      expect([legacy.frameId, legacy.badgeId], ['', '']);
      final withStore = PublicProfile.fromJson({...profileJson(), 'frameId': 'frame_gold', 'badgeId': 'badge_crown'});
      expect(withStore.frameId, 'frame_gold');
      expect(withStore.badgeId, 'badge_crown');
    });
  });

  group('MeetPoint+ abonelik (Faz 16)', () {
    Map<String, dynamic> meJson({Object? premiumUntil}) =>
        {'id': 'u1', 'email': 'a@b.com', 'locale': 'tr', 'balance': 0, 'cashable': 0, 'premiumUntil': premiumUntil};

    test('Me.premiumUntil: eski yanıtta (alan yok) null, yeni yanıtta ayrıştırılır', () {
      final legacy = Me.fromJson(meJson());
      expect(legacy.premiumUntil, isNull);
      final withPremium = Me.fromJson(meJson(premiumUntil: '2026-12-31T00:00:00.000Z'));
      expect(withPremium.premiumUntil, isNotNull);
    });

    test('LikesInfo.premium: varsayılan false, sunucudan gelirse ayrıştırılır', () {
      final locked = LikesInfo.fromJson({'unlocked': false, 'count': 2, 'premium': false});
      expect(locked.premium, isFalse);
      final unlockedByPremium = LikesInfo.fromJson({'unlocked': true, 'count': 2, 'premium': true, 'users': []});
      expect(unlockedByPremium.premium, isTrue);
      expect(unlockedByPremium.unlocked, isTrue);
    });
  });

  group('Günlük giriş serisi (Faz 17)', () {
    test('Me.streak: eski yanıtta (alan yok) varsayılan 0/0, yeni yanıtta ayrıştırılır', () {
      final legacy = Me.fromJson({'id': 'u1', 'email': 'a@b.com', 'locale': 'tr', 'balance': 0, 'cashable': 0});
      expect(legacy.streak.current, 0);
      expect(legacy.streak.longest, 0);

      final withStreak = Me.fromJson({
        'id': 'u1', 'email': 'a@b.com', 'locale': 'tr', 'balance': 0, 'cashable': 0,
        'streak': {'current': 4, 'longest': 9},
      });
      expect(withStreak.streak.current, 4);
      expect(withStreak.streak.longest, 9);
    });

    test('Streak.fromJson: eksik alanlar 0 olur', () {
      expect(Streak.fromJson({}).current, 0);
      expect(Streak.fromJson({}).longest, 0);
    });
  });

  group('Sosyal cesaret yolculuğu (Faz 17)', () {
    test('Achievements.fromJson: üç izi ayrıştırır, eksik iz varsayılan (tier 0) olur', () {
      final j = {
        'iletisim': {
          'tier': 1,
          'milestones': [
            {'id': 'first_message', 'done': true},
            {'id': 'week_long_chat', 'done': false},
            {'id': 'first_icebreaker', 'done': false},
          ],
        },
        'baglanti': {'tier': 0, 'milestones': []},
        // 'kimlik' kasten eksik bırakıldı
      };
      final a = Achievements.fromJson(j);
      expect(a.of(AchievementTrack.iletisim).tier, 1);
      expect(a.of(AchievementTrack.iletisim).milestones.first.id, 'first_message');
      expect(a.of(AchievementTrack.iletisim).milestones.first.done, isTrue);
      expect(a.of(AchievementTrack.baglanti).tier, 0);
      expect(a.of(AchievementTrack.kimlik).tier, 0); // eksik iz → varsayılan TrackState
      expect(a.totalTier, 1);
    });

    test('NextStepHint.fromJson: sunucu alanlarını ayrıştırır', () {
      final h = NextStepHint.fromJson(
          {'conversationId': 'c1', 'otherUserId': 'u2', 'otherName': 'Ayşe', 'interestId': 'coffee'});
      expect(h.conversationId, 'c1');
      expect(h.otherUserId, 'u2');
      expect(h.otherName, 'Ayşe');
      expect(h.interestId, 'coffee');
    });

    test('PublicProfile.milestoneCount: eski yanıtta (alan yok) 0, yeni yanıtta ayrıştırılır', () {
      final legacy = PublicProfile.fromJson({
        'id': 'u1', 'displayName': 'A', 'age': 20, 'gender': 'male', 'bio': '', 'city': '', 'country': '', 'photos': [],
      });
      expect(legacy.milestoneCount, 0);
      final withCount = PublicProfile.fromJson({
        'id': 'u1', 'displayName': 'A', 'age': 20, 'gender': 'male', 'bio': '', 'city': '', 'country': '', 'photos': [],
        'milestoneCount': 5,
      });
      expect(withCount.milestoneCount, 5);
    });
  });

  group('Sohbet içi buz kırıcı mini oyunlar (Faz 17)', () {
    test('IcebreakerGame.fromJson: "bu mu o mu" alanlarını ayrıştırır', () {
      final g = IcebreakerGame.fromJson({
        'id': 'g1',
        'conversationId': 'c1',
        'kind': 'this_or_that',
        'starterId': 'u1',
        'promptId': 'coffee_or_tea',
        'statements': [],
        'lieIndex': null,
        'starterChoice': 'a',
        'responderId': null,
        'responderChoice': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'answeredAt': null,
      });
      expect(g.isThisOrThat, isTrue);
      expect(g.answered, isFalse);
      expect(g.starterChoice, 'a');
    });

    test('IcebreakerGame.fromJson: "2 doğru 1 yalan" cevaplanmadan önce lieIndex null olabilir (maskeleme)', () {
      final g = IcebreakerGame.fromJson({
        'id': 'g2',
        'conversationId': 'c1',
        'kind': 'two_truths',
        'starterId': 'u1',
        'statements': ['a', 'b', 'c'],
        'lieIndex': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(g.isThisOrThat, isFalse);
      expect(g.statements, ['a', 'b', 'c']);
      expect(g.lieIndex, isNull);
      expect(g.answered, isFalse);
    });

    test('IcebreakerGame.fromJson: cevaplandıktan sonra lieIndex ve responderChoice dolu', () {
      final g = IcebreakerGame.fromJson({
        'id': 'g3',
        'conversationId': 'c1',
        'kind': 'two_truths',
        'starterId': 'u1',
        'statements': ['a', 'b', 'c'],
        'lieIndex': 2,
        'responderId': 'u2',
        'responderChoice': '1',
        'createdAt': '2026-01-01T00:00:00.000Z',
        'answeredAt': '2026-01-01T00:05:00.000Z',
      });
      expect(g.answered, isTrue);
      expect(g.lieIndex, 2);
      expect(g.responderChoice, '1');
    });
  });

  group('Sohbet içi iki kişilik XOX (Faz 17)', () {
    test('TicTacToeGame.fromJson: boş tahta ve sıra bilgisi ayrıştırılır', () {
      final g = TicTacToeGame.fromJson({
        'id': 't1',
        'conversationId': 'c1',
        'starterId': 'u1',
        'board': List<String?>.filled(9, null),
        'turnUserId': 'u1',
        'status': 'active',
        'winnerId': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(g.finished, isFalse);
      expect(g.markOf('u1'), 'X');
      expect(g.markOf('u2'), 'O');
      expect(g.board, List<String?>.filled(9, null));
    });

    test('TicTacToeGame.fromJson: kazanan belli olunca finished true olur', () {
      final g = TicTacToeGame.fromJson({
        'id': 't2',
        'conversationId': 'c1',
        'starterId': 'u1',
        'board': ['X', 'X', 'X', null, 'O', 'O', null, null, null],
        'turnUserId': 'u1',
        'status': 'won',
        'winnerId': 'u1',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(g.finished, isTrue);
      expect(g.winnerId, 'u1');
    });
  });

  group('Haftalık özet (Faz 17)', () {
    test('WeeklyDigest.fromJson: etkinlik varsa hasActivity true', () {
      final d = WeeklyDigest.fromJson({
        'newMatches': 2,
        'longestChat': {'conversationId': 'c1', 'otherUserId': 'u2', 'otherName': 'Ayşe', 'messageCount': 5},
      });
      expect(d.newMatches, 2);
      expect(d.longestChat?.otherName, 'Ayşe');
      expect(d.hasActivity, isTrue);
    });

    test('WeeklyDigest.fromJson: etkinlik yoksa hasActivity false', () {
      final d = WeeklyDigest.fromJson({'newMatches': 0, 'longestChat': null});
      expect(d.longestChat, isNull);
      expect(d.hasActivity, isFalse);
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
