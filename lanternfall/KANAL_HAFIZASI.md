# Gece Gelen + Lanternfall — Kanal Hafızası

Son güncelleme: 16 Kasım 2026. Her yeni veriyle güncellenir.

## 📒 VERİ DEFTERİ (19 Kasım'dan itibaren)
- Kullanıcı 3./6./24. saat verilerini **https://claude.ai/artifact/81JvFUJEKvRjit4PtHzvyZ** sayfasına giriyor. Claude okur: ArtifactData action 'list', collection 'videos' (doc: title, date, platform, slot, format, cp.{h3,h6,h24}.{views, active, stayed, avg, likes, comments, subs, total, note}).
- **Kural: planlanan her yeni YouTube videosunu Claude deftere kendisi ekler (TikTok YOK, kullanıcı istemedi); kullanıcı sadece sayı girer.** 19 Kasım'da 23 Kasım'a kadarki tüm planlı videolar eklendi.
- Veri girişi Claude'a otomatik bildirim GÖNDERMEZ; kullanıcı "bak" dediğinde ya da konuşma sırasında Claude defteri okur.
- Kaynak dosya: scratchpad/veri/index.html (GitHub: lanternfall/veri/index.html). Her değerlendirmeden önce buradan oku.

## ⭐ 1 NUMARALI KURAL
**Her video bir öncekinden çok daha iyi olmalı: görsel, hikâye anlatımı, içerik, CTA ve izlenme olarak.**

**Çalışma düzeni (değişmez):**
1. Her üretimden ÖNCE bu dosyayı baştan sona oku.
2. Bir önceki videoyla karşılaştır ve neyin daha iyi olacağını madde madde yaz: daha iyi açılış klibi, daha sıkı hikâye, yeni CTA biçimi, yeni renk/tema/efekt.
3. Bir veri (ekran görüntüsü) gelir gelmez tabloya ekle ve dersi formüle yaz.
4. Dosyayı güncelledikten sonra kullanıcıya gönder.

## 📅 KONTROL NOKTASI: 15 ARALIK 2026 (kullanıcı kabul etti)
- Beklenti: en az 1 Short 5.000+ izlenme, 50+ abone, uzun videolarda toplam birkaç yüz saat izlenme.
- Gerçekleşirse devam; gerçekleşmezse strateji baştan konuşulacak.

## 🗓️ 2. HAFTA ÜRETİM PLANI (15 Kasım'da kuruldu)
- Zamanlanmış içerik 17 Kasım'da bitiyor (10:00 ve 16:00).
- **18–20 Kasım:** Her gün 10:00'da yeni keşif Short'u (kontrol listesine göre), 16:00'da Derinkuyu tanıtım Short'u. İlgili video 21 Kasım'a kadar Göbekli, sonra Derinkuyu.
- **21 Kasım CUMARTESİ 16:00:** Derinkuyu uzun videosu (planlandı). Not: 21 Kasım cumartesi; eski notlardaki 'cuma' yanlıştı.
- **21–23 Kasım:** 10:00 yeni keşif + 16:00 Derinkuyu kesitleri.
- **Üretim takvimi:** 16 Kasım → 18–20 Kasım Shorts'ları (6 adet) sende. 17–20 Kasım → Derinkuyu uzun video. 20 Kasım → 21–23 Kasım Shorts'ları.
- **TikTok:** Her Lanternfall Short'unun Türkçe versiyonu, kotasız, aynı gün 23:00'te.

## 📦 2. HAFTA 1. PARTİ (15 Kasım'da teslim, kontrol listesine göre)
- Hepsi 23–26 sn, döngülü bitiş, büyük CTA butonu yok, açılışta keşif/olay klibi:
  - 18 Kasım 10:00: Troya flütü
  - 18 Kasım 16:00: Derinkuyu duvarı
  - 19 Kasım 10:00: 5.000 yıllık ekmek
  - 19 Kasım 16:00: Taş kapılar
  - 20 Kasım 10:00: Makyaj dükkânı
  - 20 Kasım 16:00: Hava bacaları
- Klipte nesnenin "eridiği" kareler kullanılmadı (CLIP_MAX). Gerçek olmayan idol başı görseli atıldı.
- Builder: scripts/kt, kb, ka, kd1, kd2, kd3_build.py (ksa tabanlı, cta_t=1e9, TAIL 0.5).

## 📏 ÖLÇÜM NOTU (YouTube, Kasım 2026)
- Herkese açık "görüntüleme" artık oynatma başlar başlamaz sayılıyor; TV'de birlikte izleyenler de tahminle ekleniyor. Bu yüzden şişik.
- Para kazanma uygunluğu "geçerli Shorts görüntülemesi" ve "geçerli izlenme saati" ile, kazanç ise "aktif" metriklerle hesaplanıyor.
- Bizde aktif izlenme, görüntülemenin ~%55'i (Hasankeyf 1.201 → 668 aktif).
- Analizlerde asıl ölçüt: **aktif izlenme + izlemeye devam eden % + ortalama izleme**.

## 🎯 KAR TOPU İLKESİ (kullanıcı, 15 Kasım)
- **Zamanlanmış videolara dokunulmayacak.** Her YENİ video, önceki videoların verisinden çıkan derslerle üretilecek. Her video bir öncekinden biraz daha iyi olacak; kanal bu birikimle kendini kanıtlayacak.
- Hasankeyf 15 Kasım'da 3 saat 50 dakikada 419 izlenmeye ulaştı ve 8 beğeni aldı; grafik hâlâ yükseliyordu. Mağara 486'da platoya girmişti.

## 📊 1. HAFTA ÖZETİ (YouTube AI, 11–17 Kasım)
- 6.208 görüntüleme, ~28,2 saat izlenme, ort. 27 sn, +17 abone, 1.633 tekil izleyici.
- En iyiler: 10.000 yıllık yüzler 1.422 (33 sn), Hasankeyf 'underwater city' 1.365 (30 sn), Göbekli vs Stonehenge 1.230 (24 sn), Taş Baş 1.187 (19 sn), Mağara 569 (33 sn).
- YouTube AI önerisi: en iyi temalarda seri (Göbekli/Taş Tepeler, su altı şehirleri, taş oymalar). Not: AI ilk uzun videoyu Derinkuyu sandı; ilk uzun video Göbekli (14 Kasım), Derinkuyu 21 Kasım'da çıkıyor.
- YPP yolu: 1.000 abone + (4.000 saat uzun video izlenmesi VEYA 90 günde 10M Shorts izlenmesi). Şu an hafta başına ~17 abone; büyüme hızlanmalı.

## 🎙️ AI SUNUCU FİKRİ (18 Kasım) — **İPTAL: kullanıcı "Olmayacak bu iş anlaşıldı" dedi.** Ücretsiz araçlarla sunucu yapay duruyor. Tekrar önerme; kullanıcı kendisi açarsa konuş.
- Kadın AI sunucu, haber bülteni formatı. Kimlik: 'Lyra — Lanternfall'ın AI rehberi' (gizlenmeyecek; YouTube'da 'değiştirilmiş/sentetik içerik' kutusu işaretlenecek).
- Açılış (0–2,5 sn) bölünmüş ekran: üst %55 gerçek buluntu görseli + büyük manşet + 'NEW DISCOVERY' bandı ve tarih; alt %45 Lyra konuşuyor (ilk cümle = sonuç). Sonra tam ekran görsellere geçiş, ses Lyra'nın sesiyle devam; sonda 1 sn Lyra dönüş (döngü). Sabit marka: 'LANTERNFALL NEWS' bandı, renk amber.
- Araçlar: FLUX.1-schnell (yüz), Wan2.2-S2V (konuşan video). 3. HF hesabı tokenı gerekiyor; request_credential iki kez 'Denied' döndü → kullanıcı ortam ayarlarından Network secrets'a ekleyecek (hostlar: black-forest-labs-flux-1-schnell.hf.space, wan-ai-wan2-2-s2v.hf.space).
- **Teknik (18 Kasım çalışan yol):** Yüz: black-forest-labs/FLUX.1-schnell (768x1344, 4 adım). Konuşturma: multimodalart/MoDA-fast-talking-head (zero-a10g; /generate_motion, emotion Neutral, cfg 1.2) ~1 dk'da 5 sn. Wan-AI/Wan2.2-S2V Space CPU'da çalıştığı için kullanılamaz. Kadın sesi: Chatterbox EN, referans Piper en_US-amy-medium (piper/ref_en_f.wav), ex 0.6 cfg 0.45. Token: kullanıcının 3. HF hesabı, gradio_client token= parametresiyle (dosyaya/GitHub'a YAZILMAZ; kullanıcı ortam ayarlarına erişemediğini söyledi, sohbete yapıştırdı).
- **MoDA testi kullanıcıya göre başarısız:** "Acayip yapay, bakışlar boşlukta, amatör". Yeni yol: Wan i2v ile sunucunun doğal hareket ettiği 5 sn'lik klip (kameraya bakıyor, mimik, sonda 'şşş' işareti, iyi görünüyor) + fffiloni/LatentSync ile dudak senkronu. LatentSync ZeroGPU kotası 18 Kasım'da doldu (~23 saat). Yarın denenecek.
- Adaylar: host/host_1.jpg (kazı alanı, güler yüzlü), host/host_2.jpg (fenerli tünel, önerilen).
- Test: ilk birkaç Short sunuculu, izlemeye devam %'si sunucusuzlarla karşılaştırılacak.

## ✏️ ÇİZİM HİKÂYE FORMATI (19 Kasım, kullanıcı fikri)
- Referans: TikTok Türkiye'de viral 2D çizim hikâye videosu ("Bir deli kuyuya taş atar…"): tanıdık kanca + merak sorusu, düz 2D yan görünüş tek büyük dünya + kesit, kamera gezinmesi, tek kelime altyazı (anahtar kelime sarı), sakin anlatıcı, sonda bugüne bağlama, döngülü son kare. Üreticinin karakter/çizimleri KOPYALANMAZ, sadece format mantığı.
- Deneme 1: Derinkuyu (İngilizce, 47 sn). scripts/ill_derinkuyu.py: PIL ile çizilmiş köy + 8 katlı kesit dünyası, kodla çizilmiş karakterler (adam: kasket+bıyık+kahverengi ceket, lamba), keçiler, ateş/lamba ışıması, taş kapı animasyonu, akıncılar, turistler, 20.000 sayacı, döngülü dönüş. Kullanıcı: "tarz geliştirilmeli, gerçek görüntülerle desteklenmeli, sahne geçişi yok, karakterler duvardan geçmemeli, makyaj/montaj/hareket lazım, referansa yaklaş; asıl olay izletmek".
- Deneme 2 (v2, 35 sn): scripts/ill2.py. 19 sahne montaj (çizim + gerçek foto: tünel, merdiven, odalar, kuyu, taş kapı, kasaba), karakterler gerçek yol/merdivenden yürüyor, chibi yüz ifadeleri, konuşma balonları, çekiçte kamera sarsıntısı + moloz, flaş/zoom/whip geçişleri, SFX (çekiç, rüzgâr, taş gürültüsü, ayak sesi), karanlık + ışık, toz; kapanış izleyicinin hayatına bağlanıyor ("...is that a draft?") ve döngü. Kullanıcı: "Süper olmuş gerçekten" ama loop yoktu → düzeltildi: son cümle yarım kalıp ilk cümleye bağlanıyor ("...remember, it all started when…" → "This man broke one wall…"), son kare = ilk kare (aynı kadraj, çekiç havada), sonda boşluk yok. **Kural: her Short'ta son cümle ilk cümleye dilbilgisel olarak bağlanacak + son kare ilk kare.**

## 👥 KİTLE (YouTube, son 28 gün, 19 Kasım)
- %83 erkek. Yaş: 65+ %23,7, 45–54 %22, 55–64 %20,2, 35–44 %19,2, 25–34 %11,8, <25 %3,3 → **%66'sı 45 yaş üstü; belgesel/tarih kanalı izleyicisi.**
- Ülkeler: ABD %16,5, Hindistan %7,5, Rusya %4,9, Endonezya %4,2, Türkiye %3,6 → çoğu ana dili İngilizce olmayan.
- Sonuçlar: sade İngilizce, kısa cümle, sakin tempo; büyük okunur altyazı ve kapak yazısı; gerçek görüntü/güvenilirlik öne çıkacak; kapaklarda sinematik-belgesel ton (masalsı/çocuksu değil). Çizim formatında sevimli chibi karakterler bu kitleye çocukça gelebilir → test tutmazsa daha gerçekçi 'boyanmış' belgesel çizim stiline geç. Test videosunun 24. saatte yaş dağılımına bak (yeni genç kitle mi getirdi?).

## 🖼️ KAPAK KURALI (19 Kasım)
- Kodla çizilmiş kapaklar (sade karakter) kullanıcıya göre "çok amatör, tıklatmaz". Kapaklar artık FLUX.1-schnell ile üretilen detaylı dijital resim (dramatik ışık, büyük ölçek, sinematik) + büyük kalın 2 satır yazı (beyaz + sarı) + üst/alt karartma. Prompt'ta 'no text'. 768x1344 → 1080x1920 LANCZOS + unsharp.

## 🛠️ ÇİZİM MOTORU GELİŞTİRME (19 Kasım, kullanıcı önceliği: "motoru olabildiğince iyi seviyeye getir")
- v3 (scripts/rig.py + scripts/story3.py): yetişkin oranlı karakterler (kontur, iki ton gölge, dizli/dirsekli yürüyüş, göz kırpma, ifadeler: surprised/scared/angry/smile/talk/shh, kıyafet: yelek/kemer/başörtüsü/kask/sakal, ayak gölgesi), 2x süpersample sprite; dünya dokusu + derinlikte kararma; film greni; 'çizimden gerçeğe' parlak çapraz perde geçişi (reveal) + yükselen ses (riser) ve derin vuruş (boom); taş sürtünme, meşale çıtırtısı SFX.
- v4 (scripts/story4.py): ışık hüzmeleri (lamba/meşale/ateş etrafında yumuşak ışınlar), delikten ışık huzmesi (beam), kenarlarda parallax kaya siluetleri (1.8x, sabit px boyut, en fazla 5), sahne renk tonu (cold/warm/night), dünya detayları (kemerli nişler + lambalar, kilimler, sepetler, keski izleri, perdeler, çitler), gerçek fotoda animasyonlu ok + açıklama (callouts). İlk denemede ön kayalar ekranı kapladı → küçültüldü.
- **v4 kullanıcı eleştirisi:** "adam tünelden uzun, duvardan geçiyor, ses efektleri kötü, çok fazla ışık/gölge boğmuş".
- **v5 (scripts/story5.py + scripts/world_build.py):** karakter ölçeği dünyaya oturtuldu (yetişkin ~105 birim; oda 150, tünel 125, merdiven geçidi 134 yükseklik; tünelde çömelme 0.6; duvar deliği 120), ayak kayması giderildi (yürüme fazı = gidilen mesafe × π / adım), kamera adamı takip ediyor (follow, zoom 2.2–2.7), ışınlar/karartma/gren/vinyet ciddi azaltıldı, ön kayalar en fazla 2 ve açık; SFX sadeleşti (yumuşak çekiç, whip'te hafif whoosh, reveal'da yumuşak vuruş, kapı sürtünmesi; riser, çıtırtı, ayak sesi, punch whoosh kaldırıldı).
- **v5 kullanıcı:** "Fena değil, devam et. Daha çok animasyon olmalı, daha duygulu olmalı" (sadece olay anlatımı kalıyordu).
- **v6 (scripts/story6.py + rig jestleri):** jestler (hug, push, pray, cower, point), duygu efektleri (tears, sweat, breath, tremble), actor() yardımcı (rig'i doğrudan, 2x), yakın plan sahneler: anne kızına sarılı ağlıyor, baba omzuyla taş kapıyı itiyor (ter, titreme), kızın yüzünde aşırı yakın plan (zoom ~25, korku + ter), akıncı boş evde "...where is everyone?". Satır 9–10 dört duygusal çekime bölündü.
- **v7 (rig._head):** detaylı yüzler: çene hatlı yüz, iki ton gölge, kulak, yanak kızarıklığı, renkli iris + parlama, göz kapakları, kadınlarda kirpik, ifadeye göre şekilli kaşlar, profil burun + burun deliği, ifade/konuşma ağız şekilleri (dişler), bıyık/sakal şekilleri, sakal gölgesi, yaşlılarda kırışık, saç telleri, başörtüsü katmanlı, kask burun koruması. scripts/story7.py = story6 + yeni rig.
- **KURAL (hikâye yazımı):** Her hikâyede olay anlatımının yanında en az 2–3 DUYGUSAL an olacak (korku, sevgi, umut, kayıp): yakın plan yüz, fiziksel temas (sarılma), gerilim anı (nefes tutma), tepki çekimi. Anlatı 'ne oldu' değil 'onlar ne hissetti'.
- Sıradaki fikirler: karakterlerde daha fazla jest (kafa çevirme, işaret etme), sahne arası 'match cut', harita animasyonu, müzikte sahneye göre vurgu.

## 🎯 STRATEJİ KARARI (19 Kasım, kullanıcı)
- Çizim v2 (döngülü) 19 Kasım 16:00'da TEST olarak yayınlanıyor (o slottaki planlı Short 20 Kasım 00:00'a kaydırıldı).
- **Test tutarsa: 23 Kasım'dan sonra YENİ ÜRETİM SADECE ÇİZİM HİKÂYE FORMATINDA.** Kullanıcı: TikTok'ta bu tarzla 300K takipçi, 500K–3M izlenme alan kanallar var; yurt dışında bizim konseptle (arkeoloji/gizem) neredeyse yok.
- Açık soru: uzun videolar bu formata nasıl uyarlanır (kullanıcı için çok önemli; ilk uzun video zayıf kaldı).

## 🚀 BÜYÜME PLANI (18 Kasım, kullanıcı onayladı, bu sırayla)
1. **Haber takibi:** Her konuşmada/gün son 24–48 saatin dünya arkeoloji haberlerini tara; büyük haber çıkarsa aynı gün Short üret, kullanıcı planlı bir Short'un yerine koysun (planlı olan sonraki boş güne kayar). (Otomatik günlük zamanlanmış görev izin sistemi tarafından reddedildi; manuel yapılıyor.)
2. **Seriler (sabit başlık/renk/açılış):** "Lost Underwater" (su altı), "Underground Cities" (yeraltı), "Older Than the Pyramids" (çok eski yerler).
3. **Aylık derleme uzun video:** "The Biggest Archaeological Discoveries of November 2026", Truva'dan sonra (~5 Aralık).
4. **Kullanıcıdan:** haftalık Topluluk anketi (sıradaki uzun video), Studio'da otomatik dublaj seçeneği var mı kontrol.

## 📰 Haber takibi günlüğü
- 18 Kasım: Larsa (Irak) 3.800 yıllık Babil köprüsü; Sutton Hoo (İngiltere) yeni Anglo-Sakson mezarı (gövde kumda iz olarak korunmuş); Eriha 2.000 yıllık mezarlık. En güçlü aday: Sutton Hoo (dünyaca ünlü) ve Larsa köprüsü.

## 📊 11–18 KASIM (YouTube AI, 19 Kasım)
- 7.783 görüntüleme, 32,4 saat, +21 abone, 2.974 tekil izleyici, 1.622 yeni izleyici.
- İlk 5: Yüzler 1.429 (%62,5, 33/47 sn), Hasankeyf 1.368 (%64,7, 30/43 sn), Göbekli vs Stonehenge 1.232 (%59,2), Taş Baş 1.224 (%59,6), Truva flütü 1.154 (%57,3).
- AI önerisi: Türkiye/Yakın Doğu somut keşifleri (yüz, heykel, su altı şehir) en iyi sonuç veriyor; kusursuz döngü ile ort. izleme %'sini artır (uyguluyoruz). → Küresel konu kuralı geçerli ama Türkiye/Yakın Doğu ağırlığı korunacak (~%60).
- 19 Kasım: 'Animated History Mysteries' oynatma listesi oluşturuldu; çizim testi 16:00'da, kaydırılan Short 23:00'te.

## 🌍 KONU KURALI DEĞİŞTİ (18 Kasım, kullanıcı kararı)
- **Lanternfall artık sadece Türkiye ile sınırlı DEĞİL. Odak: GÜNCEL arkeoloji/tarih keşifleri, hangi ülke olursa olsun.** Türkiye haberleri devam eder ama zorunlu değil.
- Başlık kalıbı: "…Was Just Found in [Ülke/Yer]". Kurallar aynı: gerçek kaynak, doğrulanmış bilgi, boş tık tuzağı yok, etiketli AI/örnek görsel.
- Eski "yabancı haber yok" kuralı Lanternfall için kaldırıldı. TikTok'a giden Türkçe versiyonlar da bu konuları içerir.

## 🔁 LOOP HATASI (18 Kasım, kullanıcı fark etti)
- 21–23 Kasım Shortlarında son 1,5 sn ekran kararıyordu → döngü bozuluyor. Düzeltme: Shorts'ta NOFADEIN=1 NOFADEOUT=1, sona boşluk bırakma (gap 0), son kare ilk kareye benzer görsel. Planlanmış videolara dokunulmadı (kar topu).

## 💬 Kullanıcı soruları (18 Kasım): "İzleyici sıkılmaz mı?" ve "Hep Türkiye, kanal yurt dışı odaklı; bir yerden sonra izleyici getirmeyi bırakmaz mı?" Öneri: format çeşitliliği (haber, karşılaştırma, sıralama, 'ya şöyle olsaydı', seri) + konum 'Anadolu merkezli antik dünya': ~%70 Türkiye, ~%30 Türkiye'yi dünyadaki ünlü yerlerle karşılaştıran içerik (Stonehenge karşılaştırması iyi gitmişti). Kullanıcıyla tartışılıyor.

- **Truva flütü (18 Kasım 10:00, 'The First Musical Instrument…'), 50. dk:** 18 izlenme / 2 aktif, izlemeye devam %12,5 (çok küçük örnek, ~8 kişi), ort. 0:16. İlk test grubu kaydırmış; 3. saat beklenecek. **3 saat 10 dk: 189 izlenme, 4 beğeni, %42 devam.** **7 saat 10 dk: 525 izlenme, %51 devam (toparladı), 10 beğeni, +2 abone (kanal 19).** Ders: ilk saatlerdeki düşük oran yanıltıcı olabilir; 3. saatte kesin karar verme, 6–7. saati de bekle. **11–12. saat: 788 izlenme / 392 aktif, %54,5 devam, ort. 0:15, +4 abone (bugün en çok abone getiren).** Hâlâ doğrusal yükseliyor. Soyut konu bile, zamanla iyi kitlesini bulup abone getirdi. 10:00 ortalamasının altında (Hasankeyf ~400, Yüzler 1.320). Ders: 'ilk müzik aleti' konusu soyut kaldı; çarpıcı görsel bir buluntu (yüz, tapınak, şehir) + net büyük sayı daha iyi çalışıyor.

- **Derinkuyu duvarı (18 Kasım 16:00), 1 saat 10 dk:** 35 izlenme, 2 beğeni, %24 devam (küçük örnek). **3. saat: 114 izlenme / 40 aktif, %37,4 devam, ort. 0:14.** Grafik doğrusal yükseliyor (16:00 tipik). Kanal 20 abone. **6. saat: 157 izlenme / 60 aktif, %42 devam, ort. 0:17, 2 beğeni, 0 abone; grafik yavaşlıyor.** 16:00'ın zayıf Short'u (Taş Baş 6. saatte ~1.000'di). Canlandırmayla açılış + 16:00 yavaşlığı. Truva flütü 12 beğeni. Kanal 21 abone (18 Kasım gece).

- **5.000 yıllık ekmek (19 Kasım 10:00), 1 saat 50 dk:** 95 izlenme, 3 beğeni, %38 devam. (Eski kuralla yapılmış; 6–12. saat beklenecek.) **3 saat 20 dk (defterden): 279 izlenme / 103 aktif, %44,6 devam, ort. 0:19, 6 beğeni, 0 abone** — flütün aynı saatinden (189, %42) önde.

- **24. saat özetleri (19 Kasım):** Truva flütü (10:00) 1.155 izlenme / 596 aktif, %57,3 devam, 0:16, +4 abone, 16 beğeni → 1.000 kulübüne 5. video. Derinkuyu duvarı (16:00) ~20. saat 368 / 164 aktif, %50,6 devam, 0:20, 0 abone, 5 beğeni. **Ders: izlemeye devam % zamanla yükseliyor (flüt %12→57, duvar %24→51); YouTube doğru kitleyi buldukça artıyor. Değerlendirme 24. saatte yapılmalı.**

- **19 Kasım öğlen:** Derinkuyu duvarı (dün 16:00) ~26. saatte 438'de duruyor; ekmek (bugün 10:00) ~4. saatte 358. Kullanıcı üzgün (1.000 altı). İkisi de eski kuralla (canlandırma açılış). Yeni kural Shortları 21 Kasım'dan, çizim testi bugün 16:00.

## 🧱 1.000–1.500 TAVANI (17 Kasım analizi)
- En iyi Shortlar hep 1.000–1.500'de duruyor: Hasankeyf 1,3K, Stonehenge 1K, 10.000 yıllık yüzler 1.378, Taş Baş 1.420.
- Ortak zayıflık: izlemeye devam %58–62 (ilk saniyede %40 kaydırma) ve ort. izleme süresinin büyük kısmı tek izleme (tekrar yok).
- Bir sonraki havuz için hedef: **izlemeye devam %70+**, **ort. izleme %100+** (döngü/tekrar), **beğeni oranı %4+**, yorum/paylaşım.
- Uygulanan: aydınlık ilk kare, ilk cümlede sonuç, 25–30 sn, döngülü son cümle, büyük sarı altyazı (21–23 Kasım). Test: bu 5 Short'un devam %'si 70'i geçiyor mu? Geçip yine tavanda kalırsa sıradaki kol: konu genişliği (dünya çapında bilinen yer/olay: Truva, piramit karşılaştırması) ve 20–22 sn'lik daha da kısa Shortlar.
- Kanal 1 haftalık; tavan kanal büyüdükçe kendiliğinden de yükselir.

## ✅ YENİ SHORTS KONTROL LİSTESİ (her yeni Lanternfall Short'u bunu geçmeli)
1. Konu: Dünyanın herhangi bir yerinden GÜNCEL, gerçek bir keşif haberi (18 Kasım'dan itibaren). Başlık kalıbı: "…Was Just Found in [Yer]".
2. İlk karede hareketli keşif ANI (bir şey bulunuyor/çıkıyor). Manşet ana objenin üstüne binmeyecek.
3. 25–30 saniye. 2. cümle merak cümlesi olacak.
4. Ortada da sonda da büyük CTA butonu YOK. Soru anlatıya yedirilecek.
5. Döngülü bitiş: son cümle ilk kareye bağlanacak.
6. Gerçek fotoğraflar (kaynak açıklamada). Yapay zekâ sahnelerinde "AI RECONSTRUCTION" etiketi BÜYÜK ve net; gerçek buluntu fotoğraflarında küçük "REAL FIND" etiketi. (17 Kasım: Japon izleyici "bu yüzler gerçek mi, AI mı?" diye sordu. Güven için ayrım her karede açık olmalı.)
7. Yayın 10:00. Sabit yorum (somut, kişisel soru). "İlgili video" = son uzun video.
8. Hedef: izlemeye devam eden %70+, ortalama izleme %90+.

## ⏸️ DURUM (14 Kasım)
- **TikTok (kesin karar, 14 Kasım):** TikTok için AYRI ÜRETİM YOK, kota harcanmayacak. Sadece Lanternfall (YouTube) videolarının Türkçe versiyonları hazırlanacak: aynı görseller ve klipler, Türkçe metin, yerel Chatterbox sesi (kotasız), Türkçe yazılar. Paylaşım günde 1 video, saat 23:00. Hazırdaki iki video 14 ve 15 Kasım 23:00'da çıkıyor.
- **ANA ODAK: YOUTUBE / LANTERNFALL (kullanıcı, 14 Kasım).** Sıfırdan başlıyoruz; her video çok kaliteli ve izlenme ihtimali yüksek olmalı. Klip kotasında öncelik Lanternfall'da, TikTok'a kalan kota gider.
  - **Lanternfall kalite çıtası (Shorts):**
    - Saat 10:00; haber/keşif formatı ("…Was Just Found in Turkey").
    - İlk saniyede keşif anı (hareketli). Gerçek fotoğraf/video; 30–40 sn.
    - Başlıkta somut haber. Sabit yorum + uzun videoya "İlgili video" bağlantısı.
    - Hedef: izlemeye devam eden %70+, ortalama izleme %65+.
  - **2. uzun video (onaylandı): Derinkuyu**, **21 Kasım 16:00** (1. uzun video 14 Kasım 16:00; düzen haftada bir, cuma 16:00). Çalışma başlığı: "Derinkuyu: The Underground City That Hid 20,000 People".
    - Doğrulanan bilgiler: 1963'te bir ev tadilatında duvar yıkılınca bulundu. Yaklaşık 20.000 kişi kapasitesi. ~76–85 m derinlik (kaynaklara göre 8 kat veya daha fazla). İçeriden kapatılan yuvarlak taş kapılar, her kat ayrı kapatılabiliyor. 1923 nüfus mübadelesiyle terk edildi. 1969'da ziyarete açıldı. 1985'ten beri UNESCO (Göreme alanı kapsamında). Kökeni tartışmalı: Frigler (MÖ 8–7. yy) ile Bizans dönemi arası.
    - Yatay 16:9, 8–10 dk, bölümlü.
    - **Üretim notları (16 Kasım):** Yeni builder `scripts/long_build.py` (piksel altı afin kamera, döndürme yok, 0,6 sn çapraz geçiş, CRF 15, tekrar kontrolü) + `dk/cards.py` (harita, kat kesiti, derinlik, taş kapı, zaman çizelgesi, yıl kartı, bitiş ekranı) + `scripts/long_mix.py` (ducking, -14 LUFS) + `scripts/music_dk.py` (videoya özel tema).
    - **16 Kasım gece TESLİM EDİLDİ:** 8:05, 1080p, 109 farklı görsel (tekrar yok), 6 bölüm, özel müzik, 9 sn bitiş ekranı. Kullanıcı önizleme için "Her şey okey" dedi. Kapak A (taş kapı, "20,000 PEOPLE HID DOWN HERE", 85 m DEEP), kullanıcı seçimi bana bıraktı. Başlık: "Derinkuyu: The Underground City That Hid 20,000 People". Gönderim sınırı 400 MB: final ~5,6 Mbps iki geçişli sıkıştırma.
    - **Süre dersi:** 59 cümlelik ilk senaryo seslendirilince sadece 4,5 dk tuttu. Bu ses temposunda (atempo 0.9) **8 dk için ~100 cümle** gerekiyor. Senaryo yazarken süreyi baştan hesapla (ortalama ~4,3 sn/cümle + 0,6 sn boşluk).
    - Görsel kaynakları: Derinkuyu (Nevit Dilmen ve diğerleri), Kaymaklı, Özkonak, Tatlarin, Uçhisar, Zelve, Skylitzes el yazması (kamu malı). Özel kişilerin portre fotoğrafları kullanılmıyor.
  - **Göbekli Tepe uzun video, 44. saat:** 4 izlenme, 9 küçük resim gösterimi, **ortalama izleme 4:40 (8:18'in %56'sı, çok iyi)**. Kaynaklar: YouTube arama 2, kanal sayfası 1, ilgili Shorts 1.
    - **17 Kasım (~3. gün):** 43 görüntüleme ama sadece **6 aktif izlenme**, 159 küçük resim gösterimi (9'dan), **TO %2,5** (düşük), %88,4 göz atma (ana sayfa/akış), ort. izleme 2:08 (önce 4:40), toplam 0,2 saat. Yorum: Shorts büyüyünce YouTube uzun videoyu ana sayfada göstermeye başladı (iyi), ama küçük resim az tıklanıyor ve görüntülemelerin çoğu muhtemelen ana sayfadaki sessiz önizleme oynatmaları (yeni sayım). Ders: **kapak tıklanma oranı uzun videonun darboğazı** → Derinkuyu'da somut sayı + gizem kapağı (A). Göbekli için YouTube "Test ve Karşılaştır" ile 2 yeni kapak denenebilir.
    - Sonuç: İçerik izleyiciyi tutuyor, sorun keşfedilme. YouTube yeni kanalın uzun videosunu henüz önermiyor (9 gösterim). Shorts'taki "İlgili video" bağlantısı ~2.500 Short izlenmesinden sadece 1 izlenme getirdi.
    - Derinkuyu için: başlık ve açıklama arama odaklı olacak (insanların aradığı ifadeler). Kanal fragmanı ayarlanacak. Abone sayısı arttıkça uzun video gösterimleri de artacak.
  - **Kullanıcının 1. uzun video geri bildirimi (14 Kasım):** "Baştan sona izlerken sıkılmadım, keyifliydi." Ama:
    1. Fotoğraflar çok tekrar etti.
    2. Fotoğraf hareketlerinde takılmalar vardı.
    3. Kurgu ve animasyon daha iyi olabilir.
    4. **Her videoda müzik farklı olmalı.**
    - **Derinkuyu için kurallar:**
      - Hiçbir görsel bir kereden fazla tekrar etmeyecek (60–70 farklı görsel + 12–15 hareketli klip + gerçek fotoğraflar).
      - Kamera hareketleri yumuşak olacak (döndürme ve titreme yok, yüksek çözünürlüklü kaynak, akıcı geçişler).
      - Sıkıştırma yüzünden oluşan takılmayı önlemek için daha yüksek bit hızı kullanılacak.
      - Videoya özgü yeni bir müzik teması yazılacak.
  - **Uzun video:** Haftalık. Arama hacmi yüksek konu, güçlü küçük resim, ilk 30 saniyede kanca, bölümler. Shorts uzun videoya trafik taşıyan kapı olacak.

## 3. HAFTA PLANI (17 Kasım)
- YouTube: 20 Kasım 16:00'ya kadar Shorts planlı, 21 Kasım cumartesi 16:00 Derinkuyu planlı.
- Üretilecek: 21–23 Kasım Shorts: 10:00 yeni keşif ×3 (21, 22, 23); 16:00 Derinkuyu ×2 (22, 23; kesit + yeni öğe). **Kural (kullanıcı onayı): uzun video günü 16:00'da Short YOK.** Yeni açılış kuralıyla, 18 Kasım sonuna kadar teslim.
- TikTok: 15 Kasım'dan beri boş. Türkçe ses: Chatterbox Multilingual varsayılan ses (Ahmet referansı ortam sıfırlanınca kayboldu; Edge çalışmıyor). Yıllar yazıyla yazılmalı ("1963" → "bin dokuz yüz altmış üç"; rakamla 1936 okudu). 18–20 Kasım 23:00 için Derinkuyu malzemesinden 3 Türkçe TikTok; 21 Kasım'dan itibaren her yeni Short iki dilde birden üretilir.

- **Türkçe ses (17 Kasım):** Chatterbox varsayılan sesi kullanıcıya göre "çok kötü". Edge (Ahmet) HF Space'leri de çalışmıyor (hepsi hata/askıda). Yeni deneme: Piper tr_TR-dfki-medium (yerel, net) ve bunu referans alan Chatterbox "1" ayarı (ex 1.1, cfg 0.3, atempo 1.1). İkisi de Whisper'da kelimesi kelimesine doğru. Kullanıcı seçimi bekleniyor.
- **21–23 Kasım 10:00 konuları (araştırıldı):** 21: Kekova açıklarında dünyanın en eski batığı (4.400–4.700 yıl, ~30 m derinlik, 30+ amfora, 3 taş çapa; 'en eski' iddiası kazı ekibinin). 22: Truva yakınında Ajax'ın mezarı olabilecek tümülüs (Işıldaktepe Altı, Rhoiteion yakını; tarih henüz belirsiz, 'olabilir' diye anlatılacak). 23: Mardin Çemka Höyük, ~11.000 yıllık ilk çömlek denemeleri (46 parça, en az 9 kap; Antiquity 2026).

- **TikTok teslim paketi (her video):** video + dikey kapak (1080x1920, büyük 2 satır beyaz + 2 satır turuncu manşet, alt etiket) + açıklama/etiketler + sabit yorum + oynatma listesi. Kapağı unutma (17 Kasım kullanıcı sordu). Türkçe ses = "1" (Piper dfki referanslı Chatterbox), kullanıcı onayladı.

- **TikTok Derinkuyu #1 ("Bodrumdaki duvarı yıktı") 17 Kasım 20:35'te paylaşıldı** (plan 18 Kasım 23:00'tü). Yeni Türkçe ses + dikey builder ile ilk video. 3. saat verisi beklenecek.

- **Kararlar (17 Kasım akşam, kullanıcı: "senin önerilerinle devam"):** 28 Kasım cumartesi 16:00 uzun video = **TRUVA: Savaş gerçek miydi?** (yüksek arama hacmi + Ajax mezarı haberi). Göbekli uzun videosu için 2 yeni kapak (YouTube Test ve Karşılaştır). Shorts İngilizce ses = Chatterbox EN (Derinkuyu sesi, atempo 0.9), Brian artık yok.

- **21–23 Kasım Shorts TESLİM EDİLDİ (17 Kasım gece):** 21 10:00 Kekova batığı, 22 10:00 Truva/Ajax, 23 10:00 Mardin çömlek, 22 16:00 Derinkuyu taş kapı, 23 16:00 Derinkuyu hava bacaları. 25–31 sn. Yeni açılış kuralı: ilk kare aydınlık ve gerçek (kararma efekti kaldırıldı: NOFADEIN=1), manşet üstte, büyük sarı altyazı, döngülü son cümle, etiketli örnek/replika görseller. Wan kliplerinde sonradan beliren nesneler (sürat teknesi, beyaz nesne) kesildi (max 1,5 sn). Builder: scripts/short_build.py (dikey; kartlar letterbox+crop, vbars dikey grafik). İlgili video: 21 Kasım Short = Göbekli; 22–23 = Derinkuyu.

- **TikTok takvimi (teslim edildi):** 17 Kasım Derinkuyu duvar (paylaşıldı 20:35), 18 Kasım taş kapılar, 19 Kasım hava bacaları, 20 Kasım Kekova, 21 Kasım Truva/Ajax, 22 Kasım Mardin Çemka Höyük (hepsi 23:00, kapaklı). Sonraki: 23 Kasım'dan itibaren yeni Shorts'ların Türkçe versiyonları.

- **TikTok Derinkuyu #1, 4. saat:** 373 izlenme, 5 beğeni, 3 yorum, 1 paylaşım, 0 takipçi, ort. 9,8 sn (50 sn'nin %20'si), tamamı izleme %4,65. Eski TikTok ortalamalarıyla aynı bant (Nemrut 688/12,3 sn). Kullanıcı: "TikTok'tan iyice soğudum". Ders: TikTok'ta 50 sn çok uzun; izleyici ~10. saniyede gidiyor. Karar önerisi: TikTok sıfır ekstra emekle (YouTube Shorts'un Türkçesi, 25–35 sn) 15 Aralık'a kadar sürsün, orada karar verilsin; kullanıcı isterse hemen durdurulur.

## TikTok oynatma listeleri (17 Kasım, özellik açıldı)
- Önerilen listeler: "Topraktan Çıkanlar" (keşif haberleri: Siverek tapınağı, Urfa heykeli, Karahantepe), "Saklanan Yerler" (Batman, Cehennem Kapısı, Zerzevan, Yerebatan), "Kayıp Şehirler" (Nemrut, Zeugma, Ani, Hasankeyf, Aizanoi), "Define ve Efsaneler" (Karun, Van Gölü). Her listenin başına en çok izlenen video. Yeni Türkçe Lanternfall versiyonları konusuna göre bu listelere eklenecek. Kota harcamaz.

## Kanallar
- **Gece Gelen | Anadolu Sırları** (TikTok @gecegelenai)
  - ~7.000 takipçi, Türkçe.
  - Takipçilerin çoğu reklamla geldi ve videoları izlemiyor; izlenmelerin ~%95'i "Sizin İçin" sayfasından geliyor.
  - Kitle: %75 erkek, ağırlıklı 35 yaş üstü.
- **Lanternfall** (YouTube, İngilizce)
  - Antik dünya, yeni arkeolojik keşifler.
  - Her gün 22:00'de bir Shorts, haftada bir uzun video. İlk uzun video 14 Kasım 16:00 (Göbekli Tepe & Karahan Tepe; 18 Kasım 22:00 yerine öne alındı).
  - İlk Short ("Something Older Than the Pyramids…") 48 saatte 9 izlenme aldı.
    - Kaynaklar: Shorts akışı 4, YouTube arama 3, kanal sayfası 2.
    - İzlemeye devam eden %85,7, ortalama izleme 0:24.
    - 2. ve 3. Short'lar (22:00) 48 saatte 8–9 izlenmede kaldı.
    - **POV Short'u (yanlışlıkla 13 Kasım 10:00 TR'de çıktı):** 2 saat 20 dakikada 32 izlenme (diğerlerinin 3,5 katı), izlemeye devam eden %66,7, ortalama 0:20, hâlâ yükseliyor. Saat mi (Avrupa sabahı), POV formatı mı, yoksa kanalın 3. videoda ısınması mı belli değil; 17 Kasım'da kontrol edilecek.
    - **YouTube AI analizi (13 Kasım):** POV ilk 5 saatte 102 izlenme aldı (diğerleri 6). Ortalama görüntüleme %61–64 (37 sn'nin 23 sn'si), izlemeye devam eden %47,5–50. Saat (10:00) ile POV formatı karışık etken. Öneri: 2. haftada POV serisi + sabah saati test edilecek; ilk 2 saniye daha sert olacak.
    - **Kalan Shorts'un hepsi 10:00'a alındı:** 14 Kasım Mağara (POV değil), 15 Kasım Hasankeyf 12.000 yıl (POV değil), 16 Kasım POV Düşman geliyor (POV), 17 Kasım 10.000 yıllık yüzler (POV değil). Saat sabit olduğu için POV ile POV olmayan videolar karşılaştırılabilecek.
    - **Mağara Short'u (haber, POV değil, 14 Kasım 10:00):** 1 saat 50 dakikada 85 izlenme (83'ü Shorts akışından), izlemeye devam eden %68,5, ortalama 0:33, 4 beğeni. POV'dan bile hızlı. **Sonuç: Lanternfall için 10:00 saati güçlü; fark POV'dan değil, saatten.** 22:00'de çıkan Shorts 6–9 izlenmede kalmıştı.
    - **YouTube AI karşılaştırması (14 Kasım, ikisi de 10:00):** Mağara (haber) 183 izlenme, izlemeye devam eden %64,85, ortalama %67 (32 sn), 12 beğeni. POV ise 163 izlenme, %41,45, %59 (21 sn), 3 beğeni. **Sonuç: Aynı saatte haber/keşif formatı POV'dan daha güçlü** (ilk saniyede daha az kaydırma, 4 kat beğeni). 2. haftada ağırlık haber/keşif; POV haftada 1–2 deneme olarak kalacak, o da bir keşif kancasıyla.
    - **Mağara Short'u 27. saat:** 486 izlenmede plato (ilk ~5 saatte yükseldi, sonra durdu). İzlemeye devam eden %65,3, ortalama 0:33, +1 abone (kanalın ilk abonesi Shorts'tan). Ders: ilk test grubunu geçiyoruz ama bir sonraki havuza açılmak için **ortalama izleme %90–100+ (tekrar izleme)** gerekiyor. 2. haftada Shorts 25–30 sn olacak, döngülü bitecek (son cümle ilk kareye bağlanacak).
    - **YouTube AI tespiti (15 Kasım):** Son 6 saniyedeki büyük Beğen/Yorum/Abone butonları ve "full story on our channel" daveti, izleyiciye videonun bittiğini erken fark ettirip kaydırtıyor. **Yeni kural: Shorts'ta büyük CTA butonları YOK.** Soru anlatıya yedirilecek, bitiş döngülü ve tempolu olacak. Uzun videoya yönlendirme "İlgili video" bağlantısıyla yapılacak, sözlü davetle değil.
    - **Hasankeyf Short'u (haber, 15 Kasım 10:00):** 2 saat 45 dakikada 230 izlenme, izlemeye devam eden %56,7, ortalama 0:25, hâlâ yükseliyor. 10:00 + haber formülü tekrar çalıştı (mağara 183, Hasankeyf 230).
    - **Hasankeyf 6,5. saat:** 594 izlenme (REKOR, Mağara'nın 486 platosunu geçti), 11 beğeni, +1 abone, izlemeye devam eden %60,4, ortalama 27 sn, 1 izleyici yorumu. Kanal toplamı 2 abone (15 Kasım).
    - **16 Kasım 14:46 toplamı (~3.100 izlenme):** Hasankeyf 1,3K, Stonehenge 1.036, Mağara 547, POV-1 198, Batık 17, Piramitler 13, Göbekli uzun video 4, POV-2 56. Abone 9. POV-2'de izlemeye devam eden ~%60 olmasına rağmen YouTube dağıtmadı; konu/format akışta tıklanmıyor.
    - **POV 'The Enemy Is Coming' (16 Kasım 10:00), 2 saat 45 dakika:** 39 izlenme, %55,6, 3 beğeni. Aynı saatte Hasankeyf ~400 almıştı. **POV formatı kesin olarak zayıf; POV üretimi durduruldu.** (6,5. saat: 70 izlenme / 43 aktif, izlemeye devam eden %68,2 (yüksek), ortalama 26 sn. İzleyen seviyor ama YouTube az kişiye gösteriyor; dağıtım sorunu.) Kanal toplamı 9 abone (16 Kasım öğlen). **12. saat: 88 izlenmede plato, %65 izlemeye devam.** 16 Kasım gece: abone 9'da sabit, eski Shorts saatte ~1 izlenme (platoda). 16 Kasım kanalın en zayıf günü: iki zayıf format (POV + uzun videodan kesit) aynı güne denk geldi.
    - **⚠️ Gömülen tapınak kesiti (16 Kasım 16:00): 6. saatte 0 izlenme.** Hiç dağıtılmadı (30. dk da 0). Kontrol edildi: herkese açık, 2 izlenmenin ikisi de kullanıcının kendisi → YouTube videoyu akışa HİÇ vermedi (Stonehenge kesiti aynı saatte 1.036 almıştı). Olası neden (doğrulanmadı): uzun videodan kesilen klipler 'tekrar içerik' sayılmış olabilir. **Karar: 16:00 için de özgün haber/keşif Short'u üretilecek; uzun videodan doğrudan kesit yapılmayacak.** **GÜNCELLEME 17 Kasım:** Karahan Tepe baş kesiti (16:00, uzun videodan) 3 saat 15 dk'da **588 izlenme / 330 aktif, %58,9 devam, ort. 0:19, 10 beğeni, 0 abone** → dağıtıldı. 5,5. saat: 965 izlenme / 543 aktif, %58,2 devam, ort. 0:19, 12 beğeni, +1 abone (kanal toplamı 17). Grafik hâlâ doğrusal yükseliyor; 16:00'ın en hızlısı. 'Tekrar içerik' tahmini ÇÜRÜDÜ YouTube AI (17 Kasım): 2 görüntülemenin ikisi de kanal sayfasından; video Shorts akışına hiç girmemiş. Yeni kanallarda gecikmeli dağıtım (24–48 saat, bazen günler) olabilir; silme, dokunma. Günde 1 veya 8–12 saat arayla yükleme öneriyor. Kararımız: günde 2 (10:00 + 16:00) devam, çünkü 16:00 Shortlarının çoğu çalıştı; 3. bir yükleme EKLENMEYECEK. (3 kesitten 2'si çalıştı: Stonehenge 1.036, Taş Baş 588@3s; Gömülen tapınak 0 = muhtemelen tek seferlik dağıtım hatası). Yeni kural: kesit Short serbest ama her birine en az bir yeni öğe (grafik/harita/karşılaştırma) eklenecek; 16:00'da Stonehenge'in 3. saatinin (129) 4,5 katı. Planlanmış videolara dokunulmayacak.
    - **Hasankeyf 12,5. saat: 1.201 izlenme (kanalın ilk 1.000+ Short'u)**, 27 beğeni, +2 abone, izlemeye devam eden %63,3, ortalama 0:28. Grafik ~12 saat boyunca doğrusal yükseldi. Formül: 10:00 + gerçek yer + haber/keşif + net sayı (12.000 yıl) + baraj altında kalma dramı.
    - **15 Kasım akşam:** Hasankeyf 884 izlenme / %63,5 / 20 beğeni (rekor, büyüyor). Mağara 508 / %65 / 17 beğeni / 2 abone. **Stonehenge kesiti (16:00), 3. saat:** 129 izlenme, izlemeye devam eden %46,1, **ortalama 0:39 (36 sn'lik videoda %100+, tekrar izleme var)**, 6 beğeni (~%4,7 beğeni oranı, kanalın en yükseği). Kanal toplamı 3 abone; **3'ü de 15 Kasım'da geldi** (hızlanma). **Stonehenge 6,5. saat:** 335 izlenme, doğrusal yükseliş, %52,8, ortalama 0:28, +1 abone. 15 Kasım gece toplam 5 abone. 16:00 saati yavaş başlıyor ama düzenli büyüyor. **Stonehenge 20,5. saat: 988 izlenme, +3 abone (en çok abone getiren Short), %59,1, 20 saat boyunca kesintisiz doğrusal büyüme.** Sonuç: 16:00 saati geçerli. Uzun videoya bağlı kesit Short'u en iyi abone dönüşümünü sağladı.
      - Ders: 16:00'da izlenme 10:00'ın yaklaşık yarısı. İlk saniye zayıf (canlandırma açılışı, %46). Ama izleyen tekrar izliyor (grafik + net karşılaştırma işe yarıyor). Karşılaştırma grafiklerini yeni Shorts'larda kullanmaya devam et.
    - **10.000 yıllık yüzler (17 Kasım 10:00, haber formatı), 1 saat 25 dk:** 240 izlenme, %60 izlemeye devam, 7 beğeni, 1 yorum (Japonca: "yüzler gerçek mi, AI mı?"). Kanalın en hızlı başlangıcı (Hasankeyf 2 saat 45 dk'da 230). Haber formatı + 10:00 yine çalıştı; dün POV aynı saatte 39'du. Kısa süre sonra 265 izlenme, +1 abone (toplam 10). Sonra 280 izlenme, 11 beğeni, +2 abone (kanal toplamı 11). **3 saat 15 dk: 1.320 izlenme (KANALIN EN HIZLI SHORT'U; Hasankeyf 1.201'e 12,5 saatte ulaşmıştı), 28 beğeni, kanal toplamı 15 abone.** **Plato: 1.378 izlenme, 25 beğeni, 5 yorum, +7 abone (kanalın en çok abone getiren Short'u; Stonehenge +3).** Ders: haber formatı ilk 3 saatte hızlı açılıyor ama ~1.300–1.400 civarında tavana çarpıyor (Hasankeyf 1,3K, Stonehenge 1K). Bir sonraki havuz için ortalama izleme %90–100+ (tekrar izleme) şart. (Bu Short: izlemeye devam %62,2, ortalama 0:33. Asıl kayıp ilk saniyede: ~%38 hemen kaydırıyor. Açılış karesi etiketsiz AI kazı sahnesiydi; gerçek yüz fotoğrafıyla açılış denenecek.) Rusça yorum da geldi (uluslararası kitle). Açılış karesi yapay zekâ kazı sahnesiydi ("THE STONE HILLS") ve üstünde AI etiketi YOKTU → Japon yorumuna verilen cevap düzeltilmeli; bundan sonra her AI karede etiket şart. Japon yorumuna JP+EN dürüst cevap verildi.
    - **Uzun videonun kesit Shorts'ları (16:00 testi):** 15 Kasım Stonehenge karşılaştırması, 16 Kasım Gömülen tapınak, 17 Kasım Karahan Tepe'deki baş. Her biri "İlgili video" olarak Göbekli Tepe uzun videosuna bağlı. Gerçek fotoğraflar (Dosseman, Marco Restano, Teomancimit, Zhengan, Trampota) + RECONSTRUCTION etiketli klipler. Builder: scripts/ksa/ksb/ksc_build.py (v31 tabanlı, İngilizce). Ses: scripts/voice_en.py (Brian). Manşetin altına düşecek şekilde kadrajı ayarla.
    - **2. hafta planı (kullanıcı kararı):** Günde 2 Short, 10:00 ve 22:00. Formatlar günlere göre dönüşümlü: tek günler 10:00 POV / 22:00 haber, çift günler tersi. İngilizce haber Shorts'ları TikTok konularından uyarlanacak (aynı araştırma ve görseller, Brian sesi). Hareketli klip kotası öncelikle açılışlara harcanacak.
    - Teknik engel yok. Kalite sinyali iyi ama örnek çok küçük; YouTube yeni kanalı küçük gruplarla test ediyor. Değerlendirme 17 Kasım'da.

## Kullanıcının kesin kuralları
- **Konu:** Türkiye'de belirli bir yer + bilinmeyen/gizli bir gerçek, mümkünse yeni bir keşif ya da haber. Genel savaş veya tarih dersi yok, yabancı haber yok, boş tık tuzağı yok.
  - Örnek hatalar: Nusret ve Baba Vanga videoları.
- **İçerik vaat etmeli.** 14 saniyelik "sadece şok" videosu reddedildi ("hiç bişey anlatmıyor"). Hikâye şart.
- **Ses:** Türkçe aksan kayması kabul edilmiyor. Her satır Whisper'dan geçecek (scripts/voice_check.py), sorunlu satır varyantlarla yeniden üretilecek (scripts/voice_variants.py).
- **CTA ve tema:** Beğen/yorum/takip çağrıları her videoda farklı olacak. Her videonun rengi ve teması farklı.
- **Pazarlama yok:** İşletmelere gidip reklam/sponsor istenmeyecek. İnsanlar içerik sayesinde kendiliğinden gelecek.
- **İletim:** Senaryo ve sesi ayrıca göndermeye gerek yok. Doğrudan bitmiş video + kapak + açıklama gönderilecek.
- **Hedef:** Para kazanmak. Ama "başka platform aç" veya "canlı yayın yap" önerilmeyecek.

## Veriden öğrenilenler
| Video | Süre | İzlenme | Ort. izlenme | 2. sn tutma | Not |
|---|---|---|---|---|---|
| Karahantepe (eski) | – | 24K (+45 TL reklam) | **%40 (kanalın rekoru; kullanıcı teyidi)** | %71–79 | Yer + şok manşet ilk karede |
| POV videoları | ~60 sn | 100–350 | 10 sn | düşük | POV formatı bırakıldı |
| Cehennem Kapısı (hareketsiz görsel) | 1:43 | 341 / 4 saat | 13,8 sn (%13) | ~%25–30 | Kayıp ilk 1 saniyede |
| Zerzevan (hareketli ama zayıf açılış, 15:00) | 1:11 | 332 / 7 saat | 9,6 sn (%14) | ~%45 | Loş koridor açılışı zayıf kaldı |
| Nemrut (ikonik + hareketli açılış, 19:00) | 1:11 | 688 / 3 saat | 12,3 sn (%17) | **%70** | İlk saat ~400; 3. saatte söndü |
| Ani (fırtına bulutlu yalnız kilise açılışı, **15:00**) | 1:09 | **56 / 3 saat** | **3,8 sn (%6)** | ? | En kötüsü. Yavaş atmosfer klibi (hareket yok gibi), genel 'hayalet şehir' konusu, haber yok. Bulutların akması aksiyon sayılmaz |
| Zeugma (gerçek fotoğraf, klip yok, ortada yorum CTA'sı, **19:00**) | 0:56 | 122 / 3 saat | 10,4 sn (%19) | ? | 7 beğeni, 2 yorum, 1 kaydetme. 19:00 olmasına rağmen Nemrut'un (688) altında kaldı |
| Van Gölü (hareketli dalgıç açılışı, **12:00**) | 1:07 | 129 / 3 saat | 16,0 sn (%24; son haftaların en iyisi, ama Karahantepe %40) | ? | Saatlik 24→30→61, artıyordu; tamamlanma %5,9; 2 yorum. Öğle saati izlenmeyi sınırladı ama tutma oranı en iyisi |

**Formül (12 Kasım itibarıyla):**
1. **İlk kare:** Yerin herkesçe tanınan ikonik görüntüsü veya sert bir aksiyon, gerçek hareketli klip olarak. Loş, genel atmosfer sahnesi açılışta kullanılmayacak.
2. **İlk cümle:** Şok kısmı başta, yer adı ikinci sırada.
3. **Süre:** 40–45 saniye (6–7 satır). 70 saniyede ortalama izleyici 12 saniyede çıkıyor.
4. **Saat:** Akşam saatleri daha güçlü (19:00 > 15:00). 13 Kasım'daki 12:00/15:00/19:00 testinden sonra kesinleşecek.
5. **Kalanlar:** İlk 5 saniyeyi geçen izleyici uzun süre kalıyor, yani hikâye çalışıyor.
6. **İkinci cümle:** Açılış artık tutuyor (Nemrut 2. saniyede %70). Asıl kayıp 2–8. saniye arasında (%70 → ~%30). Bu yüzden 2. cümle tanıtım/bilgi DEĞİL, merakı büyüten bir cümle olacak ("Arkeologlar yüz elli yıldır arıyor ve kimse giremedi"). Kişi, krallık ve tarih bilgisi sonraya kalacak.
7. **ORTADA CTA YOK (kullanıcının tespiti, 13 Kasım):** Ortada "...merak ediyorsan beğen/takip et" demek video bitiyormuş hissi veriyor. Nemrut'un eğrisinde tam o anda (0:32) belirgin bir düşüş var. Ortadaki CTA kaldırılacak. Yerine "açık döngü" cümlesi kullanılacak: "Ama asıl şaşırtıcı olan, birazdan…". Beğen/yorum/takip çağrısı sadece son 3 saniyede olacak.
8. **Ani dersi (13 Kasım):** Yavaş akan bulut/manzara klibi açılış için yetmiyor; ortalama 3,8 sn kaldı. İlk karede bir ŞEY olmalı: bir insan kazıyor, dalgıç yüzüyor, bir boğa yığılıyor, bir eser çıkıyor. Manzara + bulut = kaydırma.
9. **13 Kasım saat testi sonucu:** Van 12:00 = 129 izlenme (%24), Ani 15:00 = 56 (%6), Zeugma 19:00 = 122 (%19). Saat belirleyici değil. Asıl belirleyiciler açılıştaki OLAY ve izlenme yüzdesi. TikTok her videoya ~100 kişilik test veriyor; büyük havuza açmak için yüksek tutma (Karahantepe %40) gerekiyor.
10. **Kapak/ilk kare:** Nemrut gibi tanınan bir yer + net bir soru.

## 🔑 Kanalın büyük hitleri (12 Kasım profil görünümü; 7.049 takipçi, 55,5K beğeni)
| Video | İzlenme | Görünüm/format |
|---|---|---|
| Batman'da ne saklanıyor? | **775,2K** | Uydu/harita görüntüsü + soru manşeti, haber gibi |
| Urfa'nın Siverek ilçesinde 3000 yıllık tapınak çıktı | **395K** | İzleyici yorumu ekran görüntüsü ("bizim köyde tapınak çıktı, açmadan üstünü kapattılar") + haber metni |
| Urfa'da 11 bin yıllık heykel çıktı | **99,9K** | Türkiye haritası + işaret + "çıktı" haber manşeti |
| Son sinematik videolar (Nemrut, Trabzon, Cehennem, Zerzevan) | 333–731 | Yapay zekâ film sahneleri (keşişler, kılıçlar, kaleler) |

**Ortak nokta:** Hitler bir haber ya da belge gibi görünüyor (harita, uydu, yorum ekranı). Konuları **yeni** ("çıktı", "kapattılar"), **yerel** (ilçe/köy adı) ve **"saklanan gerçek"** hissi veriyor. Sinematik yapay zekâ sahneleri bu kitlede güven vermiyor.
- **Not:** Batman ve Siverek 1 yıldan eski videolar; ilk aylarında yüz binlere ulaştılar. Reklam alıp almadıkları bilinmiyor. O dönem hesap yeniydi ve reklamla gelen pasif takipçiler yoktu. Yani sonuç kısmen formattan, kısmen hesabın o zamanki durumundan kaynaklanıyor olabilir; ikisi ayrıştırılamıyor. Bu yüzden format A/B testiyle doğrulanacak.
- **Fikir:** Büyük hitlerin devam videoları ("1 yıl önce 775 bin kişi izledi, şimdi ne oldu?") kanıtlanmış merakı kullanır.

## 📌 YENİ FORMAT (13 Kasım'dan itibaren 2 hafta SABİT; değerlendirme 26 Kasım)
- **Görsel:** Gerçek fotoğraflar (Wikimedia Commons serbest lisanslı; kaynak açıklamada), harita, uydu görünümü ve haber manşeti. Yapay zekâ sadece canlandırma için, ekranda "CANLANDIRMA" etiketiyle. Fantastik sahne (keşiş, kılıç vb.) yok.
- **Konu yelpazesi (günde 3 video):**
  1. Yeni arkeolojik keşif haberi
  2. Define, hazine ya da kapatılan yer
  3. Gerçek yaşanmış gizemli olay ya da efsanenin arkasındaki gerçek
- **Yapı:** 40–45 saniye. İlk kare ikonik ya da gerçek görüntü + şok manşet. 2. cümle merak cümlesi. Duygulu Türkçe ses.
- **Kural:** Format 2 hafta boyunca değişmeyecek; video video tepki verilmeyecek. Kullanıcı "kanal deney tahtasına döndü" dedi.
- **Kullanıcı hissi:** "Format çok kişiye hitap etmiyor, daralıyorum." Konu yelpazesi bu yüzden genişletildi.

## Video karşılaştırma günlüğü (bir önceki → bu video: ne iyileşti?)
- **Cehennem Kapısı → Zerzevan:** İlk kez hareketli klip kullanıldı, Whisper ses kontrolü eklendi, süre 1:43'ten 1:11'e indi.
- **Zerzevan → Nemrut:** İkonik açılış görüntüsü kullanıldı, 19:00'a geçildi. Sonuç: 2. saniyede tutma %45'ten %70'e çıktı, izlenme 2 katına çıktı.
- **Nemrut → Zeugma (13 Kasım 19:00):** Yeni formatın ilk videosu.
  - İlk kez gerçek fotoğraflar kullanıldı (Wikimedia, Dosseman ve Raddato, CC BY-SA). Yapay zekâ sahnelerinde "CANLANDIRMA" etiketi var.
  - Haber dili ("kaçırılan kız geri döndü"), 2026 haberi, 2. cümle merak cümlesi.
  - Ses: yerel Chatterbox (Türkçe, duygulu, B ayarı), 1.17 hızlandırma.
  - Süre 56 sn (71'den indi). Yeni CTA: yorum balonu + "TAHMİNİNİ YAZ".
  - Klip kotası bitmişti, bu yüzden hareketli klip yok.

- **Zeugma → 14 Kasım üçlüsü (Aizanoi 12:00, Yerebatan 15:00, Karun 19:00):**
  - Ortadaki beğeni çağrısı tamamen kaldırıldı, yerine açık döngü cümlesi geldi; CTA sadece sonda.
  - 1 numaralı (daha duygulu) ses kullanıldı.
  - Her videoda 2–3 hareketli klip var; açılışlar hareketli.
  - Gerçek fotoğraflar Wikimedia'dan; sahte broşun gerçek fotoğrafı da kullanıldı.
  - Süreler 52–58 sn. Konu çeşitliliği: yeni keşif, efsane ve gerçek, define.
  - **Doğruluk kontrolü:** Gerçek eseri değiştiren yapay zekâ klipleri atıldı (Karun açılışı yeniden yapıldı). Örnek fotoğraflar "ÖRNEK" diye etiketlendi.

## Üretim sistemi (teknik)
- **⚠️ 16 Kasım: Bulut ortamı sıfırlandı; scratchpad'deki tüm scriptler, görseller ve cbenv silindi.** Hafıza dosyası kullanıcıdaki kopyadan geri yüklendi. Araçlar yeniden kuruluyor. Ders: hafıza dosyası her güncellemede kullanıcıya gönderilmeye devam edecek. **Kalıcı yedek (kullanıcı onayı, 16 Kasım): GitHub meetpoint deposu, `claude/brave-hypatia-07udpo` dalı, `lanternfall/` klasörü. Her script/hafıza değişikliğinden sonra oraya commit + push. Ortam sıfırlanırsa önce oradan geri yükle.**
- **Görsel:** Cloudflare FLUX klein (scripts/cf_klein.py dikey, cf_klein_h.py yatay). İki hesap var, kota 03:00 TR'de sıfırlanıyor.
- **Hareketli klip:** Hugging Face Wan 2.2 (scripts/wan_i2v.py).
  - İki hesap: kota ilk kullanımdan 24 saat sonra yenileniyor, toplam günde ~12 klip.
  - Tokenlar bulut ortamına kayıtlı.
- **Ses (13 Kasım'dan itibaren):** YEREL Chatterbox (cbenv/bin/python3 scripts/tts_local.py; CPU'da, kota yok; 11 sn ses ≈ 50 sn üretim). HF Space sürümünün kotası çok küçük. Zor özel adlar (Zeugma, mozaiğin) bozuk okunuyor: bunları cümleden çıkar, ekranda yaz. **Kullanıcının seçtiği ayar (13 Kasım): "1 güzel" → Ahmet referansı, exaggeration 1.1, cfg_weight 0.3, atempo 1.1.** Cümle içinde dramatik duraklama için "..." kullan. Chatterbox Multilingual Türkçe, "B: duygulu" ayarı (Ahmet referansı, exaggeration 0.8). Script: scripts/tts_chatterbox.py, girdi lines.json = [[metin, duygu], ...]. Whisper kontrolü ve kelime zamanları otomatik. Kullanıcı yorumu: "B fena değil gibi"; ilk videoların ses geri bildirimine göre ayar yapılacak.
- **Eski ses:** Edge TTS Brian. **16 Kasım'dan beri bu ortamda ÇALIŞMIYOR (proxy WebSocket'e izin vermiyor).**
- **Yeni İngilizce ses (16 Kasım, kullanıcı seçimi):** Yerel Chatterbox İngilizce, varsayılan ses, exaggeration 0.5, cfg 0.5 ("A güzel ama çok hızlı") → **atempo 0.9 ile yavaşlatılıyor**, satır arası 0,6 sn. Script: scripts/tts_en_local.py (Whisper kontrolü dahil).
- **Gerçek görsel:** scripts/commons_get.py (Wikimedia; hız sınırı var, 1920 px küçük resim kullan, istekler arasında 6–8 sn bekle; orijinal video dosyaları 429 hatası veriyor).
- **Yeni ses akışı:** tts_local.py → audio_raw → scripts/prep_audio.sh (atempo 1.1) → audio.
- **Kurgu:** v31/v32/v33_build.py (v30 tabanlı, ALT_IMG ve klip desteği). Eski şablon: scripts/v26_build.py (klip desteğiyle), scripts/make_builds_27_29.py ile yeni video üretimi.
- **Kapak:** vNN/kapak.html şablonu (Chromium ile).

## ÇİZİM TESTİ İLK VERİ (19 Kasım 16:00, "Behind This Wall…") — 2 saat 36 dk
- 1.327 izlenme | 640 aktif | %60,5 izlemeye devam | ort. 26 sn (~35 sn videoda ~%75) | 41 beğeni | 0 yorum | +2 abone (toplam 23)
- Karşılaştırma ~3. saat: flüt 189, ekmek 279, duvar 114 → çizim ~5-7 kat hızlı başladı. Beğeni (41) flütün 24 saatlik toplamının (16) 2,5 katı.
- Tavanın (1.000–1.500) 3. saatte aşılması bekleniyor. Kesin karar 24. saatte; şimdiden güçlü sinyal: çizim formatı + loop + duygu çalışıyor.
- Zayıf nokta: abone dönüşümü düşük (2) ve yorum yok → sonraki çizimlerde sonda yorum sorusu / seri hissi ("Part 2?") dene.
- YouTube "En iyi yeni videolar" (ilk 2 sa 41 dk, son 10 Shorts): ÇİZİM 1,3B #1 | 10.000 yıllık yüzler 853 | Stone Head 372 | 12.000 yıllık şehir 226 | Ekmek 172 | Flüt 130 | Göbekli 112 | "He Broke One Wall…" (AYNI Derinkuyu konusu, gerçek görüntü formatı) 92 | POV 39 | Gömülü tapınak 2.
- EN ÖNEMLİ KANIT: Aynı konu, aynı hikâye. Gerçek görüntü formatı 92, çizim formatı 1.300 → ~14 kat fark. Fark konudan değil, FORMATTAN geliyor.

## MOTOR v8b — BOYALI ARKA PLANLAR (19 Kasım)
- Kota notu: Ortama kayıtlı (proxy) HF token'larının kotası doldu; 3. hesap (HF3) çalışıyor. FLUX çağrısında token=HF3 kullan.
- bg/: basement, hideroom, tunnel, village_night, stonedoor (768x1344, FLUX schnell, seed 7, STYLE flat 2D + painterly). stonedoor ahşap kapı çıktı → kullanılmadı, taş kapı kodla gölgeli çiziliyor.
- Yeni shot tipi "scene": boyalı arka plan + yavaş zoom + ekran koordinatında karakterler (feet ~y1700, yetişkin actor sc ~7.5, yakın plan 19, bulanık bg blur=9).
- Duygu sahneleri (saklanma odası, akıncılar köyde, babanın kapıyı itmesi, kızın yakın planı, "where is everyone?") artık boyalı sahnede. Dünya kesiti (genel plan) aynen kaldı → geniş plan kesit + yakın plan boyalı sahne kombinasyonu.
- v8c: boyalı sahnede karakter entegrasyonu → integrate() (sahnenin ortalama ışık rengine tint + pozlama + kâğıt dokusu), contact_shadow() ayak gölgesi, meşale ışık çekirdeği sınırlandı (min r 5). Final "is that a draft?" sahnesi boyalı bodrumda. Konuşma balonları y=640 (altyazı y~300 ile çakışmasın).
- v9 (rig): yuvarlak gövde silüeti (chaikin), yaka + kıyafet kıvrımları, sivrilen uzuvlar (_seg/_limb taper 1.05→0.8), ince dış çizgi (ow 1.5*s), boşta nefes/salınım (breath). Yedek: rig_v7.py.
- v10: _hand() başparmaklı eldiven el (ön ve arka kol), daha doğal yürüyüş (hip 0.972, stride 11.5, ayak kaldırma cos², yumuşak bob). paint_world.py: world.png → world_painted.png (ton lekeleri, fırça izi, kâğıt dokusu + FLUX kaya dokusu bg/rocktex.png sadece yer altında, GY*SS=1810 altı). story8 world_painted.png varsa onu yükler. Komut: python3 scripts/paint_world.py <P>/world.png <P>/world_painted.png bg/rocktex.png

## STRATEJİ v2 — MÜDÜR KARARI (19 Kasım akşam)
- Patron uyarısı: "Her dediğime haklısın deme, müdür sensin." → Kararları ben veririm, gerekçeyle; katılmıyorsam söylerim.
- UZUN VİDEO VAZGEÇİLMEZ (para = 4.000 saat + uzun video RPM). Sıklık: haftada 1 (artırmıyoruz; darboğaz sayı değil, kapak tıklanma + izleyici tutma).
- Göbekli uzun video: 43 gösterim, CTR %2,5, ort. 1:50 / 8 dk (~%23). Hedef: CTR %5+, ort. izleme %40+ (3+ dk).
- Uzun video formatı artık: ÇİZİM BELGESEL + gerçek fotoğraf geçişleri (Shorts'ta 14 kat kanıtlandı). 0-30 sn: hikâyenin en duygusal anı + soru; her 60-90 sn'de açık döngü ("ama asıl soru…"); bölümler; final cevap.
- Kapak: karakter yüzü + duygu + tek güçlü obje + 3-4 kelime. Her uzun videoya 3 kapak → Test & Compare.
- HUNİ: Her Short'a "İlgili video" bağlantısı = o haftanın uzun videosu. Çizim Derinkuyu Short'u → 21 Kasım Derinkuyu uzun video.
- Shorts: günde 2, çizim formatı ağırlık; seri ismi + sondaki soru + sabit yorumda "Part 2?".
- Uzun video sıklığını yalnızca bir uzun video 500+ izlenme aldığında yeniden değerlendir.

## DÜZELTME — ÇİZİM FORMATI HENÜZ KANITLANMADI (19 Kasım, 4 sa 20 dk)
- 2:36'da 1.327 → 4:20'de 1.384 (durdu). Beğeni 41→38 (YouTube temizliği). Devam %60,5 (flüt 24 saatte %57) → olağanüstü değil.
- Okuma: Çizim formatı YouTube'un İLK test havuzunu en büyük aldı ama ikinci dalgaya geçemedi. ~%40 hâlâ ilk saniyede kaydırıyor. 14 kat kıyası tek videoya dayanıyordu → aşırı genelleme yaptım.
- Karar düzeltmesi: Çizim = HİPOTEZ, kazanan değil. 3-4 çizim Short daha + aynı dönemde gerçek format karşılaştırması → sonra karar. Uzun videoyu formata bağlamadan önce de bu sonuç beklenir.
- Formattan bağımsız kesin işler: kapak tıklanma (CTR), ilk 30 sn, açık döngüler, Shorts→uzun huni (İlgili video bağlantısı), seri adı + sondaki soru.
- Bekleme: 24. saat (flüt 7. saatte 525 → 24. saatte 1.155 olmuştu; geç dalga mümkün).

## KANAL YÖNÜ (19 Kasım akşam, patronla kararlaştırıldı)
- Kimlik: "Yeni keşif açıklandığında YouTube'da en hızlı + en güvenilir anlatan kanal". Shorts günde 2 (güncel keşif) + haftalık uzun "This Week in Archaeology" (10-12 dk, 5-6 keşif, bölümlü). Kaynak kartı her videoda; gerçek/temsili etiketleri.
- HARMAN KURALI (her video, Shorts ve uzun): gerçek görsel + çizim + AI birlikte. Oran sabit yüzde değil, ROLE göre:
  * GERÇEK (~%40-50): kanıt ve kanca. Keşfin kendisi, kazı alanı, buluntu. Kritik "reveal" anları gerçek.
  * ÇİZİM (~%35-45): hikâye/olay/"nasıl oldu" + karakterler, duygu anları, haritalar/kesitler.
  * AI görüntü/video (~%10-15): atmosfer B-roll (antik şehir manzarası vb.), daima "AI reconstruction" etiketli.
- Patron önerisi: çizim %60 / gerçek %30 / AI %10. Benim görüşüm: haber kanalında kanıt gerçek görselde → gerçek payı daha yüksek. Çözüm: ilk 4 Shorts'ta iki oranı dönüşümlü test et (A: çizim ağırlıklı, B: gerçek ağırlıklı), veriye göre sabitle.
- Açılış karesi testi de buna dahil: çizim açılış (Derinkuyu çizim 1.384) vs gerçek buluntu açılış.

## UZUN VİDEO DÖNGÜSÜ (19 Kasım, patron onayıyla)
- 21 Kasım Derinkuyu uzun video KALIYOR (huni testi + eski format kıyas noktası). Yeni formatın 1. bölümü 28 Kasım Cmt 16:00.
- Patron itirazı: her hafta güçlü keşif çıkmaz → tek format sürdürülemez. Haber sayısı bol (günde birkaç; Arkeonews, HeritageDaily, Archaeology Mag, Smithsonian, ScienceDaily, Phys.org) ama "vay be" seviyesi haftada 2-3.
- 4 haftalık döngü (her Cumartesi 16:00):
  1) This Week in Archaeology (haftanın 5 keşfi) — 28 Kasım
  2) Ayın Keşifleri (geri sayım 10) — 5 Aralık
  3) Derin Dalış (son haftaların en büyük keşfi, tek konu) — 12 Aralık
  4) Çözülemeyen Gizem (yeni araştırmayla gündeme gelen eski sır) — 19 Aralık
- Shorts bu formatların en iyi anlarından + güncel keşiflerden beslenir.
- Not (19 Kasım taraması): Menorca süt+şarap kapları, Lake Mezzano tunç kılıç, İsviçre Alpleri 2.600 m 4.000 yıllık takı, Eriha anıtsal mezarlar, Sutton Hoo yeni mezar, Mexico City ossuary, İtalya Messap yazıtlı mezar, Nazca bebek mezarları, Moğol anıtsal mezar.
