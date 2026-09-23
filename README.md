# MeetPoint

Tanış, konuş, kazan. Flutter (Android + iOS) arkadaşlık uygulaması + Node.js sunucu.

```
meetpoint/
  app/      Flutter uygulaması (TR + EN)
  server/   Node.js + Express + Prisma + Socket.IO + PostgreSQL
    admin/    Web yönetim paneli (http://localhost:4000/admin)
    legal/    Kullanım koşulları ve gizlilik politikası (TASLAK)
  docs/     Faz önizlemeleri, yayın rehberi, mağaza metinleri
```

Yayına geçiş adımları: [docs/yayin-rehberi.md](docs/yayin-rehberi.md) · Mağaza metinleri: [docs/magaza-metinleri.md](docs/magaza-metinleri.md) · Tüm ayarlar: [server/.env.example](server/.env.example)

## Lokalde çalıştırma

**1. Veritabanı** (`server/` klasöründe, ayrı bir terminalde açık kalır). Gömülü PostgreSQL'dir; bilgisayara kurulum gerekmez, veriler `server/.pgdata` klasöründe kalır:

```bash
npm install
cp .env.example .env
npm run db
```

**2. Sunucu** (`server/` klasöründe, ikinci terminal). İlk seferde migration ve örnek veri:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Sunucu `http://localhost:4000` adresinde çalışır. Seed hesapları (şifre hepsinde `password123`):

- **Uygulama:** `test@meetpoint.dev`. Hesapta 1000 jeton, 2 gelen istek ve seni önceden beğenmiş 2 profil var.
- **Yönetim paneli:** `admin@meetpoint.dev`. Adres: http://localhost:4000/admin. Panelde bekleyen 1 mavi tik başvurusu ve 1 açık şikayet var. Sekmeler: özet, şikayetler, mavi tik, kullanıcılar, satışlar, ödemeler, hatalar.

**E-postalar:** Lokalde e-posta sunucusu yok. Doğrulama ve şifre sıfırlama kodları `server/dev-mails/` klasörüne yazılır ve sunucu konsoluna basılır.

**3. Uygulama** (`app/` klasöründe):

```bash
flutter run -d edge
```

- Android emülatörü: `flutter run` (sunucuya `10.0.2.2:4000` üzerinden bağlanır)
- Gerçek telefon (aynı Wi-Fi): `flutter run --dart-define=API_URL=http://<bilgisayar-ip>:4000`

## Testler

**Sunucu** (`server/` klasöründe). Testler ayrı bir test veritabanı ve test sunucusu açar; geliştirme verisine dokunmaz.

```bash
npm test
```

- `npm run test:unit`: saf fonksiyonlar (yaş, IBAN, mesafe, hata gruplama, ekonomi kuralları), 1 saniyenin altında
- `npm run test:api`: uçtan uca senaryolar (kayıt, eşleşme, istekler, güvenlik, ödemeler, aramalar, para çekme, hata takibi)
- `npm run test:load`: yük ve eşzamanlılık testi (200 kullanıcı, 40 eşzamanlı arama; çift harcama ve ücret tutarlılığı denetimi). Rapor `test-data/load-report.json`
- `npm run typecheck:test`: test kodunun tip kontrolü

**Uygulama** (`app/` klasöründe):

```bash
flutter test
```

Uygulama testlerinden biri sunucu kaynaklarını da okur: sunucunun döndürebileceği her hata kodunun uygulamada Türkçe/İngilizce bir mesajı olmalıdır.

**Sürekli entegrasyon:** GitHub'a her gönderimde `.github/workflows/ci.yml` sunucu ve uygulama testlerini ve bağımlılık güvenlik taramasını çalıştırır. Dependabot haftalık güncelleme önerir.

**Arayüz turları:** ekran görüntülü görsel kontroller `tools/ui-tours/` klasöründe ([nasıl çalıştırılır](tools/ui-tours/README.md)).

## Jeton ekonomisi

Ayarlar `server/src/config.ts` dosyasında.

- **Gelir kaynağı:** sadece jeton satışı (1000 jeton = $19.99). Kullanıcılar arası transferde kesinti yok.
- **Mesaj isteği (50 jeton):** İstek gönderilince jeton bloke edilir. Kabul edilirse alıcıya geçer; red, iptal veya 24 saat dolumunda iade edilir.
- **Arama (dakika başı):** Sesli 15, görüntülü 30 jeton/dk. Her dakikanın başında arayandan alınıp arananın hesabına geçer (ilk dakika açılınca). Bakiye bir sonraki dakikaya yetmezse arayan uyarılır ve arama dakika sonunda biter. Cevapsız, reddedilen veya iptal edilen aramada jeton alınmaz.
- **Arama içi hediyeler:** 🌹 20, ❤️ 50, 🧸 100, 💎 250 jeton. Tamamı alıcıya geçer.
- **Cüzdan kovaları:** Bakiye 4 kovada tutulur: satın alınan, bonus/hediye, kazanç ve bonustan kazanç. Bonus ve hediye jetonları harcanabilir. Ama karşı tarafa geçtiğinde *bozdurulamaz* kazanç olur; böylece promosyonlar asla nakde dönüşmez. Harcama sırası: bonus → bonustan kazanç → satın alınan → kazanç (bozdurulabilir kazanç en son harcanır). Kurallar `server/src/wallet.ts` dosyasında.
- **Eşzamanlılık:** Her para hareketi kullanıcının cüzdan satırını kilitler. Aynı anda gelen istekler sırayla işlenir; çift harcama ve eksi bakiye imkânsızdır. `npm run verify:ledger` her cüzdanın hareket defteriyle birebir eşleştiğini denetler (testler her çalıştırmanın sonunda da denetler).
- **Bozdurma:** Sadece gerçek parayla ödenmiş jetondan gelen kazanç bozdurulabilir. Kur 1 jeton = $0.01. Satış fiyatı ile bu kur arasındaki fark, mağaza kesintisini karşılar ve kârı oluşturur.
- **Para çekme (manuel onay):** En az 2000 jeton ($20) ve mavi tik gerekir. Kullanıcı IBAN veya PayPal ile talep eder, jetonlar hemen düşülür. Yönetim ödemeyi elle yapıp işlem numarasıyla "Ödendi" işaretler. Reddedilen ya da kullanıcının iptal ettiği talepte jetonlar geri gelir ve yine bozdurulabilir kalır. Aynı anda tek bekleyen talep olabilir; bekleyen talep varken hesap silinemez. Ödenmiş kayıtlar hesap silinse de muhasebe için saklanır. Kurallar: `server/src/payouts.ts`.
- **Bakiye kaydı:** Bakiye hiçbir yerde elle tutulmaz. `WalletEntry` tablosundaki hareketlerin toplamıdır.

## Güvenlik (Faz 3)

- **Kayıt:** Koşul onayı (18+, kullanım koşulları, gizlilik) zorunlu. E-posta 6 haneli kodla doğrulanmadan uygulama kullanılamaz. Kod 10 dakika geçerli, en fazla 5 deneme, tekrar gönderme 60 saniyede bir.
- **Şifre sıfırlama:** E-posta koduyla yapılır. Şifre değişince diğer cihazlardaki oturumlar kapanır.
- **Mavi tik:** Sunucu rastgele bir poz atar, kullanıcı o pozla selfie çeker ve yönetim panelinden elle onaylanır. Selfie'ler `private-uploads/` klasöründe durur, herkese açık adreslerden erişilemez.
- **Yasaklama:** Oturumlar anında kapanır, bekleyen istekler iade edilir, profil keşfetten ve profil sayfalarından kalkar.
- **Hesap silme:** Şifreyle onaylanır. Bekleyen istekler iade edilir; fotoğraflar ve selfie'ler de silinir.
- **Hız sınırları** (`src/limits.ts`): giriş, kayıt ve kod denemesi IP başına; mesaj, istek, kaydırma ve şikayet kullanıcı başına sınırlı. Geliştirmede IP sınırları 25 kat gevşektir.

**Yayından önce yapılacaklar:**

- `NODE_ENV=production` ayarlanmalı.
- Güçlü bir `JWT_SECRET` belirlenmeli.
- E-posta için `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` ve `MAIL_FROM` tanımlanmalı.
- `server/legal/` metinleri bir hukukçuya inceletilmeli ve köşeli parantezli şirket bilgileri doldurulmalı.

## Push bildirimleri (Firebase) kurulumu

Uygulama açıkken gelen anlık bildirimler zaten çalışıyor. Uygulama kapalıyken bildirim gelmesi için bir Firebase projesi gerekiyor.

1. https://console.firebase.google.com adresinde **Proje ekle**'ye tıklayıp `meetpoint` adıyla bir proje oluştur.
2. Terminalde (`app\` klasöründe) şu komutları çalıştır:

```bash
npm install -g firebase-tools
firebase login
dart pub global activate flutterfire_cli
flutterfire configure --platforms=android,ios,web
```

   Bu işlem `lib/firebase_options.dart` dosyasını gerçek ayarlarla değiştirir. `flutterfire` komutu bulunamazsa `%LOCALAPPDATA%\Pub\Cache\bin` klasörünü PATH'e ekle.
3. Firebase konsolunda **Proje ayarları → Hizmet hesapları → Yeni özel anahtar oluştur**'a tıkla. İnen dosyayı `server\firebase-service-account.json` olarak kaydet ve `server\.env` dosyasına şu satırı ekle:
   `FIREBASE_SERVICE_ACCOUNT=firebase-service-account.json`

Firebase ayarlı değilken sunucu bildirimleri konsola `[push dev]` olarak yazar.

## Ödeme (RevenueCat) kurulumu: yayından önce

Mağaza bağlanana kadar cüzdan **test modunda** çalışır (web'de ve anahtar verilmemişse): ödeme alınmaz, ama satın alma sunucuda gerçekle aynı yoldan geçer (ilk alım bonusu dahil). Yayında test yükleme ucu kapalıdır.

1. **Mağaza ürünleri:** Google Play Console ve App Store Connect'te 4 adet **tüketilebilir (consumable)** ürün oluştur: `coins_500`, `coins_1000`, `coins_2500`, `coins_6000`. Taban fiyatlar 9,99 / 19,99 / 44,99 / 99,99 $; mağaza her ülke için yerel fiyatı kendisi belirler.
2. **RevenueCat:** Bir proje aç, Android ve iOS uygulamalarını ekle, aynı 4 ürünü tanımla. Uygulamayı genel SDK anahtarlarıyla derle:

```bash
flutter build appbundle --dart-define=REVENUECAT_ANDROID_KEY=goog_xxx
```

```bash
flutter build ipa --dart-define=REVENUECAT_IOS_KEY=appl_xxx
```

3. **Webhook:** RevenueCat panelinde **Integrations → Webhooks** bölümüne gir. URL olarak `https://<sunucu-adresi>/webhooks/revenuecat` gir, Authorization değeri olarak uzun rastgele bir metin belirle. Sunucunun `.env` dosyasına ekle:

```
REVENUECAT_WEBHOOK_AUTH="Bearer <belirlediğin-metin>"
REVENUECAT_SECRET_KEY="sk_xxx"
```

Kurallar `server/src/purchases.ts` dosyasında:

- Aynı mağaza işlemi iki kez yüklenmez.
- İadede verilen jetonlar (bonus dahil) geri alınır. Bakiye eksiye düşebilir; eksi bakiyede harcama yapılamaz.
- Sandbox (test) satın alımlar yüklenir ama gelir raporuna girmez.

## Sesli ve görüntülü arama (Agora) kurulumu: yayından önce

Agora anahtarı verilmeden aramalar **test modunda** çalışır: çalma, kabul, dakika başı ücret, hediye ve puanlama gerçek. Sadece ses ve görüntü aktarılmaz (ekranda "Test modu" yazar, görüntü yerine profil fotoğrafı görünür). Web sürümü her zaman test modundadır.

1. [console.agora.io](https://console.agora.io) üzerinden bir proje aç, **App ID** ve **App Certificate** değerlerini al (güvenli mod: token ile).
2. Sunucunun `.env` dosyasına ekle:

```
AGORA_APP_ID="xxxxxxxx"
AGORA_APP_CERT="xxxxxxxx"
```

3. Uygulamada ek ayar gerekmez: sunucu her arama için kısa ömürlü token üretir, kanal adı arama kimliğidir.
4. iOS derlemesinde `ios/Podfile` içindeki `post_install` bloğuna `permission_handler` için kamera ve mikrofon izin makrolarını ekle (`PERMISSION_CAMERA=1`, `PERMISSION_MICROPHONE=1`).

Kurallar `server/src/calls.ts` dosyasında:

- Aynı anda tek arama: meşgul kişi aranamaz.
- 45 sn cevaplanmayan arama cevapsız sayılır.
- Bağlantısı kopan taraf 20 sn içinde dönmezse arama biter. Sunucu yeniden başlarsa yarım kalan aramalar kapanır.
- Görüntülü aramada karşı tarafın görüntüsü bulanık başlar; kullanıcı dokununca netleşir.
- Arama sonrası 1-5 puan verilebilir, isteğe bağlı sorun bildirimi yönetim paneline şikayet olarak düşer.

## Çok sunuculu çalışma ve dayanıklılık

- **Zamanlayıcı:** Arama dakika ücretleri, cevapsız arama, bağlantı kopması ve süresi dolan istekler bellekte değil veritabanında tutulur (`server/src/scheduler.ts`). Sunucu yeniden başlasa da arama ve ücretlendirme kaldığı yerden devam eder.
- **Liderlik:** Birden fazla sunucu çalışırken zamanlanmış işleri yalnızca biri yapar; PostgreSQL kilidiyle seçilir. Lider çökerse diğeri birkaç saniyede devralır. Kısa kesintide kaçırılan arama dakikaları tamamlanır; 3 dakikayı aşan kesinti ücretlendirilmez.
- **Anlık olaylar:** Socket.IO PostgreSQL adaptörüyle sunucular arasında taşınır. Arayan bir sunucuya, aranan diğerine bağlı olabilir. Redis gerekmez.
- **Hız sınırları:** Sayaçlar PostgreSQL'de, tüm sunucularda ortak.
- `test/api/cluster.test.ts` ikinci bir sunucu açıp lideri arama ortasında öldürerek bunların hepsini doğrular.

## Fotoğraflar

Yüklenen her fotoğraf sunucuda yeniden kodlanır: konum (GPS) ve cihaz bilgisi silinir, yön düzeltilir, sahte veya zararlı dosyalar (SVG, görüntü olmayan içerik) reddedilir. Profil fotoğraflarının 3 boyu üretilir (240/720/1440 px, WebP): uygulama listelerde küçüğünü, tam ekranda büyüğünü kullanır. Fotoğraflar imzalı, süreli adreslerle (`/media`) sunulur. Depolama katmanı (`server/src/storage.ts`) yayında S3 uyumlu nesne depolamaya geçecek şekilde tasarlandı.

## Hata takibi

Uygulamadaki yakalanmamış hatalar (yayın derlemesinde) ve sunucudaki 500 hataları yönetim panelinin **Hatalar** sekmesine düşer. Harici servis gerekmez. Aynı hata tek satırda toplanır, kaç kez ve en son ne zaman olduğu görünür. "Çözüldü" denen hata tekrar olursa yeniden açılır.

## Yol haritası

Her faz en az 5 adımdan oluşur. Ekran önizlemeleri `docs/` klasöründe.

- [x] **Faz 1 · Temel:** kayıt, profil ve fotoğraflar, keşfet ve eşleşme, sohbet, jeton cüzdanı, ücretli istekler, engelleme ve şikayet
- [x] **Faz 2 · Görünüm ve ilk izlenim:** marka kimliği (Inter, mercan-turuncu gradyan, uygulama ikonu), 9 adımlı kayıt sihirbazı, ilgi alanları, profil soruları ve temel bilgiler, yeni keşfet kartı ve profil sayfası, yükleniyor iskeletleri ve animasyonlar, karanlık mod
- [x] **Faz 3 · Güven ve güvenlik:** e-posta doğrulama ve şifre sıfırlama, koşul onayı ve yasal metinler, hesap silme, hız sınırlama ve yasaklama, selfie ile mavi tik, web yönetim paneli
- [x] **Faz 4 · Etkileşim:** konum ve yaklaşık mesafe, yaş ve mesafe filtreleri, süper beğeni (30 jeton), öne çıkarma (150 jeton / 30 dk), seni beğenenler (200 jeton / 24 saat), okundu bilgisi, "yazıyor...", okunmamış sayacı, tek seferlik fotoğraf, uygulama içi bildirimler, FCM push altyapısı
- [x] **Faz 5 · Gerçek ödeme (IAP):** RevenueCat webhook'u ve senkronizasyon (aynı işlem iki kez yüklenmez), iadede jeton geri alma, 50 jeton kayıt hediyesi, %50 ilk alım bonusu, "en popüler" paket, mağazanın yerel fiyatları, yönetimde satış/gelir raporu. Mağaza hesapları yayına yakın bağlanacak.
- [x] **Faz 6 · Sesli ve görüntülü arama:** dakika başı ücret (sesli 15, görüntülü 30 jeton/dk), Agora altyapısı ve test modu, gelen/giden/görüşme ekranları, bulanık başlayan görüntü, arama içi hediyeler, arama sonrası puan ve sorun bildirimi, arama geçmişi, yönetimde arama istatistikleri
- [x] **Faz 7 · Para çekme ve yayın hazırlığı:** manuel onaylı para çekme (IBAN/PayPal, min. $20, mavi tik şartı), yönetimde Ödemeler ve Hatalar sekmeleri, uygulama ve sunucu hata takibi, yayında eksik ayarla açılmayan sunucu, `.env.example`, yayın rehberi, mağaza metinleri (TR/EN), yasal taslak güncellemeleri, GitHub özel depo

Yayın öncesi seri: önce uygulama (Faz 8–16), dış işler en sonda (Faz 17). Ayrıntılar, tespit edilen açıklar ve süre tahmini: [docs/yol-haritasi.md](docs/yol-haritasi.md)

- [x] **Faz 8 · Test altyapısı ve CI:** testler repoya, test veritabanı, birim ve Flutter testleri, arayüz turları, GitHub Actions, yük testi
- [x] **Faz 9 · Veri ve altyapı sağlamlaştırma:** PostgreSQL, kilitli cüzdan, kalıcı iş kuyruğu, çift işlem önleme, Redis, fotoğraf depolama
- [ ] **Faz 10 · Güvenlik sertleştirme:** EXIF temizleme, oturum yönetimi, yönetimde 2FA + roller + işlem kaydı, hassas veri şifreleme, ASVS denetimi
- [ ] **Faz 11 · KVKK uyumu:** veri envanteri, ayrı açık rızalar, yeniden onay, md. 11 hakları, otomatik imha, ihlal altyapısı
- [ ] **Faz 12 · İçerik güvenliği, moderasyon ve 5651:** trafik logları, görsel moderasyon katmanı, arama ve sohbet güvenliği, kaldırma süreçleri
- [ ] **Faz 13 · Para akışı güvenliği ve finans kayıtları:** kazanç olgunlaşma, kimlik ve IBAN eşleşmesi, dolandırıcılık kuralları, vergi alanları, finans raporları
- [ ] **Faz 14 · Tüketici hakları, destek ve mağaza uyumu:** mesafeli satış, destek talepleri, yardım merkezi, künye, mağaza kontrol listesi
- [ ] **Faz 15 · Gerçek zamanlı iletişim kalitesi:** yerel gelen arama ekranı, adil ücretlendirme, jeton yenileme, mesaj teslim garantisi
- [ ] **Faz 16 · Kullanım kolaylığı, erişilebilirlik ve performans:** ilk kullanım rehberi, durum ekranları, erişilebilirlik, düşük segment performansı
- [ ] **Faz 17 · Dış süreçler ve yayın:** avukat, mali müşavir, şirket ve marka, sunucu, mağaza hesapları, sızma testi, kapalı beta, yayın

## Notlar

- SQLite'ta Prisma `Json @default("[]")` alanları için hatalı bir varsayılan değer üretiyor (`DEFAULT []`). Uygulama her zaman değer gönderdiği için sorun olmuyor; eski satırlar `fix_json_defaults` migration'ı ile onarıldı. PostgreSQL'e geçince bu durum ortadan kalkacak.
- `npm run db:seed`, `@meetpoint.dev` ve `@test.com` hesaplarını silip demo verisini yeniden oluşturur.
