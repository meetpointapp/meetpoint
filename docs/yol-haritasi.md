# MeetPoint · Yayın öncesi yol haritası (Faz 8–17)

Faz 1–7 çalışan bir ürün çıkardı. Bu seri, ürünü **arka planda kusursuz, hukuki gereklilikleri uygulamanın içinde karşılayan ve kullanması basit** hale getirir.

**Sıralama kararı (2026-09-23, 2026-09-25'te Faz 16 ve 17 eklendi):** Önce uygulama tamamlanır (Faz 8–18). Avukat, mali müşavir, şirket, sunucu, mağaza ve yayın gibi dış işler en sona, Faz 19'a bırakılır.

Hukuki ve mali gereklilikler (KVKK, 5651, tüketici hakları, e-ticaret, vergi) uygulamada **şimdiden** kurulur. Avukatın görüşü sonradan değişiklik isterse maliyet düşük kalsın diye kurallar **ayarlanabilir** yapılır:

- Para çekme sağlayıcısı değiştirilebilir.
- Saklama süreleri, limitler ve yüzdeler ayar dosyasından değişir.
- Metinler sürümlüdür; değişince kullanıcıdan yeniden onay istenir.

Her fazda en az 5 adım var. İşaretler:

- 🛠 Yazılım: Claude yapar
- 👤 Senin kararın veya görevin
- ⏭ Faz 19'a bırakılan dış iş

---

## Bugünkü kodda tespit edilen açıklar

| # | Açık | Risk | Faz |
|---|---|---|---|
| 1 | ~~Sunucu testleri repoda değil~~ | ✅ Faz 8'de çözüldü | 8 |
| 2 | ~~Bakiye kontrolü kilitsiz~~ | ✅ Faz 9'da çözüldü (kilitli cüzdan) | 9 |
| 3 | ~~Arama zamanlayıcıları bellekte~~ | ✅ Faz 9'da çözüldü (veritabanı + lider seçimi) | 9 |
| 4 | ~~Fotoğraflarda EXIF/GPS~~ | ✅ Faz 9'da çözüldü (yeniden kodlama) | 9 |
| 5 | IBAN'lar veritabanında şifresiz | Veri sızıntısında finansal bilgi ifşası | 10 |
| 6 | Yönetim panelinde iki adımlı doğrulama, yetki seviyeleri ve işlem kaydı yok | Tek şifre ile tüm yetki; kim ne yaptı bilinmez | 10 |
| 7 | Oturum 30 gün geçerli, cihaz listesi ve oturum kapatma yok | Çalınan telefonda hesap açık kalır | 10 |
| 8 | Cinsel yönelim ve selfie için ayrı açık rıza yok | KVKK md. 6 özel nitelikli veri | 11 |
| 9 | Koşullar sürümü değişince yeniden onay istenmiyor | Güncel koşulları kabul etmemiş kullanıcılar | 11 |
| 10 | Kazanç anında çekilebiliyor | Alıcı mağazadan iade alırsa para kaybı (iade dolandırıcılığı) | 13 |
| 11 | Agora jetonu 1 saat geçerli, yenilenmiyor | 1 saatten uzun aramalar kopar | 15 |
| 12 | Uygulama kapalıyken gelen arama sadece bildirim olarak düşüyor | Aramaların çoğu kaçırılır | 15 |

### Faz 8'de bulunanlar

Faz 8 tamamlandı. Testler repoda: sunucuda 39 test (7 uçtan uca senaryo, 250+ kontrol), uygulamada 25 test, yük testi ve CI hazır. Testler şu sorunları yakaladı:

**Faz 8'de düzeltilenler:**
- Eşzamanlı yazmada SQLite kilitlenmesi: 20 eşzamanlı eşleşmede isteklerin %75'i 5–12 sn sonra hata veriyordu. Tek bağlantıyla hata sıfır, gecikme 0,2 sn.
- Hata takibi veritabanı yavaşlayınca yükü katlıyordu. Artık toplu yazılıyor.
- Yaş hesabı sunucunun saat dilimine bağlıydı: 18 yaş sınırı bir gün erken açılabiliyordu. Artık UTC.
- Sunucu cüzdan yanıtında bir alanı göndermezse cüzdan ekranı çöküyordu.
- Her "bulunamadı" hatası "Bu arama artık geçerli değil" gösteriyordu.
- 5 hata koduna mesaj eklendi. Örneğin desteklenmeyen fotoğraf biçiminde artık "Bir şeyler ters gitti" yerine açıklayıcı mesaj çıkıyor.
- 1 saati aşan aramada süre "1:62:03" gibi yanlış görünüyordu.

**Sonraki fazlara eklenenler:**

| Bulgu | Faz |
|---|---|
| ~~Şifre özeti (bcryptjs) saf JavaScript: toplu kayıtlarda sunucuyu bloke ediyor (20 eşzamanlı kayıtta p50 2,6 sn)~~ ✅ Argon2id | 10 |
| Keşfet tüm adayları belleğe alıp süzüyor (200 kullanıcıda p50 0,7 sn) | 9 |
| ~~Prisma CLI → deepmerge-ts (yüksek) ve firebase-admin → uuid (orta) güvenlik bildirimi~~ ✅ kapatıldı | 10 |
| ~~**Fiyat kararı:** "En popüler" 1000'lik paket jeton başına 500'lükten biraz pahalı~~ ✅ 18.99 $ | 13 |
| ~~**Ekonomi kararı:** bonus kazancı bozdurulabiliyordu; %30 mağaza payında 6000'lik paket zararda~~ ✅ bonus kazancı bozdurulamaz (Faz 9); oranlar panelden, zarar eden paket uyarılı (Faz 13) | 13 |

### Faz 9'da bulunanlar

Faz 9 tamamlandı. Sunucuda 51 test (13 uçtan uca senaryo), uygulamada 35 test; her test çalıştırması cüzdan defteri denetimiyle bitiyor.

**Düzeltilenler:**
- **Çift harcama:** PostgreSQL'in gerçek eşzamanlılığında görüldü (50 jetonla 10 istek → -450; 3'e yeten bakiyeyle 18 hediye → -3715). Kilitli cüzdanla kapandı.
- **Kontrol-yap yarışları:** öne çıkarma, beğenenleri açma, süper beğeni, istek, para çekme ve aynı kişiye eşzamanlı arama kontrolleri artık kilit altında.
- **Keşfet:** sadece en yeni 200 kullanıcıya bakıyordu. Kullanıcı sayısı büyüyünce eski süper beğenenler ve yakındakiler kayboluyordu.
- **Sohbet:** sadece son 50 mesaj görülebiliyordu. Sayfalama eklendi.
- **Arama ücretlendirmesi:** lider çökmesinde kaçırılan dakikalar yok sayılıyordu. Ses/görüntü Agora'da sürdüğü için kısa kesintide tamamlanıyor.
- **Anlık mesaj gecikmesi** yoğunlukta 0,58 sn'ye çıkmıştı; 0,11 sn'ye indi.
- **Test altyapısı:** Windows'ta test sunucuları başlatan süreçle birlikte ölüyordu; bir testin verisi diğerinin destesini dolduruyordu.

**Kullanıcı kararıyla eklenenler:** Bonus ve hediye jetonlarından gelen kazanç bozdurulamaz (cüzdan kovaları). 1000'lik paket $18.99.

**Yük testi (200 kullanıcı, PostgreSQL):** 2.920 işlem, hata yok, tutarlılık denetimlerinin hepsi geçti.

| İşlem | p95 |
|---|---|
| Keşfet | 114 ms |
| Kaydırma | 103 ms |
| Mesaj gönderme | 84 ms |
| Mesajın karşıya ulaşması | 125 ms |

### Faz 10'da bulunanlar

Faz 10 tamamlandı. Sunucuda 72 test (22 dosya), uygulamada 39 test; tam takım üç kez üst üste temiz.
Madde madde denetim: [guvenlik-denetimi.md](guvenlik-denetimi.md).

**Düzeltilenler:**
- **Oturum 30 gün geçerli tek jetondu:** çalınırsa kapatılamıyordu. Artık 15 dakikalık erişim + her kullanımda değişen yenileme jetonu; çalınan jeton tekrar kullanılırsa oturum kapanıyor.
- **Çıkış sadece cihazdaydı:** sunucuda oturum açık kalıyordu. Artık sunucuda da kapanıyor, anlık bağlantı da kesiliyor.
- **Yönetim paneli tek şifreyle açılıyordu:** şimdi 2FA zorunlu, roller ayrı, her işlem silinemez kayıtta.
- **IBAN ve PayPal adresleri düz metindi:** veritabanı yedeği sızsa okunabilirdi. Şimdi şifreli.
- **"password123" gibi şifreler kabul ediliyordu;** kaba kuvvete karşı sadece IP sınırı vardı.
- **Ek sunucu örneği zamanlayıcı liderliğine karışabiliyordu:** `SCHEDULER=off` ile sadece API sunucusu çalıştırılabiliyor.

**Açık kalan (bilinçli):** Uygulamaya Turnstile bileşeni anahtar alınınca eklenecek (sunucu hazır); anahtar döndürme betiği Faz 13'te.
**Sonradan bulunan:** Faz 10'daki sıkı CSP yasal metin sayfalarının stilini engelliyordu; Faz 11 başında düzeltildi (sayfaya özel CSP + test).

### Faz 14'te bulunanlar

Faz 14 tamamlandı. Sunucuda 131 test (29 dosya), uygulamada 42 test; arayüz turu `tools/ui-tours/faz14.mjs` ve önizleme `docs/faz14-onizleme.png`.

**Kullanıcı kararları:** cayma hakkı istisnası onayı ilk satın almadan önce bir kez (metin değişince tekrar), sonraki alımlarda özet satırı; destek = uygulama içi talep + panel kuyruğu + bildirim/e-posta, 48 saat hedef; bildirim tercihleri türe göre + sessiz saatler (aramalar muaf), kampanya bildirimi ayrı izin; yardım merkezi uygulamada ve web'de, panelden düzenlenir.

**Yapılanlar:**
- **Satın alma öncesi onay:** ön bilgilendirme formu (paket fiyatları tablodan otomatik) ve mesafeli satış sözleşmesi; işaretlenmemiş gelen açık onay kutusu (MSY md. 15/1-ğ). Onay Consent'e sürümüyle yazılır, her satın alma kaydı kabul edilen sürümü saklar; onay yoksa test yüklemesi 409 döner.
- **Destek:** kategori, konu, açıklama, ekran görüntüsü (EXIF silinerek, özel depoda), ilgili işlem (cüzdan hareketine dokunarak; başkasının kaydı iliştirilemez). Panel → Destek: kuyruk (hedef süreye göre), kullanıcı özeti, ilgili işlem, yanıtla/kapat, ölçümler (ortalama ilk yanıt, hedefe uyum). Ek görüntüleme işlem kaydında. Kapanan talepler 2 yıl sonra silinir; "Verilerimi indir"e eklendi.
- **Yardım merkezi:** 5 kategori, TR/EN 16'şar soru; fiyat ve süreler ayarlardan dolar (`{{voiceRate}}` vb.); Türkçe harf duyarlı arama; web'de `/help`.
- **Künye:** panelden (süper yönetici) doldurulan şirket bilgileri; `/legal/imprint`; kullanım koşulları, gizlilik, ön bilgilendirme ve sözleşmedeki `{{alan}}` yer tutucuları otomatik dolar, boşsa köşeli parantezle görünür.
- **Bildirimler ve İYS:** türe göre aç/kapa, sessiz saat (cihaz saat dilimiyle), kampanya e-postası ve kampanya bildirimi ayrı izin; panelden İYS toplu yükleme dosyası (e-posta izinlerinin son durumu).
- **Mağaza uyumu:** [magaza-uyum.md](magaza-uyum.md): Apple/Google kontrol listesi, Veri Güvenliği ve gizlilik etiketi cevapları, yaş derecelendirmesi, inceleme notu. Google'ın istediği web'den hesap silme sayfası (`/account/delete`) eklendi. Demo hesap: `npm run review:account`.

**Bulunan eksik:** Google Play, uygulama dışından (web) hesap silme bağlantısı istiyor; yoktu, eklendi.

**Açık sorular (Faz 19):** ⚠️ ücretli görüntülü aramanın Apple 1.1.4 / Google cinsel içerik kuralları açısından algısı; kazanç ödemesinin finansal özellik beyanı; satış metinleri ve onay kutusu metni avukat onayı; İYS dosya biçiminin güncel şablonla karşılaştırılması; iOS izin metinlerinin İngilizcesi (Xcode).

### Faz 13'te bulunanlar

Faz 13 tamamlandı. Sunucuda 116 test (27 dosya), uygulamada 42 test; tam takım iki kez üst üste temiz. Birim testlerindeki bekleyen ekonomi kuralı ("%30 mağaza payı") gerçek teste dönüştü.

**Kullanıcı kararları:** kazanç 14 gün olgunlaşır; para çekmek için ad-soyad + TC + kimlik fotoğrafı; zarar riski için ayarlar panelden, zarar eden paket kırmızı; aylık çekim tavanı 1.000 $ (aşan talep engellenmez, işaretlenir). Stopaj ayarlanabilir, şimdilik %0 (muhasebeci belirleyecek).

**Yapılanlar:**
- **Olgunlaşma ve iadede geri alma:** her transfer karşı tarafı kaydeder. Mağaza iadesi gelince, o jetonlarla karşı tarafa geçen ve henüz olgunlaşmamış kazanç alıcıdan geri alınır; kalanı ödeyenden. Olgunlaşmış kazanca dokunulmaz (risk 14 günle sınırlı).
- **Kimlik doğrulama:** ad-soyad, TC, belge şifreli; belge görüntüleme işlem kaydında; reddedilenin belgesi silinir; aynı TC ikinci hesapta doğrulanamaz; IBAN sahibi kimlikteki adla aynı olmalı (Türkçe harf/büyük-küçük farkı yok sayılır).
- **Risk işaretleri:** aylık tavan, yeni hesap, ödeyenle aynı cihaz/IP, kazancın tamamı tek kişiden.
- **Ödeme:** stopaj (brüt/stopaj/net), toplu EFT dosyası (TL kuru ile), toplu "ödendi", ödeme belgesi taslağı, kullanıcıya yıllık kazanç dökümü.
- **Finans:** ekonomi ayarları ve paketler veritabanında (panelden), paket kârlılık tablosu (şimdiki ve %30 payda), aylık rapor (satış, tahmini KDV/mağaza payı, iade, jeton akışı, yükümlülük, ödemeler, mutabakat) ve CSV.

**Bulunan hata:** mutabakat, kalıcı silinen hesapların satışlarını (satış kaydı kalıyor, cüzdan hareketleri siliniyor) fark olarak gösteriyordu; artık mevcut hesaplarla karşılaştırılıyor, silinen hesapların satışları ayrı satırda.

**Geliştirme veritabanında bilinen fark:** test@gmail.com hesabının Faz 5 öncesi (satış kaydı yokken) yapılmış 6000 jetonluk test yüklemesi raporda "fark" olarak görünür; yayında böyle bir kayıt olmaz.

**Açık sorular (Faz 19, muhasebeci/avukat):** stopaj oranı ve ödeme belgesi biçimi; ödeme yapılan kişinin TC'si hesap silindikten sonra saklanmalı mı; bankanın toplu EFT dosya biçimi.

### Faz 12'de bulunanlar

Faz 12 tamamlandı. Sunucuda 110 test (26 dosya), uygulamada 42 test; tam takım iki kez üst üste temiz.

**Kullanıcı kararları:** 5651 trafik kayıtları 2 yıl; sohbette iletişim bilgisi paylaşımı engellenmez, uyarılır ve tekrarında kuyruğa düşer; profil fotoğrafı hemen yayında, şüpheliyse gizlenip kuyruğa düşer; yaptırım basamakları uyarı → 24 saat → 7 gün → kalıcı, ağır ihlalde doğrudan yasak, her karara bir itiraz.

**Yapılanlar:**
- **5651 trafik kaydı:** içerik oluşturan her istek ve anlık bağlantı (IP, port, zaman, kullanıcı). Kayıtlar parti parti yazılır, her parti bir öncekinin hash'ini içerir; veritabanı değiştirmeyi/silmeyi reddeder. Panelden CSV dışa aktarım ve zincir doğrulama. Hesap silinse de saklanır.
- **Kademeli yaptırım ve kısıt:** kısıtlı kullanıcı okuyabilir ama mesaj, istek, beğeni, arama, fotoğraf ve profil değişikliği yapamaz. Yasaklı kullanıcı girişte itiraz formu görür.
- **Otomatik işaretler:** şüpheli fotoğraf (ten oranı / çok şikayetli hesap), tekrarlayan iletişim bilgisi paylaşımı, toplu mesaj, kısa sürede 3 farklı kişiden şikayet (→ otomatik 24 saat kısıt, moderatör kaldırabilir).
- **Moderasyon paneli:** öncelikli tek kuyruk (şikayet + işaret + itiraz), işlem süresi, kullanıcı geçmişi, resmi talepler (süre takibi).
- **Arama:** kurallar hatırlatması ve "bildir ve kapat".
- **Güvenlik merkezi ve topluluk kuralları** sayfaları.

**Bulunan hata:** sohbette "IBAN TR33 …" gibi önünde kelime olan IBAN yakalanmıyordu (boşlukların hepsi silinince kelimeye yapışıyordu); düzeltildi ve birim testine eklendi.

**Yayında yapılacak:** nginx'e `proxy_set_header X-Real-Port $remote_port;` (5651 için kaynak port; bkz. yayın rehberi).

### Faz 11'de bulunanlar

Faz 11 tamamlandı. Sunucuda 86 test (24 dosya), uygulamada 42 test.
Veri envanteri: [kvkk/veri-envanteri.md](kvkk/veri-envanteri.md) (koddan üretilir; yeni tablo envantere eklenmeden testler geçmez).

**Kullanıcı kararları:** Hesap silmede 30 gün bekleme (girişle geri gelir); 2 yıl hareketsiz hesap 30 gün önce uyarılıp silinir; "verilerimi indir" e-postayla tek kullanımlık ZIP bağlantısı (7 gün, ayda bir); yurt dışı aktarım için standart sözleşme + ayrı, geri alınabilir rıza (ayardan kapatılabilir: `OVERSEAS_CONSENT=off`).

**Düzeltilenler:**
- **Satın alma kayıtları hesapla birlikte siliniyordu:** muhasebe kaydı kayboluyordu. Artık hesap silinse de kalıyor (e-posta anlık görüntüsüyle).
- **Cinsel yönelim açık rızasız işleniyordu:** artık onboarding'de ayrı kutucuk; rıza yoksa profil keşfette görünmez.
- **Arama (Agora) ve bildirim (Firebase) için yurt dışı aktarım rızası yoktu.**
- **Selfie için ayrı rıza yoktu;** rıza geri alınınca selfie silinmiyordu.
- **Metin değişince yeniden onay alınmıyordu;** onayların sürümü ve zamanı kanıt olarak tutulmuyordu.
- **Süresi dolan veriler (kodlar, kapanmış oturumlar, açılmamış tek seferlik fotoğraflar) hiç silinmiyordu;** artık saatlik imha işi var, her imha değiştirilemez kayıtta.

**Test notu:** Bir tam koşuda arama testi bir kez düştü, ardından 3 koşu temiz; zamanlamaya bağlı bir kararsızlık olabilir, Faz 15'te (arama kalitesi) incelenecek.

---

## Faz 8 · Test altyapısı ve sürekli entegrasyon ✅

**Amaç:** Bundan sonraki büyük değişiklikler güvenle yapılabilsin. Her değişiklik otomatik test edilsin.

1. 🛠 Geçici klasördeki tüm sunucu testlerini (250+ kontrol) repoya taşı ve Vitest test çatısına çevir.
2. 🛠 Ayrı test veritabanı ve test sunucusu: tek komutla (`npm test`) temiz veriyle başlar, geliştirme verisine dokunmaz.
3. 🛠 Birim testleri: IBAN doğrulama, bozdurulabilir bakiye, hata parmak izi, mesafe ve konum yuvarlama, yaş hesabı.
4. 🛠 Flutter testleri: model ayrıştırma, biçimlendiriciler (IBAN, süre), kritik widget'lar (para çekme formu, arama özeti).
5. 🛠 Arayüz turları (ekran görüntülü uçtan uca kontroller) repoya, tek komutla çalışır halde.
6. 🛠 GitHub Actions: her gönderimde tip kontrolü, sunucu testleri, Flutter analyze ve testleri. GitHub deposu açılınca devreye girer.
7. 🛠 Yük testi betiği: eşzamanlı kullanıcı, mesajlaşma ve arama; darboğaz raporu.

## Faz 9 · Veri ve altyapı sağlamlaştırma ✅

**Amaç:** Para ve arama verisinin hiçbir koşulda bozulmaması; yeniden başlatmaya ve büyümeye dayanıklılık.

1. 🛠 **PostgreSQL'e geçiş.** Geliştirmede de PostgreSQL kullanılır; SQLite migration'ları tek başlangıç migration'ında toplanır.
2. 🛠 **Kilitli cüzdan.** Çift harcama imkânsız olur. Defter ile bakiyenin tutarlılığını doğrulayan otomatik kontrol eklenir.
3. 🛠 **Kalıcı iş kuyruğu.** Arama dakikaları, cevapsız arama, istek süresi ve imha işleri yeniden başlatmada kaldığı yerden devam eder.
4. 🛠 **Çift işlem önleme (idempotency).** Satın alma, hediye, mesaj ve para çekme tekrar gönderilse de bir kez işlenir.
5. 🛠 **Çok sunuculu çalışma.** Anlık bağlantılar ve hız sınırları sunucular arasında ortak. Redis yerine PostgreSQL kullanılır: bir servis eksik, lokalde test edilebilir.
6. 🛠 **Fotoğraf depolama.** Otomatik küçük ve orta boy üretimi, süreli imzalı bağlantılar, S3 uyumlu depolamaya hazır katman.
7. 🛠 **Sorgu disiplini.** İndeksler, sayfalama (keşfet, sohbet, geçmiş, panel listeleri), sorgu performans ölçümü. Keşfet filtrelemesi veritabanında yapılır; yük testi hedefi p95 < 300 ms.

## Faz 10 · Güvenlik sertleştirme ✅

**Amaç:** OWASP ASVS Seviye 2 düzeyine uygunluk.

1. ~~🛠 **Fotoğraf güvenliği.**~~ ✅ Faz 9'da yapıldı (yeniden kodlama, EXIF/GPS silme, gerçek tür kontrolü, imzalı adresler).
2. ✅ **Oturumlar.** Kısa ömürlü erişim jetonu ve yenileme; aktif cihazlar listesi; tek tek oturum kapatma; yeni cihaz girişinde e-posta uyarısı.
3. ✅ **Yönetim paneli.** İki adımlı doğrulama (TOTP), roller (moderatör / finans / süper yönetici), silinemez işlem kaydı.
4. ✅ **Hassas veri şifreleme.** IBAN, PayPal ve kimlik bilgileri alan düzeyinde şifreli; anahtar veritabanı dışında.
5. ✅ **Kötüye kullanım ve şifreler.** Bot koruması, cihaz başına hesap sınırı, sızdırılmış şifre kontrolü, şifre politikası. Şifre özeti yerel (native) Argon2id'ye geçer; mevcut şifreler girişte otomatik yükseltilir.
6. ✅ **Sunucu yapılandırması.** CORS kısıtı, güvenlik başlıkları, istek boyutu sınırları, hata mesajlarında iç bilgi sızmaması.
7. ✅ **İç güvenlik denetimi.** ASVS kontrol listesiyle madde madde tarama ve bulguların kapatılması. ⏭ Bağımsız sızma testi Faz 19'da.
8. ✅ **Bağımlılık güvenliği.** Prisma ve firebase-admin sürüm yükseltmeleriyle açık bildirimlerinin kapatılması.

## Faz 11 · KVKK uyumu (uygulama içi) ✅

**Amaç:** 6698 sayılı KVKK'nın uygulamada karşılanması gereken her şey.

1. ✅ **Veri envanteri.** Hangi veri, hangi amaçla, hangi hukuki sebeple, ne kadar süre, kime aktarılıyor. Envanter koddan üretilir ve güncel tutulur.
2. ✅ **Aydınlatma ve açık rıza ayrımı.**
   - Aydınlatma metni ayrı.
   - Ayrı kutucuklarla açık rıza: özel nitelikli veri (yönelim, selfie), yurt dışına aktarım, pazarlama.
   - Rıza geri alınabilir; her rızanın sürümü ve zamanı kaydedilir.
3. ✅ **Sürüm değişince yeniden onay.** Koşullar veya metinler değişince uygulama yeniden onay ister.
4. ✅ **İlgili kişi hakları (md. 11).**
   - Uygulamada "verilerimi indir", düzeltme, silme ve bilgi talebi.
   - Yönetim panelinde başvuru kuyruğu ve 30 günlük süre takibi.
5. ✅ **Saklama ve imha.** Politikaya bağlı otomatik imha işleri; her imha kaydedilir.
6. ✅ **Veri ihlali altyapısı.** Etkilenen kullanıcıları tespit ve bilgilendirme aracı, ihlal kayıt defteri.
7. ✅ **Metin taslakları.** Aydınlatma metni, açık rıza metinleri, saklama-imha politikası ve çerez metni taslakları. ⏭ Avukat onayı, VERBİS ve Kurul bildirimleri Faz 19'da.

## Faz 12 · İçerik güvenliği, moderasyon ve 5651 (uygulama içi) ✅

**Amaç:** Müstehcenlik, dolandırıcılık ve tacize karşı güçlü koruma; 5651 yükümlülüklerinin sistemde karşılanması.

1. ✅ **Trafik kayıtları.** IP, port ve zaman; hash zinciriyle bütünlük koruması; saklama süresi ayarlanabilir; resmi talep için dışa aktarım.
2. ✅ **Otomatik görsel moderasyon katmanı.** Profil fotoğrafları kural tabanlı kontrolden geçer; şüpheli olan gizlenip kuyruğa düşer. Görsel yapay zekâ sağlayıcısı sonradan takılır (`ImageModerator`). ⏭ Tek seferlik sohbet fotoğrafları otomatik kontrol edilmiyor (alıcı bildirebilir); selfie'ler zaten elle inceleniyor.
3. ✅ **Görüntülü arama güvenliği.** Arama öncesi kurallar hatırlatması, arama içinden "bildir ve kapat", tekrarlayan şikayette otomatik kısıt.
4. ✅ **Sohbet güvenliği.** Telefon, IBAN, e-posta, sosyal medya ve bağlantı paylaşımında uyarı ve işaret; toplu mesaj tespiti. ⏭ Eskort/müstehcen söz kalıpları için kelime listesi henüz yok (şikayetle yakalanıyor).
5. ✅ **Moderasyon paneli.** Öncelikli kuyruk, işlem süresi takibi, kullanıcı geçmişi, uyarı → kısıt → yasak kademeleri, itiraz akışı.
6. ✅ **Kaldırma ve resmi talepler.** Kaldırma kararı ve kolluk talebi kaydı, süre takibi, işlem geçmişi.
7. ✅ **Güvenlik merkezi.** Güvenli tanışma ipuçları, topluluk kuralları, yardım hatları.

## Faz 13 · Para akışı güvenliği ve finans kayıtları ✅

**Amaç:** Tek kuruş kaybetmeden para alıp ödemek; muhasebenin ihtiyaç duyacağı her kaydın hazır olması.

1. ✅ **Kazanç olgunlaşma süresi.** Kazanç, iade süresi boyunca bekler (süre ayarlanabilir). Olgunlaşmadan iade gelirse kazanç kendiliğinden düşer.
2. ✅ **Kimlik doğrulama katmanı.** Ad-soyad, TC (algoritma kontrolü, tekil), kimlik belgesi fotoğrafı (şifreli), IBAN sahibi eşleşmesi; panelden elle inceleme. ⏭ Doğrulama sağlayıcısı (e-Devlet/NFC) sonradan takılır.
3. ✅ **Dolandırıcılık kuralları.** Aynı cihaz, IP veya ödeme kaynağından hesaplar arası para döngüsü tespiti; günlük/aylık limitler; şüpheli talebin incelemeye düşmesi.
4. ✅ **Ödeme kanalı katmanı.** Bugünkü manuel akışa banka toplu EFT dosyası eklendi (genel CSV; bankanın kendi biçimi Faz 19'da hesap açılınca uyarlanır). ⏭ Lisanslı ödeme kuruluşu API'si sonradan takılır.
5. ✅ **Vergi alanları.** Ayarlanabilir stopaj oranı, ödeme belgesi taslağı, kullanıcıya yıllık kazanç dökümü.
6. ✅ **Finans raporları.** Satış–jeton mutabakatı, dolaşımdaki jeton yükümlülüğü, ödenen ve bekleyen ödemeler, iadeler; muhasebeye aylık dışa aktarım.
7. ✅ **TL fiyat yönetimi.** Mağaza fiyatlarının KDV dahil gösterimi; paket ve fiyatların panelden yönetimi.
8. ✅ **Fiyat ve bonus kararları.** Paketlerin jeton başı fiyat sırası; bonus ve hediye jetonlarının kazanca dönüşme kuralı (ör. bonus jetondan gelen kazanç bozdurulamaz ya da bozdurma kuru/bonus oranı ayarlanır). Birim testlerindeki bekleyen kurallar yeşile döner.

## Faz 14 · Tüketici hakları, destek ve mağaza uyumu (uygulama içi) ✅

**Amaç:** Tüketici Kanunu ve e-ticaret mevzuatının uygulamada karşılanması; Apple ve Google incelemesine hazır olmak.

1. ✅ **Satın alma öncesi bilgilendirme.** Ön bilgilendirme, mesafeli satış sözleşmesi, cayma hakkı istisnasına açık onay, jeton kullanım koşulları.
2. ✅ **Destek sistemi.** Uygulama içi destek talebi (kategori, ekran görüntüsü, ilgili işlem); panelde kuyruk ve yanıt; bildirimle geri dönüş.
3. ✅ **Yardım merkezi.** Jeton, arama, para çekme, güvenlik ve hesap için Türkçe/İngilizce SSS.
4. ✅ **Künye alanları.** Şirket unvanı, MERSİS, adres, KEP ve e-posta için ayarlanabilir alanlar; uygulamada ve web'de gösterim. Bilgiler Faz 19'da doldurulur.
5. ✅ **Mağaza politika kontrolü.** Apple ve Google kurallarının madde madde kontrol listesi ve eksiklerin kapatılması.
6. ✅ **Bildirim tercihleri ve İYS uyumu.** Bildirim türü bazında açma/kapama; pazarlama iletileri için ayrı izin kaydı.
7. ✅ **Mağaza form içerikleri.** Gizlilik etiketleri, Veri Güvenliği formu ve yaş derecelendirme cevapları (Faz 11 envanterinden); inceleme notu ve demo hesap.

## Faz 15 · Gerçek zamanlı iletişimde üretim kalitesi

**Amaç:** Arama ve mesajlaşmanın zayıf internette ve uygulama kapalıyken kusursuz çalışması; haksız ücret kesilmemesi.

1. 🛠 **Yerel gelen arama ekranı.** iOS'ta CallKit ve PushKit, Android'de tam ekran bildirim; kapalı uygulamada da arama çalar.
2. 🛠 **Adil ücretlendirme.** Agora sunucu olaylarıyla iki tarafın gerçekten bağlandığı doğrulanır. Bağlantı kurulmazsa ücret alınmaz. Kopmada net kısmi dakika kuralı.
3. 🛠 **Uzun ve kesintisiz aramalar.** Agora jetonu yenileme, ağ değişiminde yeniden bağlanma, bağlantı kalitesi göstergesi.
4. 🛠 **Mesaj teslim garantisi.** Çevrimdışı kuyruk, tekrar deneme, çift gönderim önleme, "iletildi" durumu, sıra garantisi.
5. 🛠 **Push güvenilirliği.** Yüksek öncelik, bildirimden doğru ekrana derin bağlantı, rozet sayaçları.
6. 🛠 **Arama itirazı.** Geçmişten hatalı ücret bildirimi, panelde inceleme ve jeton iadesi.
7. 🛠 **Emülatör ve simülatör testleri.** ⏭ Gerçek cihaz matrisi Faz 19'da.

## Faz 16 · Kimlik, premium katman ve mağaza

**Amaç:** Uygulamayı "sağlam bir Tinder/Bumble klonu" olmaktan çıkarıp kullanıcının kendi alanı gibi hissettirmesi; aynı zamanda jeton dışında yeni bir gelir katmanı eklemek — işletme maliyetini artırmadan (yapay zekâ/dış API yok, hepsi kendi sunucumuzda).

1. 🛠 **Kişisel profil vitrini.** Profil kartına renk teması, arkaplan ve "şu an" rozeti gibi kişiselleştirme seçenekleri; profil gerçekten kendi alanın gibi hissettirir.
2. 🛠 **Kendi odan, avatar ve ziyaret.** Dekore edilebilir statik bir profil odası (mobilya, duvar kağıdı) ve özelleştirilebilir çizgi avatar (fotoğraf yanında, sohbet balonlarında kullanılır). Eşleştiğin kişi odanı ziyaret edebilir (salt görüntüleme, gerçek zamanlı gezinme/çok oyunculu harita YOK — kapsam dışı bırakıldı, haftalar sürecek ayrı bir proje büyüklüğünde); "gel bizim eve" daveti gibi, dating ile kişisel alan temasını birleştiren en güçlü parça.
3. 🛠 **Günlük ruh hali.** Basit, ücretsiz bir "bugün nasılsın" paylaşımı (24 saatte kaybolur); günlük açılışı ve sohbeti tetikler.
4. 🛠 **İlgi alanı bazlı keşif.** Salt kaydırma yerine ortak ilgiye göre vitrinler/gruplar (ör. "kahve tutkunları", "gezginler"); daha sosyal, daha az hızlı-tüketim hissi.
5. 🛠 **Kozmetik mağaza.** Jetonla alınan profil çerçeveleri, temalar, rozetler, oda mobilyaları, avatar kıyafetleri ve sohbet temaları (baloncuk rengi, sohbet arka planı). Bu jetonlar kullanıcıdan kullanıcıya geçmediği için tamamı platform geliri — en yüksek marjlı özellik.
6. 🛠 **Abonelik katmanı (MeetPoint+).** RevenueCat üzerinden aylık abonelik ürünü (mevcut IAP altyapısına ek). Perkler (seni beğenenler her zaman açık, sınırsız geri alma, indirimli öne çıkarma vb.) ve fiyat, fazın başında karar sorularıyla netleşir.
7. 🛠 **Cilalı mikro-etkileşimler.** Geçiş animasyonları, haptik geri bildirim, ses tasarımı; bu fazdaki ve var olan tüm akışlara uygulanır — en ucuz ama en gözle görülür "kalite" yatırımı.

## Faz 17 · Oyunlaştırma, alışkanlık ve organik büyüme

**Amaç:** Uygulamayı "aç, kaydır, kapat" döngüsünden çıkarıp gerçek bir alışkanlığa dönüştürmek; reklam bütçesi olmadan, kullanıcıların kendi isteğiyle paylaşarak büyümesi. Hepsi kendi sunucumuzda, dış servis/API maliyeti olmadan.

1. 🛠 **Günlük giriş serisi (streak).** Art arda kaç gün açıldığı gösterilir; kırılma riski geri gelmeyi tetikler.
2. 🛠 **Başarı rozetleri.** "İlk eşleşme", "İlk arama", "Profilini %100 tamamladın" gibi; ilerlemeyi somutlaştırır.
3. 🛠 **Sosyal seviye.** Paraya değil etkileşime (sohbet, arama, profil tamamlama) dayalı seviye; seviye atlayınca Faz 16'daki kozmetik mağazadan ücretsiz bir ödül açılır.
4. 🛠 **Sohbet içi buz kırıcı mini oyunlar.** "2 doğru 1 yalan", "bu mu o mu" gibi hızlı soru-cevap formatları; var olan gerçek zamanlı altyapı (Socket.IO) üzerinden çalışır.
5. 🛠 **Sohbet içi iki kişilik mini oyun.** XOX (tic-tac-toe) gibi basit bir oyun; sohbeti mesajlaşmanın ötesine taşır.
6. 🛠 **Eşleşme yıldönümü.** "1 hafta oldu 🎉" gibi küçük kutlama anları; ilişkiye kişisel bir tarih hissi katar.
7. 🛠 **Haftalık özet.** "Bu hafta 3 yeni eşleşme, en uzun sohbetin X ile" gibi kural tabanlı, kişisel bir özet.
8. 🛠 **Davet programı.** Arkadaşını davet et, ikiniz de ödül kazanın (bozdurulamaz promo jeton, kayıt hediyesiyle aynı mekanik — gerçek maliyeti yok).
9. 🛠 **Paylaşılabilir anlar.** Eşleşme anını veya profil kartını kendi şablonumuzla görsele dönüştürüp Instagram/WhatsApp'a paylaşma; dış servis yok.
10. 🛠 **Odanı sergile.** Faz 16'daki dekore edilmiş odaların haftalık "en güzel odalar" galerisi; emek verilen bir şeyi paylaşma isteği doğal viral döngü yaratır.
11. 🛠 **Kişisel bağlantı linki.** "Beni MeetPoint'te bul" — paylaşılınca profile/indirmeye yönlendiren basit bir bağlantı.

## Faz 18 · Kullanım kolaylığı, erişilebilirlik ve performans

**Amaç:** "Profesyonel ama basit." Yeni kullanıcının hiçbir yerde takılmaması.

1. 🛠 **İlk kullanım rehberi.** Jeton, istek, arama ücreti ve kazanç kısa ve görsel olarak anlatılır; ilk satın alma ve ilk aramada tek seferlik ipuçları.
2. 🛠 **Durum ekranları.** Boş, yükleniyor, çevrimdışı ve hata ekranlarının tamamı tutarlı ve yönlendirici.
3. 🛠 **Erişilebilirlik.** Ekran okuyucu etiketleri, yazı boyutu ölçekleme, renk kontrastı, dokunma alanları.
4. 🛠 **Performans.** Düşük segment Android'de açılış süresi, kaydırma akıcılığı, görsel önbellek, uygulama boyutu.
5. 🛠 **Metin ve dil denetimi.** Türkçe ve İngilizce metinlerin tamamının tutarlılık ve anlaşılırlık kontrolü.
6. 🛠 **Gizlilik dostu kullanım analitiği.** Rızaya bağlı, kendi sunucumuzda: kayıt → eşleşme → ilk mesaj → ilk satın alma hunisi.
7. 🛠 **Uygulama içi geri bildirim.** Kullanıcının kolayca öneri ve hata bildirebilmesi.

## Faz 19 · Dış süreçler ve yayın

**Amaç:** Uygulama bittikten sonra, hepsi bir arada.

1. 👤 **Hukuk.** Avukata hazır dosya: iş modeli, para akışı, veri envanteri, metinler ve soru listesi. Sorulacaklar:
   - Jeton→nakit (6493)
   - Ücretli görüntülü aramada TCK 226/227 riski
   - 5651, 6563, BTK, VERBİS yükümlülükleri
   - Metin onayları
2. 👤 **Mali müşavir.** KDV, stopaj, jeton yükümlülüğü, dijital hizmet vergisi. Çıkan değerler ayarlara girilir.
3. 👤 **Şirket ve marka.** Şirket kuruluşu, TÜRKPATENT marka tescili, alan adı, künye bilgilerinin doldurulması, ETBİS ve İYS kayıtları.
4. 👤🛠 **Sunucu.** Türkiye'de barındırma, PostgreSQL, HTTPS, Cloudflare, otomatik dağıtım, izleme ve alarm, yedek ve geri yükleme tatbikatı, olay kitapçıkları.
5. 👤🛠 **Hesaplar ve anahtarlar.** Apple ve Google geliştirici hesapları, RevenueCat, Firebase, Agora, e-posta, kimlik doğrulama ve ödeme sağlayıcıları.
6. 👤 **Bağımsız sızma testi** ve bulguların kapatılması.
7. 👤🛠 **Gerçek cihaz testleri ve kapalı beta.** TestFlight ve Play dahili test ile 50–100 kişi, 2–4 hafta.
8. 👤🛠 **Yayın.** Mağaza başvuruları, kademeli açılış (önce sınırlı kitle), moderasyon ekibi hazır.

---

## Tahmini yazılım süresi

| Faz | Süre |
|---|---|
| 8 Test ve CI | 3–5 gün |
| 9 Veri ve altyapı | 5–8 gün |
| 10 Güvenlik | 5–7 gün |
| 11 KVKK | 4–6 gün |
| 12 Moderasyon ve 5651 | 5–8 gün |
| 13 Para akışı ve finans | 6–9 gün |
| 14 Tüketici ve mağaza | 4–6 gün |
| 15 Gerçek zamanlı kalite | 6–9 gün |
| 16 Kimlik, premium katman ve mağaza | 8–11 gün |
| 17 Oyunlaştırma, alışkanlık ve organik büyüme | 7–10 gün |
| 18 Kullanım kolaylığı | 4–6 gün |
| 19 Dış süreçler ve yayın | Dış taraflara bağlı; beta 2–4 hafta |
