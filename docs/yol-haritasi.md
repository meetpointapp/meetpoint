# MeetPoint · Yayın öncesi yol haritası (Faz 8–17)

Faz 1–7 çalışan bir ürün çıkardı. Bu seri, ürünü **hukuken güvenli, arka planda kusursuz ve işletilebilir** hale getirmek için. Yayın (eski "Faz 8") bu 10 fazın ardından **Faz 18** olarak gelir.

Her fazda en az 5 adım var. Adımlar üç türde:

- 🛠 Yazılım: Claude yapar
- 👤 Senin görevin: hesap açma, başvuru, karar
- ⚖️ Uzman: avukat veya mali müşavir görüşü

> Önemli not: Aşağıdaki hukuki maddeler bir hukukçunun görüşü değildir. Hangi konuların **sorulması gerektiğini** listeler. Kesin cevabı avukat ve mali müşavir verir. Faz 8 bu yüzden en başta: çıkan cevaplar diğer fazların içeriğini değiştirebilir.

---

## Bugünkü kodda tespit edilen açıklar

Yol haritası bunların hepsini kapatır:

| # | Açık | Risk | Faz |
|---|---|---|---|
| 1 | Sunucu testleri repoda değil, bilgisayarın geçici klasöründe | Klasör temizlenirse tüm testler kaybolur | 9 |
| 2 | Yüklenen fotoğraflar olduğu gibi saklanıyor (EXIF silinmiyor) | Telefonla çekilen fotoğraftaki GPS konumu diğer kullanıcılara sızabilir | 11 |
| 3 | Bakiye kontrolü kilitsiz (SQLite'ta sorun yok, PostgreSQL'de eşzamanlı iki harcama aynı jetonu iki kez harcayabilir) | Para kaybı | 10 |
| 4 | Arama ücretlendirme zamanlayıcıları bellekte | Sunucu yeniden başlarsa aramalar kesilir; birden fazla sunucuya büyünemez | 10 |
| 5 | Kazanç anında çekilebilir; alıcı mağazadan iade alırsa kazanç geri alınamaz | İade dolandırıcılığı ile para kaybı | 14 |
| 6 | Agora jetonu 1 saat geçerli, yenilenmiyor | 1 saatten uzun aramalar kopar | 16 |
| 7 | Kullanım koşulları sürümü değişince yeniden onay istenmiyor | Güncel koşulları kabul etmemiş kullanıcılar | 12 |
| 8 | "Kimle ilgilendiğin" bilgisi (cinsel yönelim) ve selfie için ayrı açık rıza yok | KVKK md. 6 özel nitelikli veri ihlali | 12 |
| 9 | IBAN'lar veritabanında şifresiz | Veri sızıntısında finansal bilgi ifşası | 11 |
| 10 | Yönetim panelinde iki adımlı doğrulama, yetki seviyeleri ve işlem kaydı yok | Tek şifre ile tüm yetki; kim ne yaptı bilinmez | 11 |
| 11 | Oturum 30 gün geçerli, cihaz listesi ve oturum kapatma yok | Çalınan telefonda hesap açık kalır | 11 |
| 12 | Uygulama kapalıyken gelen arama sadece bildirim olarak düşer | Aramaların çoğu kaçırılır | 16 |

---

## Faz 8 · Hukuki temel ve iş modeli doğrulaması

**Amaç:** Yazılıma devam etmeden önce iş modelinin Türkiye'de yasal olduğundan emin olmak. En riskli konu, jetonun nakde çevrilmesi ve ücretli görüntülü aramalar.

1. ⚖️ **Jeton → nakit modeli.** 6493 sayılı Kanun kapsamında elektronik para veya ödeme hizmeti sayılır mı? Sayılırsa lisanslı bir ödeme veya e-para kuruluşu (ör. iyzico, Papara, PayTR gibi pazaryeri modelleri) üzerinden ödeme yapmak şart mı? Model gerekirse değişir (ör. nakit yerine hediye çeki, ya da lisanslı aracı).
2. ⚖️ **Ücretli görüntülü arama riski.** TCK 226 (müstehcenlik) ve 227 (fuhuşa aracılık) açısından platform sorumluluğu nedir? Hangi tedbirler (moderasyon, yasaklar, bildirim, resmi makamlarla işbirliği) platformu korur? Bu cevap Faz 13'ün kapsamını belirler.
3. ⚖️ **Platform statüsü ve kayıtlar.** 5651'e göre "yer sağlayıcı" yükümlülükleri, 6563'e göre e-ticaret hizmet sağlayıcı yükümlülükleri (künye, ETBİS kaydı), İYS (pazarlama bildirimleri), BTK (internet üzerinden sesli/görüntülü iletişim yetkilendirme kapsamına giriyor mu?), VERBİS kaydı gerekip gerekmediği.
4. ⚖️ **Vergi.** Mali müşavirle netleşecekler:
   - Jeton satışında KDV ve faturalama (Apple ve Google'ın rolü)
   - Kullanıcıya yapılan kazanç ödemelerinde stopaj ve belge (gider pusulası, sosyal içerik üreticiliği istisnası uygulanır mı?)
   - "Jeton yükümlülüğü"nün muhasebesi (satılmış ama harcanmamış jeton)
   - Dijital hizmet vergisi eşiği
5. 👤 **Şirket ve marka.** Şirket türü (Ltd / AŞ), banka hesabı, uygulama adının kesinleşmesi, TÜRKPATENT'te marka araştırması ve tescil başvurusu (yazılım, iletişim ve tanışma hizmetleri sınıfları), alan adı.
6. 🛠 **Avukat dosyası.** Claude, avukata götürülecek bir dosya hazırlar: iş modeli, para akışı şeması, toplanan veriler, soru listesi. Çıkan görüşe göre Faz 12–15'teki metinler ve kurallar güncellenir.

**Bitti sayılır:** yazılı hukuki görüş ve mali müşavir görüşü alındı, iş modeline dair karar verildi.

---

## Faz 9 · Test altyapısı ve sürekli entegrasyon

**Amaç:** Bundan sonraki büyük değişiklikler (PostgreSQL, güvenlik, finans) güvenle yapılabilsin. Her değişiklik otomatik test edilsin.

1. 🛠 Geçici klasördeki tüm testleri (smoke, security, engagement, payments, calls, payouts, errors; 250+ kontrol) repoya taşı ve düzenli bir test çatısına (Vitest) çevir.
2. 🛠 Ayrı test veritabanı: her test temiz veriyle başlasın, testler birbirini etkilemesin (bugünkü "200 profil sınırı" sorunu gibi).
3. 🛠 Birim testleri: cüzdan hesapları, IBAN doğrulama, ücretlendirme, parmak izi, mesafe hesabı.
4. 🛠 Flutter testleri: model ayrıştırma, önemli widget'lar ve uçtan uca akışlar (kayıt, eşleşme, arama, satın alma, para çekme).
5. 🛠 GitHub Actions: her gönderimde tip kontrolü, testler, Flutter analyze ve derleme. Kırmızıysa birleştirme yok.
6. 🛠 Yük testi (k6): 1.000 eşzamanlı kullanıcı, 100 eşzamanlı arama, mesajlaşma. Darboğazlar raporlanır.
7. 🛠 Kod kalitesi: lint kuralları, bağımlılık güvenlik taraması (Dependabot / npm audit).

**Bitti sayılır:** tek komutla bütün testler çalışıyor ve GitHub'da her değişiklikte otomatik koşuyor.

---

## Faz 10 · Veri ve altyapı sağlamlaştırma

**Amaç:** Para ve arama verisinin hiçbir koşulda bozulmaması, sistemin yeniden başlatma ve büyümeye dayanıklı olması.

1. 🛠 **PostgreSQL'e geçiş.** Geliştirmede de PostgreSQL (Docker) kullanılır, ortamlar arasında fark kalmaz. SQLite'a özel migration'lar tek bir başlangıç migration'ında toplanır.
2. 🛠 **Cüzdan eşzamanlılığı.** Her kullanıcı için kilitlenen bir bakiye satırı; harcama, arama dakikası, hediye ve para çekme aynı anda gelse de çift harcama imkânsız. Defter (ledger) ile bakiye satırının tutarlılığını her gece doğrulayan bir kontrol.
3. 🛠 **Kalıcı iş kuyruğu.** Arama dakika ücretleri, cevapsız arama, istek süresi dolumu, veri imha ve e-posta gibi zamanlanmış işler bellekten çıkıp kalıcı kuyruğa (ör. pg-boss) taşınır. Sunucu yeniden başlasa bile kaldığı yerden devam eder.
4. 🛠 **Tekrarlanan istek güvenliği (idempotency).** Satın alma, hediye, mesaj ve para çekme istekleri bir anahtar ile gelir; ağ hatasında tekrar gönderilse bile iki kez işlenmez.
5. 🛠 **Yatay büyüme.** Redis ile Socket.IO ve hız sınırlarının birden fazla sunucuda ortak çalışması.
6. 🛠 **Dosya depolama.** Fotoğraflar nesne depolamaya (S3 uyumlu, Türkiye'de barındırma tercihli) taşınır. Küçük ve orta boy otomatik üretilir, erişim süreli imzalı bağlantılarla yapılır.
7. 🛠 **Veritabanı disiplini.** Eksik indeksler, sorgu performansı ve sayfalama (keşfet, sohbet, geçmiş) ile her tabloya kayıt ömrü (saklama süresi) etiketi.

**Bitti sayılır:** yük testinde tutarsız bakiye sıfır; sunucu arama ortasında yeniden başlatıldığında arama ve ücretlendirme kaldığı yerden devam ediyor.

---

## Faz 11 · Güvenlik sertleştirme

**Amaç:** OWASP ASVS Seviye 2 standardı ve dış güvenlik testinden temiz geçmek.

1. 🛠 **Fotoğraf güvenliği.** Tüm yüklemeler sunucuda yeniden kodlanır: EXIF ve GPS silinir, gerçek dosya türü doğrulanır, boyut sınırlanır.
2. 🛠 **Oturumlar.** Kısa ömürlü erişim jetonu ve yenilenebilir oturum; "aktif cihazlar" listesi ve tek tek oturum kapatma; şüpheli girişte e-posta uyarısı.
3. 🛠 **Yönetim paneli.**
   - İki adımlı doğrulama (TOTP)
   - Roller: moderatör / finans / süper yönetici
   - Her işlemin kaydı: kim, ne zaman, neyi değiştirdi; silinemez
   - Panel erişiminin IP ile sınırlanabilmesi
4. 🛠 **Hassas veri şifreleme.** IBAN, PayPal ve kimlik bilgileri veritabanında alan düzeyinde şifrelenir; anahtarlar sunucu dışında saklanır.
5. 🛠 **Kötüye kullanım.** Kayıt ve girişte bot koruması, cihaz başına hesap sınırı, sızdırılmış şifre kontrolü, şifre politikası.
6. 🛠 **Güvenlik başlıkları ve yapılandırma.** CORS kısıtlama, güvenlik başlıkları (helmet), yükleme ve istek boyutu sınırları, hata mesajlarında iç bilgi sızmaması.
7. 👤⚖️ **Bağımsız sızma testi (pentest)** ve bulguların kapatılması.

**Bitti sayılır:** pentest raporunda kritik ve yüksek bulgu kalmadı.

---

## Faz 12 · KVKK uyumu

**Amaç:** 6698 sayılı KVKK'ya tam uyum. Tanışma uygulaması özel nitelikli veri (cinsel hayat / yönelim, selfie) işlediği için bu faz kritik.

1. ⚖️🛠 **Veri envanteri.** Hangi veri, hangi amaçla, hangi hukuki sebeple, ne kadar süre, kime aktarılıyor? Tablo halinde; teknik tarafı Claude çıkarır, avukat onaylar.
2. 🛠 **Aydınlatma ve açık rıza ayrımı.**
   - Aydınlatma metni ayrı.
   - Açık rızalar ayrı, ayrı ve kutucukla: özel nitelikli veri (yönelim, selfie), yurt dışına aktarım (Agora, Firebase, RevenueCat), pazarlama iletişimi.
   - Rıza geri alınabilir.
   - Her rızanın sürümü ve zamanı kaydedilir.
3. 🛠 **Sürüm değişince yeniden onay.** Koşullar veya aydınlatma metni değişince uygulama kullanıcıdan yeniden onay ister.
4. 🛠 **İlgili kişi hakları (md. 11).**
   - Uygulama içinden "verilerimi indir", düzeltme ve silme.
   - Yönetim panelinde başvuru kuyruğu ve 30 günlük süre takibi.
5. 🛠 **Saklama ve imha.** Politikaya uygun otomatik imha işleri: silinen hesap artıkları, eski oturumlar, süresi dolan loglar, reddedilen selfie'ler. Her imha kaydedilir.
6. ⚖️👤 **Yurt dışı aktarım.** Agora, Firebase ve RevenueCat için 2024 değişikliği sonrası kurallara göre standart sözleşme ve Kurul'a bildirim. Sunucunun Türkiye'de barındırılması değerlendirilir.
7. ⚖️👤 **Veri ihlali müdahale planı.** 72 saat içinde Kurul'a bildirim prosedürü. VERBİS kaydı gerekiyorsa yapılır.

**Bitti sayılır:** avukat veri envanterini ve metinleri onayladı; uygulamadaki rıza akışı metinlerle birebir örtüşüyor.

---

## Faz 13 · İçerik güvenliği, moderasyon ve 5651

**Amaç:** Platformun müstehcenlik, dolandırıcılık ve taciz için kullanılmasını önlemek, 5651 yükümlülüklerini yerine getirmek. Bu fazın kapsamı Faz 8'deki TCK görüşüne göre kesinleşir.

1. 🛠 **Trafik kayıtları (5651).**
   - Giriş ve işlem erişim kayıtları (IP, port, zaman) mevzuatın öngördüğü sürede saklanır.
   - Bütünlüğü korunur: hash zinciri ve zaman damgası.
   - Resmi talepte dışa aktarılır.
2. 🛠 **Otomatik görsel moderasyon.** Profil fotoğrafı, sohbet fotoğrafı ve selfie'lerde çıplaklık, şiddet ve reşit olmayan şüphesi tespiti. Şüpheli içerik yayına girmeden moderasyon kuyruğuna düşer.
3. 🛠 **Görüntülü arama güvenliği.**
   - Yetişkin içerik yasağı arama öncesi hatırlatılır.
   - Arama içinden tek dokunuşla "bildir ve kapat".
   - Tekrarlayan şikayetlerde otomatik arama kısıtı.
   - Hukuki görüşe göre gerekirse cihazda çıplaklık tespiti ve bulanıklaştırma.
4. 🛠 **Sohbet güvenliği.** Dolandırıcılık, eskort, IBAN ve telefon paylaşımı gibi kalıplar için uyarı ve işaretleme; toplu mesaj ve spam tespiti.
5. 🛠 **Moderasyon paneli.** Öncelikli kuyruk, işlem süresi (SLA) takibi, kullanıcı geçmişi, uyarı → kısıtlama → yasak kademeleri, itiraz akışı.
6. 🛠👤 **Hukuka aykırı içerik ve resmi talepler.**
   - Kaldırma kararlarının işlenmesi, süre takibi ve kayıt.
   - Kolluk ve yargı talepleri için yazılı prosedür ve sorumlu kişi.
7. 🛠 **Güvenlik merkezi.** Uygulama içinde güvenli tanışma ipuçları, yardım hatları ve topluluk kuralları.

**Bitti sayılır:** yetişkin içerikli test fotoğrafları otomatik yakalanıyor; bir kaldırma talebi uçtan uca süre içinde işlenebiliyor.

---

## Faz 14 · Para akışı güvenliği, KYC ve muhasebe

**Amaç:** Tek kuruş kaybetmeden ve mevzuata uygun şekilde para almak ve ödemek. Kapsam Faz 8'deki 6493 ve vergi görüşüne göre kesinleşir.

1. 🛠 **Kazanç olgunlaşma süresi.** Kazanılan jeton, mağaza iade süresi boyunca (ör. 14–30 gün) "bekleyen kazanç" olarak durur, sonra çekilebilir olur. Olgunlaşmadan iade gelirse kazanç kendiliğinden düşer.
2. 🛠 **Kimlik doğrulama (KYC).**
   - Para çekmeden önce ad-soyad ve TC kimlik doğrulaması (lisanslı bir e-KYC sağlayıcısı ile).
   - IBAN sahibinin doğrulanmış kişiyle eşleşme kontrolü.
3. 🛠 **Dolandırıcılık kuralları.**
   - Aynı cihaz, IP veya ödeme kaynağından hesaplar arası para döngüsü (kendi kendine arama) tespiti.
   - Hız ve tutar limitleri (günlük/aylık).
   - Şüpheli işlemler ödeme öncesi manuel incelemeye düşer.
4. ⚖️🛠 **Ödeme kanalı.** Hukuki görüşe göre:
   - Lisanslı ödeme kuruluşu API'si ile otomatik ödeme, ya da
   - Manuel ödeme için banka toplu EFT dosyası dışa aktarımı.
   - Her iki durumda mutabakat kaydı tutulur.
5. ⚖️🛠 **Vergi ve belgeler.** Mali müşavirin belirlediği şekilde stopaj hesaplama, ödeme belgesi üretimi ve kullanıcıya yıllık kazanç dökümü.
6. 🛠 **Finans raporları.** Mağaza geliri ile satılan jeton mutabakatı; jeton yükümlülüğü (dolaşımdaki jeton); ödenen ve bekleyen ödemeler; iade ve geri alımlar. Muhasebeciye aylık dışa aktarım.
7. 🛠 **TL fiyatlandırma.** Mağaza yerel fiyatlarının KDV dahil gösterimi; Türkiye için paket fiyatlarının enflasyona göre güncellenebilir yönetimi.

**Bitti sayılır:** iade → kazanç geri alma, kendi kendine para döngüsü ve limit aşımı senaryoları testte yakalanıyor; muhasebeci aylık raporu onayladı.

---

## Faz 15 · Tüketici hakları, destek ve mağaza uyumu

**Amaç:** 6502 sayılı Tüketici Kanunu ve Mesafeli Sözleşmeler Yönetmeliği'ne uymak, Apple ve Google incelemesinden ilk seferde geçmek.

1. ⚖️🛠 **Satın alma öncesi bilgilendirme.** Ön bilgilendirme ve mesafeli satış sözleşmesi. Dijital içeriğin anında ifası nedeniyle cayma hakkı istisnasına açık onay. Jetonların süresi ve kullanım koşulları.
2. 🛠 **Destek sistemi.**
   - Uygulama içinden destek talebi: kategori, ekran görüntüsü, ilgili işlem.
   - Yönetim panelinde talep kuyruğu ve yanıtlama.
   - Kullanıcıya bildirim ve e-posta ile yanıt.
3. 🛠 **Yardım merkezi.** Jeton, arama ücretleri, para çekme, güvenlik ve hesap silme için Türkçe ve İngilizce SSS.
4. 🛠👤 **Künye ve iletişim (6563).** Şirket unvanı, MERSİS, adres, e-posta ve KEP bilgilerinin uygulama ve web sitesinde yer alması. ETBİS kaydı.
5. 🛠 **Mağaza politika kontrolü.**
   - Apple 1.2: kullanıcı içeriği için filtre, bildir, engelle ve iletişim bilgisi.
   - Apple 3.1.1: hediye ve jeton için uygulama içi satın alma.
   - Google Play'in tanışma, kullanıcı içeriği ve finansal özellik politikaları.
   - Uygulama içi hesap silme.
   - Her madde tek tek kontrol listesiyle işaretlenir.
6. 👤🛠 **Mağaza formları.** Gizlilik etiketleri ve Veri Güvenliği formu (Faz 12 envanterinden), yaş derecelendirmesi, inceleme için demo hesap ve not.
7. 🛠 **Bildirim tercihleri ve İYS.** Kullanıcı hangi bildirimleri alacağını seçer; pazarlama iletileri İYS'ye uygun izinle gönderilir.

**Bitti sayılır:** mağaza kontrol listesi eksiksiz; destek talebi uçtan uca çalışıyor.

---

## Faz 16 · Gerçek zamanlı iletişimde üretim kalitesi

**Amaç:** Arama ve mesajlaşmanın gerçek telefonlarda, zayıf internette ve uygulama kapalıyken kusursuz çalışması; kullanıcıya haksız ücret kesilmemesi.

1. 🛠 **Yerel gelen arama ekranı.**
   - iOS: CallKit ve PushKit ile kilit ekranında gerçek arama ekranı.
   - Android: tam ekran bildirim ve ConnectionService.
   - Uygulama kapalıyken de arama çalar.
2. 🛠 **Adil ücretlendirme.** Agora sunucu olaylarıyla iki tarafın da kanala gerçekten bağlandığı doğrulanır. Ses/görüntü kurulamazsa dakika ücreti alınmaz. Kopmada kesin kısmi dakika kuralı uygulanır.
3. 🛠 **Uzun ve kesintisiz aramalar.** Agora jetonunun süresi dolmadan yenilenmesi, ağ değişiminde (Wi-Fi ↔ mobil) yeniden bağlanma, bağlantı kalitesi göstergesi.
4. 🛠 **Mesaj teslim garantisi.** Çevrimdışı kuyruk, tekrar deneme, çift gönderim önleme, "iletildi" durumu, sıralama garantisi.
5. 🛠 **Push güvenilirliği.** Yüksek öncelikli bildirimler, bildirimden doğru ekrana gitme (derin bağlantı), bildirim sayaçları.
6. 🛠👤 **Gerçek cihaz test matrisi.** Düşük ve orta segment Android, eski ve yeni iPhone, 3G/4G/zayıf Wi-Fi; pil ve veri tüketimi ölçümü.
7. 🛠 **Arama itirazı.** Kullanıcı hatalı ücretlendirmeyi arama geçmişinden bildirir; yönetimde inceleme ve jeton iadesi.

**Bitti sayılır:** test matrisinde uygulama kapalıyken gelen aramaların hepsi çalıyor; bağlantısız dakikalarda ücret alınmıyor.

---

## Faz 17 · Üretim ortamı, izleme ve kapalı beta

**Amaç:** Yayından önce gerçek sunucuda, gerçek kullanıcılarla, kontrollü bir deneme.

1. 👤🛠 **Ortamlar.** Türkiye'de barındırılan hazırlık (staging) ve üretim sunucuları. HTTPS, Cloudflare ile DDoS koruması, alan adı ve e-posta altyapısı (SPF/DKIM).
2. 🛠 **Otomatik dağıtım.** GitHub'dan tek adımla dağıtım, migration'ların güvenli uygulanması, geri alma planı.
3. 🛠 **İzleme ve alarm.** Çalışma süresi, hata oranı, yanıt süresi, aktif arama, ödeme kuyruğu ve disk metrikleri. Eşik aşılınca Telegram veya e-posta alarmı. Durum sayfası.
4. 🛠👤 **Yedek ve felaket kurtarma.** Şifreli gece yedekleri ve farklı konumda kopya. Ayda bir "yedekten geri yükleme" tatbikatı. Hedef süreler yazılı olarak belirlenir.
5. 🛠 **Olay kitapçıkları.** Sunucu çöktü, veri ihlali, ödeme hatası, kaldırma kararı, yoğun şikayet dalgası: her biri için adım adım ne yapılacağı.
6. 👤🛠 **Kapalı beta.**
   - TestFlight ve Play dahili test ile 50–100 kişi.
   - KVKK onaylı, gizlilik dostu kullanım analitiği (kayıt → eşleşme → ilk mesaj → ilk satın alma hunisi).
   - Uygulama içi geri bildirim.
7. 🛠 **Beta bulgularının kapatılması.** Hatalar, arayüz cilası, fiyat ayarı, performans. Son hukuki kontrol ve Faz 18 (yayın) kararı.

**Bitti sayılır:** beta 2–4 hafta boyunca kritik hata olmadan sürdü; alarmlar ve yedek geri yükleme test edildi.

---

## Faz 18 · Yayın

Mağaza başvuruları, kademeli açılış (önce tek şehir / sınırlı kitle), moderasyon ekibi hazır. Ayrıntıları Faz 17 sonunda planlanır.

---

## Tahmini süre ve sıralama

- **Faz 8 hemen başlamalı**, çünkü avukat ve müşavir süreçleri haftalar alır.
- Faz 9 ve 10 bu sırada paralel yürüyebilir: hukuki cevaplardan bağımsızlar.
- Faz 11–16'nın bazı maddeleri Faz 8 sonucuna bağlı (⚖️ işaretli olanlar).
- Faz 17 en sonda.

| Faz | Tahmini yazılım süresi | Dış bağımlılık |
|---|---|---|
| 8 Hukuki temel | 1–2 gün (dosya hazırlığı) | Avukat, müşavir: 2–6 hafta |
| 9 Test ve CI | 3–5 gün | — |
| 10 Altyapı | 5–8 gün | — |
| 11 Güvenlik | 5–7 gün | Pentest firması |
| 12 KVKK | 4–6 gün | Avukat onayı |
| 13 Moderasyon ve 5651 | 5–8 gün | Moderasyon API'si |
| 14 Finans ve KYC | 6–9 gün | e-KYC ve ödeme sağlayıcı, müşavir |
| 15 Tüketici ve mağaza | 4–6 gün | Şirket bilgileri |
| 16 Gerçek zamanlı kalite | 6–9 gün | Agora, Apple/Google hesapları, test telefonları |
| 17 Üretim ve beta | 4–6 gün + 2–4 hafta beta | Sunucu, beta kullanıcıları |
