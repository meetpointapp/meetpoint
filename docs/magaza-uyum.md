# MeetPoint · Mağaza uyumu ve form içerikleri

> Faz 14. Apple App Store ve Google Play kurallarının madde madde kontrolü, mağaza formlarının cevapları ve inceleme notu.
> Kurallar sık güncellenir: gönderimden hemen önce (Faz 17) resmi metinlerle tekrar karşılaştırılmalı.
> Durum: ✅ karşılandı · ⚠️ risk / karar gerekli · ⏭ Faz 17'de (dış iş)

## 1. Kontrol listesi

### Apple App Store (App Review Guidelines)

| Kural | Durum | Nerede / not |
|---|---|---|
| 1.1.4 Açık cinsel içerik, fuhuşa aracılık eden "hookup" uygulamaları yasak | ⚠️ | Topluluk kuralları, şikayet, ten oranı tespiti, moderasyon kuyruğu, aramada şikayet. **Risk:** dakika başı ücretli görüntülü arama incelemede "ücretli yetişkin içerik" gibi algılanabilir. İnceleme notunda amacı ve moderasyonu açıkça anlat (aşağıda). Avukat görüşüyle birlikte değerlendir (Faz 17). |
| 1.2 Kullanıcı içeriği: süzme, şikayet + zamanında yanıt, engelleme, iletişim bilgisi | ✅ | Otomatik işaretler (iletişim bilgisi, spam, ten oranı), şikayet → moderasyon kuyruğu (öncelikli), engelleme, künye + destek. |
| 2.1 Uygulama eksiksiz, inceleme sırasında sunucu çalışıyor, demo hesap | ✅ / ⏭ | Demo hesap: `npm run review:account` (bölüm 3). Sunucu yayında olmalı (Faz 17). |
| 3.1.1 Dijital içerik uygulama içi satın almayla | ✅ | Jetonlar sadece App Store IAP (RevenueCat). Web'de ödeme yolu yok. |
| 3.1.1 Satın alınan sanal para birimi süresi dolmamalı | ✅ | Jetonların süresi dolmaz (Kullanım Koşulları md. 4, ön bilgilendirme). |
| 3.1.1 Uygulama içi para birimiyle içerik üreticisine "bahşiş" | ✅ | Hediye ve arama jetonu alıcıya geçer. |
| 3.1.1 Kazanılan jetonun nakde çevrilmesi | ⚠️ | Sadece başka kullanıcıdan kazanılan jeton, kimlik doğrulamasıyla, uygulama dışında banka/PayPal ödemesi. İnceleme notunda belirt. Sanal paranın nakde döndüğü izlenimi vermemek için mağaza metninde "para kazan" vurgusu yapma. |
| 4.5.4 Push ile pazarlama sadece açık onay + uygulama içinden kapatma | ✅ | Ayrı "kampanya bildirimleri" izni (Profil › Bildirimler), varsayılan kapalı. |
| 4.8 Üçüncü taraf girişi varsa Apple ile giriş | ✅ | Sadece e-posta ile giriş var; gerekmez. |
| 5.1.1(i) Gizlilik politikası uygulamada ve mağazada | ✅ | Profil › Gizlilik politikası, `/legal/privacy`. |
| 5.1.1(ii) Veri toplamaya izin, amaç açıklaması | ✅ | Açık rızalar (özel nitelikli, yurt dışı, selfie, kampanya), izin açıklamaları (Info.plist). |
| 5.1.1(v) Hesap silme uygulama içinden | ✅ | Profil › Hesabı sil (+ web: `/account/delete`). |
| 5.1.2 Takip (ATT) | ✅ | Reklam/takip SDK'sı yok, ATT izni istenmez. Gizlilik etiketinde "Tracking: No". |
| İzin metinleri (Info.plist) | ⚠️ | Şu an sadece Türkçe. İngilizce `InfoPlist.strings` Xcode'da eklenmeli (Faz 17, Mac gerekli). |
| Yaş derecelendirmesi | ✅ | 18+ (bölüm 2). |

### Google Play (Developer Program Policies)

| Kural | Durum | Nerede / not |
|---|---|---|
| Hesap silme: uygulama içi + **web bağlantısı** | ✅ | Uygulama: Profil › Hesabı sil. Web: `https://<alan-adı>/account/delete` (e-posta + şifre; Veri Güvenliği formuna bu adres yazılır). |
| Ödemeler: dijital ürün Google Play Faturalandırma ile | ✅ | Jetonlar Play Billing (RevenueCat). |
| Kullanıcı içeriği: koşulların kabulü, şikayet, engelleme, moderasyon | ✅ | Kayıtta koşullar onayı, şikayet/engelleme, panel moderasyonu. |
| Cinsel içerik: ücret karşılığı cinsel hizmet yasak | ⚠️ | Apple 1.1.4 ile aynı risk. Topluluk kuralları bunu açıkça yasaklıyor; moderasyon + aramada şikayet var. |
| Hedef kitle: çocuklara yönelik değil | ✅ | 18+, kayıtta yaş kontrolü, "Hedef kitle ve içerik" formunda 18+. |
| Veri Güvenliği formu | ✅ | Bölüm 2. |
| İzinler | ✅ | Kamera, mikrofon (arama, fotoğraf), yaklaşık konum (ACCESS_COARSE_LOCATION, arka planda değil), Bluetooth (kulaklıkla arama). Kesin konum ve arka plan konumu yok. |
| Bildirim izni (Android 13+) | ⏭ | İzin uygulama açılınca isteniyor (Push.register); Firebase kurulunca (`flutterfire configure`) gerçek cihazda doğrula. |
| Finansal özellikler beyanı | ⚠️ | Listedeki finansal hizmetlerden hiçbirini sunmuyoruz; kazanç ödemesi "içerik üreticisi ödemesi". Beyanda "yok" seçilir, gerekirse açıklama yazılır. Avukat/mali müşavirle teyit (e-para riski, Faz 17). |
| Destek iletişimi (mağaza sayfası) | ✅ | Destek adresi: `https://<alan-adı>/help`, e-posta: künyedeki destek adresi. |

### Türkiye mevzuatı (uygulamada karşılananlar, Faz 14)

| Konu | Durum | Nerede |
|---|---|---|
| Ön bilgilendirme + mesafeli satış sözleşmesi | ✅ | `/legal/preinfo`, `/legal/distance-sales`; paket fiyatları tablodan otomatik. |
| Cayma hakkı istisnası (MSY md. 15/1-ğ) açık onayı | ✅ | İlk satın almadan önce işaretlenmemiş onay kutusu; sürüm + zaman Consent'te, satın alma kaydında sürüm. Metin değişince tekrar sorulur. |
| Künye (unvan, MERSİS, adres, KEP, e-posta, ETBİS) | ✅ / ⏭ | Panel › Destek › Künye; `/legal/imprint`; yasal metinlere otomatik yerleşir. Bilgiler şirket kurulunca doldurulur. |
| Şikayet/destek kanalı | ✅ | Uygulama içi destek talebi, 48 saat hedef, panelde gecikme takibi. |
| Ticari elektronik ileti (6563) ve İYS | ✅ / ⏭ | E-posta ve bildirim için ayrı izin, geri alma her an; panelden İYS toplu yükleme dosyası. İYS hesabı ve yükleme Faz 17. |

## 2. Form cevapları

### Google Play · Veri Güvenliği

Genel: veriler aktarım sırasında şifrelenir (HTTPS) · kullanıcı hesabını ve verilerini silebilir (uygulama + web) · veriler satılmaz, reklam için kullanılmaz · hizmet sağlayıcılara (Agora, Firebase, RevenueCat, e-posta) aktarım "paylaşım" sayılmaz.

| Veri türü | Toplanıyor | Amaç | Zorunlu mu |
|---|---|---|---|
| Kişisel bilgi › Ad (görünen ad; para çekmede ad-soyad) | Evet | Uygulama işlevi, hesap yönetimi, dolandırıcılığı önleme | Görünen ad zorunlu; ad-soyad sadece para çekenlerde |
| Kişisel bilgi › E-posta adresi | Evet | Hesap yönetimi, iletişim | Zorunlu |
| Kişisel bilgi › Kullanıcı kimlikleri | Evet | Uygulama işlevi | Zorunlu |
| Kişisel bilgi › Cinsel yönelim | Evet | Uygulama işlevi (eşleştirme) | Zorunlu (açık rızayla) |
| Kişisel bilgi › Diğer (doğum tarihi, cinsiyet, TC kimlik no) | Evet | Uygulama işlevi, yaş kontrolü; TC sadece para çekmede | Doğum tarihi/cinsiyet zorunlu; TC isteğe bağlı |
| Finansal bilgi › Satın alma geçmişi | Evet | Uygulama işlevi, muhasebe | Zorunlu (satın alan için) |
| Finansal bilgi › Diğer (IBAN / PayPal) | Evet | Kazanç ödemesi | İsteğe bağlı |
| Konum › Yaklaşık konum | Evet | Uygulama işlevi (mesafe) | İsteğe bağlı |
| Mesajlar › Diğer uygulama içi mesajlar | Evet | Uygulama işlevi | Zorunlu (kullanan için) |
| Fotoğraflar | Evet | Uygulama işlevi (profil, sohbet, doğrulama selfie'si, kimlik belgesi, destek ekran görüntüsü) | Profil fotoğrafı zorunlu, diğerleri isteğe bağlı |
| Ses / video | Hayır* | *Aramalar anlık aktarılır, kaydedilmez ve saklanmaz | — |
| Uygulama etkinliği › Uygulama etkileşimleri, diğer kullanıcı içerikleri | Evet | Uygulama işlevi, güvenlik (beğeniler, şikayetler, destek talepleri) | Zorunlu |
| Uygulama bilgisi ve performansı › Kilitlenme günlükleri, teşhis | Evet | Uygulama işlevi, analiz | Zorunlu |
| Cihaz veya diğer kimlikler | Evet | Hesap güvenliği (cihaz başına hesap sınırı), bildirim | Zorunlu |

Hesap silme adresi: `https://<alan-adı>/account/delete` · Gizlilik politikası: `https://<alan-adı>/legal/privacy`

### Apple · Gizlilik etiketleri (App Privacy)

- **Tracking (takip):** Hayır. Hiçbir veri takip için kullanılmıyor.
- **Data Linked to You (kimliğine bağlı):**
  - Contact Info: Name, Email Address
  - User Content: Photos or Videos, Other User Content (mesajlar, profil metinleri), Customer Support
  - Identifiers: User ID, Device ID
  - Purchases: Purchase History
  - Location: Coarse Location
  - Sensitive Info: sexual orientation (eşleştirme tercihi); kimlik doğrulama (TC, belge) para çekmede
  - Financial Info: Other Financial Info (IBAN / PayPal)
  - Diagnostics: Crash Data, Other Diagnostic Data
- Amaçların hepsi: App Functionality; ek olarak Diagnostics için Analytics, kimlik doğrulama için App Functionality (fraud prevention).

### Yaş derecelendirmesi

- **Google Play (IARC anketi):** Kategori "Sosyal / Tanışma". Şiddet, korku, kumar, uyuşturucu yok. Kullanıcılar etkileşime girebilir: **evet**. Kullanıcılar içerik paylaşabilir (fotoğraf, mesaj): **evet**. Konum paylaşımı: **evet** (yaklaşık mesafe). Dijital satın alma: **evet**. Hedef kitle: **18+**.
- **Apple:** En yüksek yaş seviyesi (18+). Kullanıcı üretimli içerik: evet. Sık/yoğun olgun temalar: yok (geliştirici içeriğinde). Mesajlaşma ve sohbet: evet.

## 3. İnceleme notu ve demo hesap

Yayın sunucusunda bir kez:

```bash
REVIEW_ACCOUNT_PASSWORD='buraya-en-az-12-karakterlik-sifre' npm run review:account
```

`review@meetpoint.app` (e-posta `REVIEW_ACCOUNT_EMAIL` ile değişir) ve onunla eşleşmiş `review-partner@meetpoint.app` açılır. İnceleme hesabına 1000 promosyon jetonu yüklenir (mağazadan satın almadan ücretli özellikler denenebilsin), satış koşulları ve rızalar onaylı gelir. Tekrar çalıştırmak hesabı sıfırlar.

**App Review Notes (İngilizce, forma yapıştır):**

> Demo account: review@meetpoint.app / (password)
> The account already has a match ("Mia") with a chat, and 1,000 coins so paid features can be tested without purchasing.
>
> MeetPoint is an 18+ dating app. Chatting after a mutual match is free. Coins (sold only via In-App Purchase, never expire) are used to message people you haven't matched with, for per-minute voice/video calls and virtual gifts. The coins a user spends go to the receiving user; receivers may request a payout of coins earned from others after identity verification (payout happens outside the app by bank transfer). Purchased coins cannot be cashed out.
>
> Safety: every profile, chat and call has Report and Block. Reports go to a moderation queue reviewed by our team (urgent reports are prioritised). Sharing contact details, spam and explicit images are detected automatically and queued for review. Explicit or sexual content and any paid sexual service are forbidden by our Community Rules and lead to a permanent ban.
>
> Account deletion: Profile › Delete account (also on the web: https://<domain>/account/delete).
> Support: Profile › Help & support (in-app tickets), https://<domain>/help

## 4. Yayın öncesi yapılacaklar (Faz 17)

- Künyeyi panelden doldur; `/legal/imprint` ve yasal metinlerde köşeli parantez kalmadığını kontrol et.
- Alan adını belgelerdeki `<alan-adı>` yerlerine yaz; mağaza formlarına gizlilik, hesap silme ve destek adreslerini gir.
- Demo hesabı yayın sunucusunda oluştur, notu forma yapıştır.
- İYS'ye kaydol, panelden ilk İYS dosyasını yükle; dosya biçimini İYS'nin güncel şablonuyla karşılaştır.
- Satış metinleri (ön bilgilendirme, mesafeli satış) ve cayma istisnası onay metnini avukata onaylat.
- ⚠️ işaretli maddeleri (ücretli görüntülü arama algısı, kazanç ödemesi, finansal özellik beyanı) avukat ve mali müşavirle netleştir.
- iOS izin metinlerinin İngilizcesini ekle (Xcode).
