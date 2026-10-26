# MemeYap — Claude Code Geliştirme Promptu

> Bu dosyanın tamamını Claude Code'a ver. Önerilen kullanım: proje klasörünün köküne `PLAN.md` adıyla koy ve Claude Code'a şunu yaz:
> **"PLAN.md dosyasını baştan sona oku. Faz 0'dan başla. Her fazın sonunda dur, bana özet ver ve onayımı bekle."**

---

## 0. Rolün ve çalışma kuralların

Sen kıdemli bir full-stack TypeScript geliştiricisisin. "Make It Meme" oyununun **mantığından esinlenen** (tasarımını, görsellerini, metinlerini veya markasını kopyalamayan) çok oyunculu, web tabanlı bir meme oyunu geliştireceksin. Oyunun çalışma adı **MemeYap**; ben değiştirebilirim.

Kurallar:
1. **Hiçbir şeyi varsayma.** Bu dokümanda yazmayan bir ürün kararı gerekirse (bir süre, bir metin, bir davranış, bir sınır) kodu yazmadan önce bana sor. Teknik uygulama detaylarını (dosya yapısı, değişken adları vb.) kendin seçebilirsin.
2. **Fazları sırayla yap.** Bir fazı bitirmeden diğerine geçme. Her fazın sonunda: ne yaptığını, kabul kriterlerinin her birinin durumunu ve benim yapmam gereken manuel adımları (ör. Supabase panelinde bir ayar) madde madde yaz, sonra **dur ve onayımı bekle**.
3. Her fazın sonunda `npm run build`, `npm run lint` ve testler hatasız geçmeli.
4. Kullanıcıya görünen **tüm metinler Türkçe** olacak. Metinleri tek bir dosyada topla (`src/lib/strings.ts`) ki kolayca düzenlenebilsin.
5. Gizli anahtarları asla koda yazma; `.env.local` kullan ve `.env.example` dosyasını güncel tut.
6. Bir şey belirsizse veya iki geçerli yol varsa, seçenekleri artı/eksileriyle kısaca yaz ve bana sor.

---

## 1. Teknoloji yığını (kesin)

| Katman | Seçim |
|---|---|
| Dil | TypeScript (strict mod) |
| Framework | Next.js (App Router, en güncel kararlı sürüm) |
| Stil | Tailwind CSS |
| Backend | Supabase: Postgres, Realtime, Storage, Anonymous Auth, RPC (Postgres fonksiyonları), pg_cron |
| Supabase istemcisi | `@supabase/supabase-js` |
| Yazı kutusu sürükle/boyutlandır | `react-rnd` |
| GIF çözme / üretme | `gifuct-js` (çözme), `gifenc` (üretme) |
| Toplu indirme | `jszip` |
| Test | Vitest (birim), Playwright (çok oyunculu uçtan uca) |
| Yayın | GitHub → Vercel (otomatik deploy) |

Supabase şeması **migration dosyalarıyla** yönetilecek (`supabase/migrations/`). Panelden elle tablo oluşturulmayacak.

---

## 2. Oyunun kesinleşmiş kuralları

### 2.1 Giriş ve lobi
- Giriş **anonim**: oyuncu sadece kullanıcı adı yazar. Arka planda Supabase **Anonymous Sign-In** kullanılır (RLS için `auth.uid()` gerekir).
- Ana ekranda iki seçenek: **Oyun Oluştur** ve **Oyuna Katıl**.
- Oyun kodu: **6 karakter, büyük harf + rakam** (A–Z, 0–9). Benzersiz olmalı. Katılırken küçük harf girilse de büyük harfe çevrilir.
- Oda kapasitesi: **en fazla 15 oyuncu**. Dolu odaya katılma denemesinde Türkçe hata mesajı gösterilir.
- Oyunu başlatmak için **en az 3 oyuncu** gerekir. Altında "Başlat" butonu pasif olur ve nedeni yazar.
- **Aynı odada aynı kullanıcı adı kullanılamaz** (büyük/küçük harf duyarsız karşılaştır).
- **Oyun ayarlarını host belirler** (lobide):
  - Tur sayısı — varsayılan **3**
  - Tur süresi (saniye) — varsayılan **90**
  - Pas (meme değiştirme) hakkı — seçenekler **3, 4, 5, 6, 7, 8**
- **Host ayrılırsa yetki başka oyuncuya geçer.** Kural: odaya en erken katılmış, hâlâ bağlı olan oyuncu yeni host olur. Tüm oyunculara bildirim gösterilir.
- **Oyun başladıktan sonra yeni oyuncu katılabilir.** Bir sonraki turun meme oluşturma aşamasından itibaren oynar. O ana kadar izleme ekranı görür ve o turda oy vermez. Puanı 0'dan başlar. 15 kişi sınırı yine geçerlidir.

### 2.2 Meme oluşturma aşaması
- Her oyuncuya **farklı, rastgele bir meme şablonu** gelir. Aynı oyunda aynı şablon mümkün olduğunca tekrar edilmez (havuz biterse tekrar serbest).
- Şablonlar **benim hazırlayacağım sabit bir set**ten gelir (Supabase Storage). Set **hem sabit görsel (PNG/JPG) hem hareketli GIF** içerebilir.
- Oyuncu beğenmediği şablonu **pas hakkıyla** değiştirebilir. Hak sayısını host seçer (3–8).
- Yazı kutuları:
  - Her şablon **varsayılan yazı kutularıyla** gelir (şablon tanımında konum ve boyutlarıyla).
  - Oyuncu kutuları **sürükleyip yerini ve boyutunu değiştirebilir**.
  - Oyuncu **yeni kutu ekleyebilir ve silebilir**; meme başına **en fazla 6 kutu**.
  - Yazı stili: **klasik meme fontu** — beyaz, kalın, büyük harf, siyah kenarlık. Not: Impact fontunun lisansı web'e gömülmesine izin vermez; görünüşü çok yakın olan ve açık lisanslı **Anton** fontunu projeye dahil et (self-host). Yazı, kutuya sığacak şekilde otomatik küçülür ve satır kaydırılır.
- Süre: host'un belirlediği tur süresi (varsayılan 90 sn). Geri sayım ekranda görünür.
- Oyuncu "Hazırım" diyebilir. **Tüm aktif oyuncular hazır olursa tur süre dolmadan biter.**
- Süre dolduğunda **boş kalan (hiç yazı girilmemiş) meme oylamaya girmez ve 0 puan alır.** Yazı girilmiş ama "Hazırım" denmemiş meme, son hâliyle otomatik gönderilir.

### 2.3 Oylama aşaması
- Meme'ler **tek tek** gösterilir; **tüm oyuncular aynı anda aynı meme'i** oylar. Sıra rastgeledir.
- Her meme için **30 saniye** süre vardır.
- 5 seçenek ve puanları:

  | Seçenek | Puan |
  |---|---|
  | Çok beğenildi | **+500** |
  | Beğenildi | **+200** |
  | Fena değil | **0** |
  | Beğenilmedi | **−100** |
  | Berbat | **−250** |

- Meme'in puanı = aldığı tüm oyların toplamı. Toplam puan **eksiye düşebilir**.
- Oylama sırasında meme'in **sahibi gizlidir**; o meme'in oylaması bitince sahibi açıklanır.
- Oyuncu **kendi meme'ine oy veremez**; kendi meme'i ekrandayken bekleme ekranı görür.
- **Süre içinde oy vermeyen oyuncu otomatik olarak "Fena değil" (0 puan) vermiş sayılır.**
- **Her turun sonunda ara sıralama** gösterilir.

### 2.4 İndirme
- **Tüm oyuncuların meme'leri** indirilebilir — hem oyun sırasında hem oyun sonunda.
  - Oyun sırasında: oyuncu kendi meme'ini düzenleme ekranında, diğerlerinin meme'lerini ise oylamada ekrana geldikten sonra indirebilir (sahiplik gizliliği bozulmasın diye oylanmadan önce indirilemez).
- Format: Sabit şablonlar **PNG**, GIF şablonlar **GIF** olarak indirilir (yazılar GIF'in her karesine işlenir, animasyon korunur).
- Oyun sonunda **"Tümünü indir"** butonu tüm meme'leri tek bir **ZIP** dosyası olarak verir.
- Meme'ler sunucuda görsel olarak saklanmaz; şablon + yazı kutusu verisi (JSON) saklanır, görsel tarayıcıda üretilir.

### 2.5 Oyun sonu ve sıralama
- Sıralama ekranında **sadece kullanıcı adı ve puan** gösterilir, **en yüksekten en düşüğe**.
- **Eşit puanlı oyuncular aynı sırayı paylaşır.**
- **"Aynı odayla tekrar oyna"** seçeneği olur: oda koduyla birlikte oyuncular lobiye döner, puanlar sıfırlanır.
- Oyun verileri (meme'ler, oylar) **silinir**. (Silme zamanlamasını aşağıdaki "Açık kararlar" bölümünde sor.)

### 2.6 Genel
- Arayüz **sadece Türkçe**.
- **Mobil uyumlu** olmak zorunlu (telefonda dokunarak sürükleme ve boyutlandırma çalışmalı).
- Görsel tarz: **renkli ve eğlenceli** (canlı renkler, yuvarlak köşeler, oyunsu butonlar, hafif animasyonlar). Make It Meme'in görsel tasarımını kopyalama; özgün bir tasarım yap.
- Moderasyon (küfür filtresi, oyuncu atma) **yok**.

---

## 3. Açık kararlar — ilgili faza gelince BANA SOR

Aşağıdakiler henüz karara bağlanmadı. Varsayılan bir değer uygulama; ilgili faza gelince bu soruları bana sor:

1. Host'un tur sayısı ve tur süresi için seçebileceği **alt ve üst sınırlar** neler olacak?
   **Karar:** Tur sayısı **3–5** (varsayılan 3). Tur süresi seçenekleri **60, 90, 120 sn** (varsayılan 90).
2. Pas hakkı **her tur yenilenecek mi**, yoksa **tüm oyun boyunca** mı geçerli olacak?
   **Karar:** **Her tur yenilenir.**
3. Herkes oyunu bitirdiyse, oylama 30 saniye dolmadan bir sonraki meme'e **erken geçilsin mi**?
   **Karar:** **Evet**, oy verebilecek bağlı herkes oy verince hemen geçilir.
4. Oylama bitince sahibin açıklandığı ekran **kaç saniye** görünsün? O ekranda oy dağılımı (kaç kişi hangi seçeneği verdi) da gösterilsin mi?
   **Karar:** **45 saniye**, oy dağılımı **gösterilir**.
5. Ara sıralama ekranından sonraki tura **host butona basınca mı**, yoksa **belirli bir süre sonra otomatik** mi geçilsin?
   **Karar:** **Host butona basınca.** (Son turdan sonra ara sıralama yerine doğrudan oyun sonuna geçilir.)
6. Eşit puanda sıra numaralandırması: **1, 1, 3** mü yoksa **1, 1, 2** mi?
7. Oyun sırasında bağlı oyuncu sayısı **3'ün altına düşerse** ne olsun?
   **Karar:** Oyun **otomatik olarak biter** (oyun sonu ekranına geçilir). Bağlantı kopması 30 sn kuralıyla belirlenir.
8. Veriler **ne zaman silinsin**? (Örn. son oyuncu odadan çıkınca veya oyun bittikten X saat sonra.) Not: oyun bittiği anda silinirse oyun sonu indirme çalışmaz.
9. Bir oyuncunun bağlantısı **kaç saniye** koparsa "ayrıldı" sayılsın?
   **Karar:** **30 saniye.**
10. Kullanıcı adı **uzunluk sınırı** ve izin verilen karakterler neler olacak?
   **Karar:** **4–16 karakter.** Tüm harfler (Türkçe ve diğer diller), rakamlar, boşluk ve özel karakterler serbest. Baştaki/sondaki boşluklar kırpılır; kontrol karakterleri (satır sonu, sekme vb.) reddedilir.

---

## 4. Mimari ilkeler

### 4.1 Sunucu otoritesi
- Oyun durumunu değiştiren **her işlem** Supabase'de `SECURITY DEFINER` Postgres fonksiyonu (RPC) ile yapılır: oda oluşturma, katılma, ayar değiştirme, başlatma, pas, meme kaydetme, hazır olma, oy verme, faz ilerletme, host devri, tekrar oynama.
- Fonksiyonlar `auth.uid()` ile çağıranı doğrular ve her kuralı (kapasite, faz, sahiplik, süre, host yetkisi) **sunucuda** kontrol eder. İstemciye güvenilmez.
- Tablolara doğrudan `insert/update/delete` RLS ile kapalıdır; okuma sadece kişinin bulunduğu odanın verileriyle sınırlıdır.

### 4.2 Zamanlama
- Her fazın bitiş zamanı odada `phase_ends_at` (timestamptz) olarak saklanır.
- İstemciler geri sayımı bu zamana göre gösterir. Sunucu saatiyle farkı düzeltmek için bir `server_now()` RPC'si kullan.
- Süre dolunca **herhangi bir istemci** `advance_phase(room_id)` çağırır. Fonksiyon **idempotent** olmalı (satır kilidi + "süre gerçekten doldu mu / herkes hazır mı" kontrolü). Böylece host'un bağlantısı kopsa bile oyun ilerler.
- Yedek olarak pg_cron ile süresi geçmiş fazları ilerleten bir iş kur (kimse bağlı değilken takılmayı önler).

### 4.3 Gerçek zamanlı senkronizasyon
- Supabase Realtime **Postgres Changes** ile `rooms` ve `players` değişikliklerini dinle (`room_id` filtresiyle).
- Bağlantı durumu için **Presence** + `players.last_seen` heartbeat kullan. Host devri sunucuda bir RPC ile yapılır.
- Sayfa yenilenirse veya bağlantı koparsa oyuncu aynı anonim oturumla **kaldığı yere döner**.

### 4.4 Sahiplik gizliliği
- `memes` tablosundaki `player_id` oylama sırasında diğer oyunculara **sızmamalı**. Oylamadaki meme'i, sahibini gizleyen bir RPC (`get_current_vote_meme`) ile ver; sahip bilgisi sadece açıklama aşamasında dönsün.
- Oylar, oylama bitene kadar diğer oyunculara görünmez.

### 4.5 Tek render fonksiyonu
- Meme'i çizen **tek bir saf fonksiyon** yaz (`renderMemeFrame(ctx, image, boxes, size)`). Düzenleme ekranındaki önizleme, oylama ekranı, PNG indirme ve GIF'in her karesi **aynı fonksiyonu** kullansın. Böylece ekranda görülen ile indirilen birebir aynı olur.
- Yazı kutusu koordinatları **görselin boyutuna oranla (0–1 arası)** saklanır ki farklı ekran boyutlarında aynı görünsün.

### 4.6 Önerilen veri modeli (gerekirse iyileştir, değişikliği bana söyle)
- `templates`: id, storage_path, kind (`image` | `gif`), width, height, default_boxes (jsonb), is_active
- `rooms`: id, code (unique), host_player_id, status (`lobby` | `creating` | `voting` | `reveal` | `round_results` | `final`), total_rounds, round_seconds, reroll_limit, current_round, phase_ends_at, current_vote_meme_id, vote_queue (uuid[]), created_at, finished_at
- `players`: id, room_id, user_id (auth.uid), username, score, joined_at, active_from_round, rerolls_left, is_ready, last_seen, is_connected — `unique(room_id, lower(username))`
- `memes`: id, room_id, round, player_id, template_id, boxes (jsonb), is_submitted, updated_at
- `votes`: id, meme_id, voter_player_id, rating (`cok_begenildi` | `begenildi` | `fena_degil` | `begenilmedi` | `berbat`), points, is_auto — `unique(meme_id, voter_player_id)`
- **Faz 1'de uygulanan değişiklikler:**
  - `players.user_id` benzersiz: bir kullanıcı aynı anda tek odada olur; yeni odaya girince eskisinden çıkar. Bu sayede RPC'ler `room_id` almaz, odayı `auth.uid()`'den bulur.
  - `last_seen`, `players` yerine `private.player_heartbeats` tablosunda. Her heartbeat'te `players` güncellenseydi Realtime herkese gereksiz olay gönderirdi; `is_connected` sadece durum değişince güncellenir.
  - Bağlantı takibi Presence yerine yalnızca heartbeat ile (10 sn'de bir); 30 sn sessiz kalan oyuncu kopmuş sayılır ve host devri bu sırada sunucuda yapılır. Ayrı bir `transfer_host_if_needed` RPC'si yerine bu iş `heartbeat()` ve `leave_room()` içinde.
- **Faz 2'de uygulanan kararlar:**
  - Şablon olarak WebP de kabul edilir. Sabit görseller WebP'ye (en fazla 1000 px), hareketli GIF/WebP'ler GIF'e (480 px) çevrilip Storage'a yüklenir; böylece Faz 4'teki GIF indirme hepsinde çalışır.
  - Şablon görselleri herkese açık GitHub deposuna girmez (telif/boyut); sadece `templates/templates.json` girer.
  - Kutu tanımı olmayan şablon klasik üst + alt kutuyla gelir.
  - Şablon değiştirilince (pas) yeni şablonun varsayılan kutuları gelir; yazılmış metinler sıfırlanır.
  - "Herkes hazır" kontrolü bu turda oynayan **bağlı** oyunculara bakar (kopmuş oyuncu turu bekletmez).
  - Kutu başına en fazla 200 karakter (kötüye kullanıma karşı teknik sınır).
  - `rooms.used_template_ids` bu oyunda dağıtılan şablonları, `rooms.vote_queue` oylanacak meme'leri (rastgele sırada) tutar.
  - Süre bitiminden sonra 2 sn tolerans tanınır (son kayıtlar yetişsin); pg_cron işi 5 sn'de bir süresi geçen turları ilerletir.
- **Faz 3'te uygulanan kararlar:**
  - Oylama: her meme 30 sn (+2 sn tolerans); oy verebilecek **bağlı** herkes oy verince erken geçilir. Oy süre bitene kadar değiştirilebilir.
  - Oy verebilenler: bu turda oynayanlar (geç katılanlar hariç), meme'in sahibi hariç. Süre içinde oy vermeyen (kopmuş olsa da) otomatik "fena değil" (0) alır.
  - **Güncelleme:** Meme'ler tek tek açıklanmaz (45 sn'lik bekleme yok). Bir meme'in oylaması bitince hemen sıradakine geçilir; tur bitince **tek sayfada** turun tüm meme'leri puana göre sıralı, sahibi ve oy dağılımıyla, altında genel sıralamayla gösterilir (Make It Meme'deki gibi). Oylar tablodan okunamaz; sahipler ve dağılım sadece tur bittikten sonra `get_round_results` ile döner. (`reveal` durumu artık kullanılmıyor.)
  - Oylama sırasında hangi oyuncunun oy verdiği gösterilmez (sahip, oy vermeyen kişi olarak anlaşılmasın); sadece "x/y oy verildi" sayısı gösterilir.
  - Hiç meme gönderilmemişse tur doğrudan ara sıralamaya geçer. Son turdan sonra ara sıralama yerine oyun sonu (`final`) gelir.
  - Oyun sırasında bağlı oyuncu 3'ün altına düşerse oyun biter (`rooms.ended_early`).
  - `memes.points` meme'in aldığı puanı, `memes.shown_at` oylamada ekrana geldiği anı tutar (Faz 4'te indirme izni için).
  - Eşit puanlılar şimdilik kullanıcı adına göre sıralanır; sıra numarası (Açık karar 6) Faz 5'te.
- **Faz 4'te uygulanan kararlar:**
  - İndirme yerleri: editörde kendi meme'in, oylamada ekrandaki meme (sahip gizli olduğundan dosya adı `tur{N}_meme{sıra}`), tur sonucunda her meme, oyun sonunda "Tümünü indir" (ZIP).
  - GIF: yazı katmanı ana iş parçacığında renderMemeFrame ile bir kez çizilir (yazı her karede aynı), Web Worker kareleri çözüp bu katmanı her kareye işler ve kare süreleri + döngü sayısı korunarak yeniden kodlar. İlerleme yüzdesi gösterilir.
  - Telefonlarda önce paylaşım menüsü (Web Share API; iOS'ta "Resmi Kaydet") denenir, olmazsa normal indirme.
  - ZIP sadece oyun bitince (`final`) alınabilir ve sadece oylamada ekrana gelmiş meme'leri içerir (`get_game_memes`). Dosya adlarında Türkçe harfler sadeleşir; aynı ada düşenler `_2` ile ayrılır.
  - Ana ekrandaki form, sayfa tarayıcıda hazır olana kadar pasif: yavaş telefonlarda erken yazılan kullanıcı adı silinmesin diye.
- Puan eşlemesi **tek yerde** tanımlansın (bir SQL fonksiyonu + TypeScript'te aynı sabit, testle eşitliği doğrulansın).

---

## 5. Fazlar

### Faz 0 — Proje iskeleti ve Supabase bağlantısı
**Görevler**
- Next.js + TypeScript (strict) + Tailwind projesi kur. ESLint ve Prettier ayarla.
- Supabase CLI ile `supabase/` klasörünü başlat. Migration akışını kur (`supabase db push`).
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase panelinde "publishable key" olarak da geçebilir).
- Supabase istemcisi, anonim oturum açma yardımcı fonksiyonu ve DB tiplerinin otomatik üretimi (`supabase gen types`).
- Anton fontunu projeye ekle. Renkli ve eğlenceli tasarım için temel renk paleti ve bileşenleri (Button, Input, Card, Modal, Toast) oluştur.
- `src/lib/strings.ts` Türkçe metin dosyası.
- Vitest ve Playwright kurulumu, örnek birer test.
- README'ye kurulum ve çalıştırma adımları.

**Kabul kriterleri**
- `npm run dev` ile boş ana sayfa açılıyor; anonim oturum açılıyor ve kullanıcı kimliği konsolda görülebiliyor.
- `npm run build`, `lint` ve testler geçiyor.

### Faz 1 — Giriş, oda ve lobi (Aşama 1)
Önce **Açık kararlar 1, 2, 9 ve 10**'u bana sor.

**Görevler**
- Migration: `rooms`, `players` tabloları, RLS politikaları, Realtime yayını.
- RPC'ler: `create_room(username)`, `join_room(code, username)`, `update_settings(...)`, `leave_room()`, `heartbeat()`, `transfer_host_if_needed(room_id)`, `start_game(room_id)`.
- Ana ekran: kullanıcı adı alanı + "Oyun Oluştur" / "Oyuna Katıl" (kod girişi).
- Lobi ekranı: oda kodu (büyük ve kopyalanabilir), oyuncu listesi (host işaretli, bağlantı durumu), oyuncu sayısı / 15, host için ayar paneli, diğerleri için ayarların salt okunur görünümü, "Başlat" butonu (3 kişiden azsa pasif ve açıklamalı).
- Hata durumları (Türkçe): geçersiz kod, oda dolu, kullanıcı adı alınmış.
- Host devri ve bildirimi.
- Oyun sürerken katılan oyuncu için `active_from_round` mantığı ve izleme ekranının iskeleti.
- Sayfa yenilenince odaya geri dönme.

**Kabul kriterleri**
- 3 ayrı tarayıcıda (biri gizli pencere) aynı odaya girilebiliyor ve liste anlık güncelleniyor.
- 16. oyuncu reddediliyor. Aynı kullanıcı adı (farklı harf büyüklüğüyle de) reddediliyor.
- Host sekmeyi kapatınca belirlenen süre içinde yetki doğru oyuncuya geçiyor.
- Playwright testi: 3 oyuncu oda oluşturup katılıyor ve host oyunu başlatabiliyor.

### Faz 2 — Şablonlar ve meme oluşturma (Aşama 2, birinci kısım)
**Görevler**
- Migration: `templates`, `memes` + Storage bucket (`templates`, herkese okunabilir).
- **Şablon yükleme betiği** (`scripts/seed-templates.ts`): `templates/` klasöründeki PNG/JPG/GIF dosyalarını ve `templates/templates.json` içindeki varsayılan kutu tanımlarını Storage'a ve tabloya yükler. Genişlik/yükseklik ve tür otomatik algılanır. Örnek `templates.json` formatını ve nasıl doldurulacağını README'de anlat.
- Basit bir **kutu tanımlama yardımcısı** (sadece geliştirme ortamında açık bir sayfa): şablonu seç, kutuları sürükleyerek yerleştir, JSON çıktısını kopyala. (Bunu yapmadan önce bana sor; istemezsem atla.)
- RPC'ler: `assign_templates(room_id)` (tur başında herkese farklı şablon), `reroll_template()`, `save_meme(boxes)`, `set_ready(bool)`, `advance_phase(room_id)`.
- Meme editörü:
  - Şablon (GIF ise animasyonlu) + `react-rnd` ile sürüklenebilir/boyutlandırılabilir yazı kutuları, mobilde dokunmatik destek.
  - Kutuya dokununca metin girişi; "Kutu ekle" (en fazla 6), kutu silme.
  - Klasik meme stili, otomatik sığdırma (ortak render fonksiyonu).
  - Kalan pas hakkı göstergesi ve "Değiştir" butonu.
  - Geri sayım, "Hazırım" butonu, kaç kişinin hazır olduğu.
  - Değişiklikler kısa aralıklarla (debounce) sunucuya kaydedilsin; süre dolunca son hâl esas alınsın.
- Faz geçişi: süre dolunca veya herkes hazır olunca oylamaya geç; boş meme'ler oylama kuyruğuna alınmaz.

**Kabul kriterleri**
- Aynı turda 3 oyuncu 3 farklı şablon alıyor.
- Pas hakkı sınırı sunucuda uygulanıyor (istemci manipüle edilse bile).
- Telefon boyutunda (Chrome DevTools mobil görünümü) kutular sürüklenip boyutlandırılabiliyor.
- Herkes hazır deyince tur hemen bitiyor; kimse demese de süre sonunda bitiyor.
- `renderMemeFrame` için birim testleri (metin kaydırma ve sığdırma).

### Faz 3 — Oylama ve ara sıralama (Aşama 2, ikinci kısım)
Önce **Açık kararlar 3, 4, 5 ve 7**'yi bana sor.

**Görevler**
- Migration: `votes` tablosu, puan eşleme fonksiyonu, RLS.
- RPC'ler: `get_current_vote_meme(room_id)` (sahibi gizli), `cast_vote(meme_id, rating)`, oylama süresi dolunca oy vermeyenler için otomatik "Fena değil" kaydı, sahip açıklama, puanların `players.score`'a eklenmesi.
- Oylama ekranı: meme (GIF ise animasyonlu), 30 sn geri sayım, 5 büyük ve renkli seçenek butonu (mobilde rahat basılabilir), oy verildikten sonra seçimin vurgulanması.
- Kendi meme'i ekrandaki oyuncuya bekleme ekranı.
- Sahip açıklama ekranı.
- Tur sonu **ara sıralama** ekranı (kullanıcı adı + puan, yüksekten düşüğe).
- Geç katılan oyuncu o turda oy vermiyor, izleme ekranı görüyor.

**Kabul kriterleri**
- Puanlar tabloyla birebir aynı: +500 / +200 / 0 / −100 / −250.
- Oy vermeyen oyuncu için 0 puanlık otomatik oy oluşuyor.
- Oyuncu kendi meme'ine oy veremiyor (sunucu reddediyor).
- Oylama sırasında ağ isteklerinde meme sahibinin kimliği görünmüyor (tarayıcı DevTools ile kontrol et).
- Birim testleri: puan hesaplama ve sıralama (eşit puan dahil).
- Playwright testi: 3 oyuncuyla 1 tam tur (oluştur → oyla → ara sıralama).

### Faz 4 — İndirme (PNG, GIF, ZIP)
**Görevler**
- PNG dışa aktarma: ortak render fonksiyonu ile şablonun orijinal çözünürlüğünde.
- GIF dışa aktarma: `gifuct-js` ile kareleri çöz, her kareye yazıları çiz, `gifenc` ile kare süreleri ve döngü korunarak yeniden kodla. Uzun GIF'lerde arayüz donmasın (Web Worker kullan) ve ilerleme göster.
- Oyun sırasında indirme butonları (Kurallar 2.4'e göre).
- Oyun sonunda "Tümünü indir" → ZIP. Dosya adları: `tur{N}_{kullaniciadi}.png/gif` (Türkçe karakterleri dosya adı için güvenli hâle getir).
- Mobil Safari ve Chrome'da indirmenin çalıştığını doğrula (gerekirse Web Share API ile paylaş/kaydet).

**Kabul kriterleri**
- İndirilen PNG, ekrandaki meme ile birebir aynı.
- İndirilen GIF animasyonlu ve yazılar her karede görünüyor.
- ZIP tüm turların tüm gönderilmiş meme'lerini içeriyor.
- Henüz oylanmamış başka bir oyuncunun meme'i indirilemiyor.

### Faz 5 — Oyun sonu, sıralama, tekrar oyna ve temizlik (Aşama 3)
Önce **Açık kararlar 6 ve 8**'i bana sor.

**Görevler**
- Final sıralama ekranı: kullanıcı adı + puan, yüksekten düşüğe, eşit puanlılar aynı sırada.
- "Tümünü indir" butonu.
- "Aynı odayla tekrar oyna": `restart_room(room_id)` RPC'si; puanları, meme'leri, oyları sıfırlar ve lobiye döner (host başlatır).
- Veri silme: kararlaştırılan zamanlamaya göre pg_cron işi ve/veya oda boşalınca silme. Şablonlar silinmez.

**Kabul kriterleri**
- Eşit puan senaryosu testle doğrulandı.
- Tekrar oyna sonrası aynı kodla yeni oyun sorunsuz başlıyor.
- Silme işi çalıştıktan sonra ilgili oda verisi veritabanında kalmıyor.
- Playwright testi: 3 oyuncuyla 3 turluk tam oyun, final sıralaması doğru.

### Faz 6 — Cila, dayanıklılık ve yayın
**Görevler**
- Uç durumlar: oyun sırasında sayfa yenileme, bağlantı kopup geri gelme, host'un oylama ortasında ayrılması, geç katılan oyuncunun herhangi bir fazda gelmesi, 15 kişilik oda.
- Yükleme durumları, boş durumlar, Türkçe hata mesajları, ses/animasyon gibi eğlenceli küçük dokunuşlar (eklemeden önce listesini bana göster).
- Erişilebilirlik temel kontrolleri (buton etiketleri, kontrast, klavye ile kullanım).
- Lighthouse mobil kontrolü.
- Vercel yayın kontrol listesini README'ye ekle (ortam değişkenleri, Supabase ayarları).

**Kabul kriterleri**
- Telefon ve masaüstünde 3+ kişiyle canlı ortamda (Vercel) tam oyun sorunsuz oynanıyor.
- Tüm testler geçiyor ve README eksiksiz.

---

## 6. Başlarken

İlk iş olarak:
1. Bu dokümanı okuduğunu ve anladığını kısaca özetle.
2. Belirsiz bulduğun noktaları sor.
3. Faz 0'a başla.
