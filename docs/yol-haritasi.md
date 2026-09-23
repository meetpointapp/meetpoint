# MeetPoint · Yayın öncesi yol haritası (Faz 8–17)

Faz 1–7 çalışan bir ürün çıkardı. Bu seri, ürünü **arka planda kusursuz, hukuki gereklilikleri uygulamanın içinde karşılayan ve kullanması basit** hale getirir.

**Sıralama kararı (2026-09-23):** Önce uygulama tamamlanır (Faz 8–16). Avukat, mali müşavir, şirket, sunucu, mağaza ve yayın gibi dış işler en sona, Faz 17'ye bırakılır.

Hukuki ve mali gereklilikler (KVKK, 5651, tüketici hakları, e-ticaret, vergi) uygulamada **şimdiden** kurulur. Avukatın görüşü sonradan değişiklik isterse maliyet düşük kalsın diye kurallar **ayarlanabilir** yapılır:

- Para çekme sağlayıcısı değiştirilebilir.
- Saklama süreleri, limitler ve yüzdeler ayar dosyasından değişir.
- Metinler sürümlüdür; değişince kullanıcıdan yeniden onay istenir.

Her fazda en az 5 adım var. İşaretler:

- 🛠 Yazılım: Claude yapar
- 👤 Senin kararın veya görevin
- ⏭ Faz 17'ye bırakılan dış iş

---

## Bugünkü kodda tespit edilen açıklar

| # | Açık | Risk | Faz |
|---|---|---|---|
| 1 | ~~Sunucu testleri repoda değil~~ | ✅ Faz 8'de çözüldü | 8 |
| 2 | Bakiye kontrolü kilitsiz | PostgreSQL'de eşzamanlı iki harcama aynı jetonu iki kez harcayabilir | 9 |
| 3 | Arama ücretlendirme zamanlayıcıları bellekte | Sunucu yeniden başlarsa aramalar kesilir; birden fazla sunucuya büyünemez | 9 |
| 4 | Yüklenen fotoğraflar olduğu gibi saklanıyor (EXIF silinmiyor) | Fotoğraftaki GPS konumu diğer kullanıcılara sızabilir | 10 |
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
| Şifre özeti (bcryptjs) saf JavaScript: toplu kayıtlarda sunucuyu bloke ediyor (20 eşzamanlı kayıtta p50 2,6 sn) | 10 |
| Keşfet tüm adayları belleğe alıp süzüyor (200 kullanıcıda p50 0,7 sn) | 9 |
| Prisma CLI → deepmerge-ts (yüksek) ve firebase-admin → uuid (orta) güvenlik bildirimi; çalışan sunucuda kullanılmıyor | 10 |
| **Fiyat kararı:** "En popüler" 1000'lik paket jeton başına 500'lükten biraz pahalı | 13 |
| **Ekonomi kararı:** %50 ilk alım bonusu ve kayıt hediyesi, harcanınca başkasının bozdurulabilir kazancına dönüşüyor. KDV ve mağaza payından sonra jeton başı gelir bozdurma kurunun altına inebiliyor (zarar). %30 mağaza payında 6000'lik paket bonussuz da zararda. | 13 |

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

## Faz 9 · Veri ve altyapı sağlamlaştırma

**Amaç:** Para ve arama verisinin hiçbir koşulda bozulmaması; yeniden başlatmaya ve büyümeye dayanıklılık.

1. 🛠 **PostgreSQL'e geçiş.** Geliştirmede de PostgreSQL kullanılır; SQLite migration'ları tek başlangıç migration'ında toplanır.
2. 🛠 **Kilitli cüzdan.** Çift harcama imkânsız olur. Defter ile bakiyenin tutarlılığını doğrulayan otomatik kontrol eklenir.
3. 🛠 **Kalıcı iş kuyruğu.** Arama dakikaları, cevapsız arama, istek süresi ve imha işleri yeniden başlatmada kaldığı yerden devam eder.
4. 🛠 **Çift işlem önleme (idempotency).** Satın alma, hediye, mesaj ve para çekme tekrar gönderilse de bir kez işlenir.
5. 🛠 **Çok sunuculu çalışma.** Redis ile anlık bağlantılar ve hız sınırları ortak tutulur.
6. 🛠 **Fotoğraf depolama.** Otomatik küçük ve orta boy üretimi, süreli imzalı bağlantılar, S3 uyumlu depolamaya hazır katman.
7. 🛠 **Sorgu disiplini.** İndeksler, sayfalama (keşfet, sohbet, geçmiş, panel listeleri), sorgu performans ölçümü. Keşfet filtrelemesi veritabanında yapılır; yük testi hedefi p95 < 300 ms.

## Faz 10 · Güvenlik sertleştirme

**Amaç:** OWASP ASVS Seviye 2 düzeyine uygunluk.

1. 🛠 **Fotoğraf güvenliği.** Yeniden kodlama, EXIF/GPS silme, gerçek dosya türü ve boyut kontrolü.
2. 🛠 **Oturumlar.** Kısa ömürlü erişim jetonu ve yenileme; aktif cihazlar listesi; tek tek oturum kapatma; yeni cihaz girişinde e-posta uyarısı.
3. 🛠 **Yönetim paneli.** İki adımlı doğrulama (TOTP), roller (moderatör / finans / süper yönetici), silinemez işlem kaydı.
4. 🛠 **Hassas veri şifreleme.** IBAN, PayPal ve kimlik bilgileri alan düzeyinde şifreli; anahtar veritabanı dışında.
5. 🛠 **Kötüye kullanım ve şifreler.** Bot koruması, cihaz başına hesap sınırı, sızdırılmış şifre kontrolü, şifre politikası. Şifre özeti yerel (native) Argon2id'ye geçer; mevcut şifreler girişte otomatik yükseltilir.
6. 🛠 **Sunucu yapılandırması.** CORS kısıtı, güvenlik başlıkları, istek boyutu sınırları, hata mesajlarında iç bilgi sızmaması.
7. 🛠 **İç güvenlik denetimi.** ASVS kontrol listesiyle madde madde tarama ve bulguların kapatılması. ⏭ Bağımsız sızma testi Faz 17'de.
8. 🛠 **Bağımlılık güvenliği.** Prisma ve firebase-admin sürüm yükseltmeleriyle açık bildirimlerinin kapatılması.

## Faz 11 · KVKK uyumu (uygulama içi)

**Amaç:** 6698 sayılı KVKK'nın uygulamada karşılanması gereken her şey.

1. 🛠 **Veri envanteri.** Hangi veri, hangi amaçla, hangi hukuki sebeple, ne kadar süre, kime aktarılıyor. Envanter koddan üretilir ve güncel tutulur.
2. 🛠 **Aydınlatma ve açık rıza ayrımı.**
   - Aydınlatma metni ayrı.
   - Ayrı kutucuklarla açık rıza: özel nitelikli veri (yönelim, selfie), yurt dışına aktarım, pazarlama.
   - Rıza geri alınabilir; her rızanın sürümü ve zamanı kaydedilir.
3. 🛠 **Sürüm değişince yeniden onay.** Koşullar veya metinler değişince uygulama yeniden onay ister.
4. 🛠 **İlgili kişi hakları (md. 11).**
   - Uygulamada "verilerimi indir", düzeltme, silme ve bilgi talebi.
   - Yönetim panelinde başvuru kuyruğu ve 30 günlük süre takibi.
5. 🛠 **Saklama ve imha.** Politikaya bağlı otomatik imha işleri; her imha kaydedilir.
6. 🛠 **Veri ihlali altyapısı.** Etkilenen kullanıcıları tespit ve bilgilendirme aracı, ihlal kayıt defteri.
7. 🛠 **Metin taslakları.** Aydınlatma metni, açık rıza metinleri, saklama-imha politikası ve çerez metni taslakları. ⏭ Avukat onayı, VERBİS ve Kurul bildirimleri Faz 17'de.

## Faz 12 · İçerik güvenliği, moderasyon ve 5651 (uygulama içi)

**Amaç:** Müstehcenlik, dolandırıcılık ve tacize karşı güçlü koruma; 5651 yükümlülüklerinin sistemde karşılanması.

1. 🛠 **Trafik kayıtları.** IP, port ve zaman; hash zinciriyle bütünlük koruması; saklama süresi ayarlanabilir; resmi talep için dışa aktarım.
2. 🛠 **Otomatik görsel moderasyon katmanı.** Profil, sohbet ve selfie fotoğraflarında şüpheli içerik yayından önce kuyruğa düşer. Sağlayıcı sonradan takılır; şimdilik kural tabanlı ve manuel kuyruk.
3. 🛠 **Görüntülü arama güvenliği.** Arama öncesi kurallar hatırlatması, arama içinden "bildir ve kapat", tekrarlayan şikayette otomatik kısıt.
4. 🛠 **Sohbet güvenliği.** Dolandırıcılık, eskort, IBAN ve telefon paylaşımı kalıpları için uyarı ve işaret; spam ve toplu mesaj tespiti.
5. 🛠 **Moderasyon paneli.** Öncelikli kuyruk, işlem süresi takibi, kullanıcı geçmişi, uyarı → kısıt → yasak kademeleri, itiraz akışı.
6. 🛠 **Kaldırma ve resmi talepler.** Kaldırma kararı ve kolluk talebi kaydı, süre takibi, işlem geçmişi.
7. 🛠 **Güvenlik merkezi.** Güvenli tanışma ipuçları, topluluk kuralları, yardım hatları.

## Faz 13 · Para akışı güvenliği ve finans kayıtları

**Amaç:** Tek kuruş kaybetmeden para alıp ödemek; muhasebenin ihtiyaç duyacağı her kaydın hazır olması.

1. 🛠 **Kazanç olgunlaşma süresi.** Kazanç, iade süresi boyunca bekler (süre ayarlanabilir). Olgunlaşmadan iade gelirse kazanç kendiliğinden düşer.
2. 🛠 **Kimlik doğrulama katmanı.** Ad-soyad ve TC kimlik alanları, IBAN sahibi eşleşmesi. Doğrulama sağlayıcısı sonradan takılır; şimdilik panelden manuel belge inceleme.
3. 🛠 **Dolandırıcılık kuralları.** Aynı cihaz, IP veya ödeme kaynağından hesaplar arası para döngüsü tespiti; günlük/aylık limitler; şüpheli talebin incelemeye düşmesi.
4. 🛠 **Ödeme kanalı katmanı.** Bugünkü manuel akışa banka toplu EFT dosyası eklenir; lisanslı ödeme kuruluşu API'si sonradan aynı yere takılır.
5. 🛠 **Vergi alanları.** Ayarlanabilir stopaj oranı, ödeme belgesi taslağı, kullanıcıya yıllık kazanç dökümü.
6. 🛠 **Finans raporları.** Satış–jeton mutabakatı, dolaşımdaki jeton yükümlülüğü, ödenen ve bekleyen ödemeler, iadeler; muhasebeye aylık dışa aktarım.
7. 🛠 **TL fiyat yönetimi.** Mağaza fiyatlarının KDV dahil gösterimi; paket ve fiyatların panelden yönetimi.
8. 👤🛠 **Fiyat ve bonus kararları.** Paketlerin jeton başı fiyat sırası; bonus ve hediye jetonlarının kazanca dönüşme kuralı (ör. bonus jetondan gelen kazanç bozdurulamaz ya da bozdurma kuru/bonus oranı ayarlanır). Birim testlerindeki bekleyen kurallar yeşile döner.

## Faz 14 · Tüketici hakları, destek ve mağaza uyumu (uygulama içi)

**Amaç:** Tüketici Kanunu ve e-ticaret mevzuatının uygulamada karşılanması; Apple ve Google incelemesine hazır olmak.

1. 🛠 **Satın alma öncesi bilgilendirme.** Ön bilgilendirme, mesafeli satış sözleşmesi, cayma hakkı istisnasına açık onay, jeton kullanım koşulları.
2. 🛠 **Destek sistemi.** Uygulama içi destek talebi (kategori, ekran görüntüsü, ilgili işlem); panelde kuyruk ve yanıt; bildirimle geri dönüş.
3. 🛠 **Yardım merkezi.** Jeton, arama, para çekme, güvenlik ve hesap için Türkçe/İngilizce SSS.
4. 🛠 **Künye alanları.** Şirket unvanı, MERSİS, adres, KEP ve e-posta için ayarlanabilir alanlar; uygulamada ve web'de gösterim. Bilgiler Faz 17'de doldurulur.
5. 🛠 **Mağaza politika kontrolü.** Apple ve Google kurallarının madde madde kontrol listesi ve eksiklerin kapatılması.
6. 🛠 **Bildirim tercihleri ve İYS uyumu.** Bildirim türü bazında açma/kapama; pazarlama iletileri için ayrı izin kaydı.
7. 🛠 **Mağaza form içerikleri.** Gizlilik etiketleri, Veri Güvenliği formu ve yaş derecelendirme cevapları (Faz 11 envanterinden); inceleme notu ve demo hesap.

## Faz 15 · Gerçek zamanlı iletişimde üretim kalitesi

**Amaç:** Arama ve mesajlaşmanın zayıf internette ve uygulama kapalıyken kusursuz çalışması; haksız ücret kesilmemesi.

1. 🛠 **Yerel gelen arama ekranı.** iOS'ta CallKit ve PushKit, Android'de tam ekran bildirim; kapalı uygulamada da arama çalar.
2. 🛠 **Adil ücretlendirme.** Agora sunucu olaylarıyla iki tarafın gerçekten bağlandığı doğrulanır. Bağlantı kurulmazsa ücret alınmaz. Kopmada net kısmi dakika kuralı.
3. 🛠 **Uzun ve kesintisiz aramalar.** Agora jetonu yenileme, ağ değişiminde yeniden bağlanma, bağlantı kalitesi göstergesi.
4. 🛠 **Mesaj teslim garantisi.** Çevrimdışı kuyruk, tekrar deneme, çift gönderim önleme, "iletildi" durumu, sıra garantisi.
5. 🛠 **Push güvenilirliği.** Yüksek öncelik, bildirimden doğru ekrana derin bağlantı, rozet sayaçları.
6. 🛠 **Arama itirazı.** Geçmişten hatalı ücret bildirimi, panelde inceleme ve jeton iadesi.
7. 🛠 **Emülatör ve simülatör testleri.** ⏭ Gerçek cihaz matrisi Faz 17'de.

## Faz 16 · Kullanım kolaylığı, erişilebilirlik ve performans

**Amaç:** "Profesyonel ama basit." Yeni kullanıcının hiçbir yerde takılmaması.

1. 🛠 **İlk kullanım rehberi.** Jeton, istek, arama ücreti ve kazanç kısa ve görsel olarak anlatılır; ilk satın alma ve ilk aramada tek seferlik ipuçları.
2. 🛠 **Durum ekranları.** Boş, yükleniyor, çevrimdışı ve hata ekranlarının tamamı tutarlı ve yönlendirici.
3. 🛠 **Erişilebilirlik.** Ekran okuyucu etiketleri, yazı boyutu ölçekleme, renk kontrastı, dokunma alanları.
4. 🛠 **Performans.** Düşük segment Android'de açılış süresi, kaydırma akıcılığı, görsel önbellek, uygulama boyutu.
5. 🛠 **Metin ve dil denetimi.** Türkçe ve İngilizce metinlerin tamamının tutarlılık ve anlaşılırlık kontrolü.
6. 🛠 **Gizlilik dostu kullanım analitiği.** Rızaya bağlı, kendi sunucumuzda: kayıt → eşleşme → ilk mesaj → ilk satın alma hunisi.
7. 🛠 **Uygulama içi geri bildirim.** Kullanıcının kolayca öneri ve hata bildirebilmesi.

## Faz 17 · Dış süreçler ve yayın

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
| 16 Kullanım kolaylığı | 4–6 gün |
| 17 Dış süreçler ve yayın | Dış taraflara bağlı; beta 2–4 hafta |
