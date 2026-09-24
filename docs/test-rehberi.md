# MeetPoint · Elle test rehberi

Uygulama web sürümüyle tarayıcıda test edilir: http://localhost:8080
Yönetim paneli: http://localhost:4000/admin

## Başlatma

`server` klasöründe iki terminal açık olmalı:

```bash
npm run db
```

```bash
npm run dev
```

Web sürümü: `app` klasöründe `flutter build web`, sonra `tools/ui-tours` klasöründe `npm run serve`.

Temiz demo verisi (demo hesapları sıfırlar; senin gmail hesaplarına dokunmaz): `server` klasöründe `npm run db:seed`

## Hesaplar (şifre hepsinde `password123`)

Yeni hesap açarken `password123` gibi yaygın şifreler artık kabul edilmez; `Deneme-Sifre-2026` gibi bir şey kullan.

| Hesap | Ne için |
|---|---|
| `test@meetpoint.dev` | Ana test hesabı (erkek). 1000 jeton, 2 gelen mesaj isteği; Ayşe ve Elif seni beğenmiş, Deniz süper beğenmiş |
| `aye0@meetpoint.dev` | Ayşe: ikinci kişi (eşleşme, sohbet, arama için) |
| `zeynep1@meetpoint.dev`, `elif2@…`, `selin3@…`, `emma4@…`, `deniz5@…` | Diğer demo kadınlar |
| `mert6@meetpoint.dev`, `can7@…` | Demo erkekler |
| `admin@meetpoint.dev` | Yönetim paneli |

**İki kişilik testler için** (eşleşme, sohbet, arama) ikinci hesabı **gizli pencerede** veya başka bir tarayıcıda aç. Aynı tarayıcının sekmeleri aynı oturumu paylaşır.

**E-posta kodları:** Lokalde e-posta gönderilmez. Kayıt ve şifre sıfırlama kodları `server/dev-mails/` klasörüne dosya olarak düşer. En yeni dosyadaki 6 haneli kodu kullan.

## Web sürümünün sınırları (test modu)

- **Ses/görüntü aktarılmaz:** arama akışı, dakika ücreti, hediye ve puanlama gerçek. Karşı tarafın görüntüsü yerine profil fotoğrafı görünür.
- **Satın alma:** gerçek ödeme alınmaz; jetonlar anında eklenir, ilk alım bonusu dahil.
- **Push bildirimi yok:** uygulama açıkken gelen bildirimler (üstte beliren kısa mesajlar) çalışır.
- **Arama zamanlaması:** 1 dakika = 60 sn, cevapsız sayılma 45 sn.

## Kontrol listesi

### 1. Kayıt ve güven (Faz 1–3)
- [ ] Yeni hesap aç: koşul onayı olmadan devam edilemiyor; e-posta kodu `dev-mails` klasöründe
- [ ] 18 yaş altı doğum tarihi reddediliyor
- [ ] Kayıt sihirbazı: fotoğraf, ilgi alanları, profil soruları
- [ ] Şifremi unuttum: kod ile yeni şifre
- [ ] Profil → Mavi tik: poz talimatı + selfie → yönetim panelinden onayla → profilde mavi tik
- [ ] Profil → Hesabı sil (şifre ister)

### 2. Keşfet ve etkileşim (Faz 2, 4)
- [ ] `test` ile Keşfet: Deniz yıldızlı "Seni süper beğendi" ile en önde
- [ ] Beğen, geç, süper beğen (yukarı kaydır veya yıldız; 30 jeton)
- [ ] Filtreler: yaş ve mesafe
- [ ] Öne çıkar (⚡, 150 jeton / 30 dk)
- [ ] Sohbetler → "Seni beğenenler": kilitli (sayı görünür) → 200 jetonla aç
- [ ] Ayşe'yi beğen → eşleşme ekranı

### 3. Sohbet (Faz 1, 4, 9)
- [ ] Ayşe ile mesajlaş (ikinci pencerede `aye0` olarak): anında ulaşıyor, "yazıyor…", okundu tikleri
- [ ] Tek seferlik fotoğraf: alıcı bir kez açabiliyor, sonra "Açıldı"
- [ ] Uzun sohbette yukarı kaydırınca eski mesajlar yükleniyor

### 4. Mesaj istekleri (Faz 1)
- [ ] İstekler sekmesi: Zeynep ve Emma'dan gelen istekler → birini kabul et (sohbet açılır), birini reddet (gönderene iade)
- [ ] Eşleşmediğin birine profilinden mesaj isteği gönder (50 jeton bloke olur)

### 5. Cüzdan ve ödeme (Faz 5, 9)
- [ ] Cüzdan: paketler; "En popüler" 1000'lik paket $18.99
- [ ] İlk satın alma: +%50 bonus jeton
- [ ] Hareketler listesinde her işlem görünüyor
- [ ] Bonus jetonlarıyla ödeme yapılan kişide "Bonus jetonlardan kazanç" satırı çıkıyor (paraya çevrilemez)

### 6. Aramalar (Faz 6, 9)
- [ ] `test` → Ayşe'nin profili → görüntülü ara (30 jeton/dk onayı)
- [ ] Ayşe'nin penceresinde gelen arama ekranı → Aç
- [ ] Görüntü bulanık başlıyor → "Görüntüyü aç"
- [ ] Sayaç ve harcanan/kazanılan jeton; her dakika başında ücret düşüyor
- [ ] Hediye gönder (🌹 20 … 💎 250): karşı tarafta emoji ve bildirim
- [ ] Bitir → puan ver; "Sorun mu vardı? Bildir" → yönetim panelinde şikayet
- [ ] Sohbetler → saat ikonu: arama geçmişi, "Geri ara"
- [ ] Cevapsız arama (45 sn açma) ve reddetme

### 7. Para çekme (Faz 7, 9)
- [ ] Mavi tiki olmayan hesap: "Profilini doğrula" uyarısı
- [ ] Mavi tikli ve satın alınmış jetonla kazanmış hesapta (en az 2000 jeton): IBAN veya PayPal ile talep → "İnceleniyor"
- [ ] Yönetim → Ödemeler: "Ödendi" (işlem no) veya "Reddet" (jetonlar geri)
- [ ] Bekleyen talep varken hesap silinemiyor

### 7b. Hesap güvenliği (Faz 10)
- [ ] Profil → Cihazlarım: bu cihaz işaretli; başka tarayıcıda da giriş yap → listede iki cihaz, diğerini "Çıkış yaptır" → o tarayıcı giriş ekranına düşüyor
- [ ] Yeni tarayıcıdan girişte `server/dev-mails/` klasörüne "yeni bir cihazdan giriş" e-postası düşüyor
- [ ] Profil → Şifre değiştir: yanlış mevcut şifre reddediliyor; `qwerty123` reddediliyor; güçlü şifre kabul, diğer cihazlar çıkış yapıyor
- [ ] 10 kez yanlış şifreyle giriş → "Çok fazla hatalı deneme" (15 dk)

### 7c. Gizlilik ve verilerim (Faz 11)
- [ ] Kayıtta iki isteğe bağlı kutucuk var (arama/bildirim, kampanya); işaretsiz geliyor
- [ ] Onboarding'de "kimi görmek istiyorsun" adımında yönelim rızası işaretlenmeden devam edilemiyor
- [ ] Profil → Gizlilik ve verilerim: rızaları aç/kapat; eşleştirme rızasını kapatınca keşfet "rıza gerekli" diyor
- [ ] Arama rızası kapalıyken arama başlat → rıza penceresi; "Rıza veriyorum" deyince arama başlıyor
- [ ] Mavi tik: selfie rızası sorulmadan kamera açılmıyor
- [ ] "Verilerimi indir" → birkaç saniye sonra `server/dev-mails/` klasörüne bağlantılı e-posta; bağlantı ZIP indiriyor, ikinci kez açılmıyor
- [ ] KVKK başvurusu gönder → panelde KVKK sekmesinde görün, yanıtla → e-posta + uygulamada yanıt
- [ ] Hesabı sil → çıkış; aynı hesapla tekrar gir → "Hesabın geri yüklendi"
- [ ] Panel → KVKK → İmha kaydı: "İmha işini şimdi çalıştır"

### 8. Yönetim paneli
- [ ] İlk girişte 2FA kurulumu: telefonda Google Authenticator / Microsoft Authenticator ile QR'ı tara, 6 haneli kodu gir, yedek kodları kaydet
- [ ] Çıkış yapıp tekrar gir: kod soruluyor; bir yedek kodla da girilebiliyor
- [ ] Ekip: bir test hesabına "Moderatör" rolü ver → o hesapla panelde sadece Şikayetler / Mavi tik / Kullanıcılar görünüyor
- [ ] İşlem kaydı: yaptığın yasaklama, onay, rol değişikliği burada
- [ ] Özet istatistikleri
- [ ] Şikayetler: Selin → Can şikayeti açık; yoksay, fotoğraf kaldır, yasakla
- [ ] Mavi tik: Zeynep bekliyor
- [ ] Kullanıcılar: arama, yasaklama (yasaklanan kullanıcının oturumu hemen kapanır)
- [ ] Satışlar, Ödemeler, Hatalar sekmeleri

## Bir sorun görürsen

Hangi hesapla, hangi ekranda, ne yaptığını ve ne beklediğini yazman yeterli. Yönetim → Hatalar sekmesine düşen kayıtlar da sorunu bulmama yardım eder.
