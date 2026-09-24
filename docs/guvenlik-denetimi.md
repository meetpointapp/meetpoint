# İç güvenlik denetimi (Faz 10)

OWASP ASVS 4.0 Seviye 2 başlıklarına göre madde madde tarama. Tarih: 24 Eylül 2026.
Bağımsız sızma testi yayından önce yapılacak (Faz 17).

Durum: ✅ karşılanıyor · ⚠️ kısmen / bilinçli karar · ⏭ sonraki fazda

## V2 · Kimlik doğrulama

| Kontrol | Durum | Nasıl |
|---|---|---|
| Şifre en az 8 karakter, en fazla 128 | ✅ | `routes/auth.ts` (zod) |
| Yaygın ve sızdırılmış şifreler reddedilir | ✅ | Çevrimdışı liste (Türkçe yaygın şifreler dahil) + HIBP k-anonimlik (`passwords.ts`). Şifrenin kendisi dışarı gönderilmez, SHA-1 özetinin ilk 5 karakteri gider. Servis yanıt vermezse kayıt engellenmez. |
| E-posta adını içeren şifre reddedilir | ✅ | `assertPasswordAllowed` |
| Güçlü şifre özeti | ✅ | Argon2id (19 MiB, 2 tur). Eski bcrypt özetleri girişte kullanıcı fark etmeden yükseltilir. |
| Kaba kuvvete karşı | ✅ | IP başına hız sınırı + hesap başına kilit (15 dakikada 10 hatalı deneme). Kilit hesap olmayan adreslerde de aynı çalışır (hesap var mı anlaşılmaz). Şifre sıfırlama kilidi kaldırır. |
| Hesap varlığı sızmaz | ✅ | Giriş: aynı hata ve aynı süre (sahte özet doğrulaması). Şifremi unuttum: her zaman aynı yanıt. |
| Şifre değişince diğer oturumlar kapanır | ✅ | Değiştirme: bu cihaz dışındakiler. Sıfırlama: hepsi. |
| Yönetim için çok adımlı doğrulama | ✅ | TOTP (doğrulayıcı uygulama). Aynı kod ikinci kez kullanılamaz, 10 tek kullanımlık yedek kod, kod denemesi sınırlı (15 dakikada 10). |
| Bot koruması | ⚠️ | Sunucu hazır (Cloudflare Turnstile). `TURNSTILE_SECRET` girilince açılır; uygulamaya doğrulama bileşeni anahtar alındığında eklenecek (Faz 17). Şimdilik cihaz başına hesap sınırı (30 günde 3) + e-posta doğrulaması koruyor. |

## V3 · Oturum yönetimi

| Kontrol | Durum | Nasıl |
|---|---|---|
| Kısa ömürlü erişim jetonu | ✅ | 15 dakika. Uygulama süresi dolmadan kendiliğinden yeniler. |
| Yenileme jetonu her kullanımda değişir | ✅ | Veritabanında sadece SHA-256 özeti saklanır. |
| Çalınmış yenileme jetonu tespiti | ✅ | Eski jeton tekrar gelirse oturumun tamamı kapanır. Uygulamanın kendi yarışı için 30 saniyelik tolerans. |
| Hareketsiz oturum düşer | ✅ | 60 gün (kullanıcı kararı). |
| Çıkış sunucuda da oturumu kapatır | ✅ | Erişim jetonları her istekte oturuma bakılarak doğrulanır: çıkış, yasak ve "diğer cihazlardan çık" anında etkili. Anlık bağlantı da kesilir. |
| Açık oturumları görme ve kapatma | ✅ | Profil → Cihazlarım. IP'nin son bölümü gizli. |
| Yeni cihazdan giriş uyarısı | ✅ | E-posta (cihaz adı, zaman, gizlenmiş IP). |

## V4 · Erişim kontrolü

| Kontrol | Durum | Nasıl |
|---|---|---|
| Yönetim rolleri | ✅ | Süper yönetici / moderatör / finans. Her uç rolünü kendisi denetler (`requireRole`); panelde sadece yetkili sekmeler görünür. |
| Kendi yetkisini değiştirememe | ✅ | Kendini yasaklama, kendi rolünü veya 2FA'sını değiştirme engelli. |
| Başkasının kaydına erişim (IDOR) | ✅ | Kullanıcı uçları kayıt sahibini denetler; testlerde başkasının oturumunu kapatma 404 döner. |
| Yönetim işlem kaydı | ✅ | Her değişiklik ve hassas veri görüntüleme (IBAN listesi, selfie) `AdminAudit`'e yazılır. Veritabanı tetikleyicisi kaydın değiştirilmesini ve silinmesini reddeder. |

## V6 · Kriptografi ve veri koruma

| Kontrol | Durum | Nasıl |
|---|---|---|
| Hassas alanlar şifreli | ✅ | IBAN / PayPal adresi, hesap sahibi adı, 2FA gizli anahtarları: AES-256-GCM (`fieldCrypto.ts`). Kullanıcıya maskeli hali gösterilir. |
| Anahtar veritabanı dışında | ✅ | `FIELD_ENCRYPTION_KEY` ortam değişkeni; yayında zorunlu (yoksa sunucu açılmaz). |
| Anahtar değişimi | ⚠️ | Kayıt biçimi sürümlü (`v1:`), eski kayıtlar okunmaya devam edebilir. Anahtar döndürme betiği henüz yok (Faz 13'te finans kayıtlarıyla birlikte). |
| Eski kayıtların şifrelenmesi | ✅ | `npm run encrypt:payouts` (tekrar çalıştırmak güvenli). |

## V9 / V14 · İletişim ve yapılandırma

| Kontrol | Durum | Nasıl |
|---|---|---|
| Güvenlik başlıkları | ✅ | helmet: nosniff, frame-ancestors none, referrer policy; yayında HSTS. |
| Yönetim panelinde CSP | ✅ | Sadece kendi betik ve stil dosyaları; satır içi betik yok. Kullanıcı içeriği her yerde kaçışlanıyor. |
| CORS | ✅ | Yayında sadece `CORS_ORIGINS` (zorunlu). Mobil uygulama tarayıcı olmadığı için etkilenmez. |
| İstek boyutu | ✅ | JSON 100 KB; dosya yüklemeleri multer sınırlı. |
| Hata mesajlarında iç bilgi | ✅ | Kullanıcıya sadece hata kodu döner; yığın izleri yalnızca hata kaydında (yönetim paneli). |
| `X-Powered-By` gizli | ✅ | |
| Panel önbelleğe alınmaz | ✅ | `Cache-Control: no-store` |

## V10 · Bağımlılıklar

| Kontrol | Durum | Nasıl |
|---|---|---|
| Bilinen açıklar | ✅ | `npm audit`: 0. Prisma CLI → deepmerge-ts ve firebase-admin → uuid bildirimleri `overrides` ile kapatıldı; Prisma komutları ve Firebase istemcisi denendi. |

## Bilinçli kararlar ve kalan riskler

- **Hesap kilidi kötüye kullanılabilir:** Birisi başkasının e-postasıyla 10 hatalı deneme yapıp hesabı 15 dakika kilitleyebilir. Kilit kısa tutuldu; şifre sıfırlama kilidi hemen kaldırır.
- **Her istekte oturum sorgusu:** Anında çıkış için her istekte veritabanına bakılıyor (indeksli tek sorgu). Yük testinde ölçülecek (Faz 16); gerekirse kısa süreli önbellek.
- **Panel jetonu tarayıcı oturumunda (sessionStorage):** Sekme kapanınca biter. XSS riskine karşı katı CSP var.
- **Yedek kodlar** tuzsuz SHA-256 ile saklanıyor: kodlar 40 bit rastgele, deneme sınırlı ve tek kullanımlık olduğu için yeterli.
- **Bağımsız sızma testi** yapılmadı (Faz 17).
