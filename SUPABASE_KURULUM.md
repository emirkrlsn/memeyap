# Supabase, GitHub ve Vercel Kurulum Kılavuzu

Bu kılavuz, Claude Code'a başlamadan önce yapman gereken hazırlıkları anlatır. Toplam süre yaklaşık 20–30 dakikadır.

> Not: Supabase ve Vercel arayüzlerindeki menü adları zamanla değişebilir. Bir menüyü bulamazsan panelin arama kutusuna ayarın adını yaz.

---

## 1. Bilgisayarına kurman gerekenler

1. **Node.js (LTS sürümü)** — https://nodejs.org adresinden indir. Kurulumdan sonra terminalde kontrol et:
   ```bash
   node -v
   npm -v
   ```
2. **Git** — https://git-scm.com adresinden indir.
3. **Claude Code** — kurulu olduğunu varsayıyorum; değilse resmi dokümantasyondaki kurulum adımlarını izle.
4. **Supabase CLI** — veritabanı tablolarını koddan oluşturmak için gerekli. Proje oluşturulduktan sonra Claude Code bunu projeye geliştirme bağımlılığı olarak ekleyecek ve `npx supabase ...` ile çalıştıracak. Ayrıca bir şey kurmana gerek yok.

---

## 2. Supabase hesabı ve projesi

1. https://supabase.com adresine git ve **GitHub hesabınla** kaydol (sonradan işleri kolaylaştırır).
2. **New project** butonuna tıkla.
3. Ayarlar:
   - **Name:** `memeyap` (istediğin bir ad)
   - **Database Password:** güçlü bir şifre oluştur ve **bir yere kaydet**. Daha sonra CLI bağlantısında lazım olacak.
   - **Region:** Türkiye'ye en yakın olan **Central EU (Frankfurt)** bölgesini seç. Bu, oyundaki gecikmeyi azaltır.
   - **Plan:** Free yeterli.
4. **Create new project**'e tıkla ve projenin hazırlanmasını bekle (1–2 dakika).

> Ücretsiz planda proje **bir hafta boyunca hiç kullanılmazsa duraklatılır**. Panelden tek tıkla tekrar başlatabilirsin.

---

## 3. API bilgilerini al

1. Proje panelinde **Project Settings** (dişli simgesi) → **API** veya **API Keys** bölümüne git.
2. Şu iki değeri bir yere not et:
   - **Project URL** — `https://xxxxxxxx.supabase.co` biçiminde
   - **anon / publishable key** — herkese açık anahtar (tarayıcıda kullanılması güvenlidir)
3. **service_role / secret key**'i kimseyle paylaşma ve asla GitHub'a yükleme. Şablon yükleme betiği için Claude Code bunu isteyebilir; sadece kendi bilgisayarındaki `.env.local` dosyasına koy.
4. Ayrıca **Project Settings → General** sayfasındaki **Project ID / Reference ID** değerini not et (CLI bağlantısı için).

---

## 4. Anonim girişi aç

Oyuncular sadece kullanıcı adıyla gireceği için bu ayar şart:

1. **Authentication** → **Sign In / Providers** (veya **Providers**) bölümüne git.
2. **Allow anonymous sign-ins** seçeneğini **aç** ve kaydet.

> İsteğe bağlı: Kötüye kullanıma karşı ileride aynı bölümden CAPTCHA koruması eklenebilir. Şimdilik gerekli değil.

---

## 5. pg_cron eklentisini aç

Süresi dolan turları otomatik ilerletmek ve eski oyun verilerini silmek için kullanılacak.

1. **Database** → **Extensions** bölümüne git.
2. Arama kutusuna `pg_cron` yaz ve **etkinleştir**.

---

## 6. Tablolar, Realtime ve Storage

Bunları **elle oluşturma**. Claude Code bunları migration dosyalarıyla oluşturacak. Senin yapacağın tek şey, Claude Code istediğinde terminalde şu komutları çalıştırmak (veya Claude Code'un çalıştırmasına izin vermek):

```bash
npx supabase login                          # tarayıcıda Supabase hesabınla onay verirsin
npx supabase link --project-ref <PROJECT_ID> # 3. adımda not ettiğin ID; veritabanı şifresini sorar
npx supabase db push                        # tabloları ve fonksiyonları oluşturur
```

Bundan sonra panelde **Table Editor** altında tabloları görebilirsin.

---

## 7. Meme şablonlarını hazırla

1. Oyunda kullanılacak meme görsellerini topla: **PNG, JPG veya GIF**.
2. Sayı önerisi: 15 kişi × 3 tur × pas hakları düşünüldüğünde tekrar görmemek için **en az 60–80 şablon** iyi olur. Daha az şablonla da çalışır; havuz bitince şablonlar tekrar eder.
3. Boyut önerisi: genişlik 500–1000 piksel; GIF'ler mümkünse **5 MB'ın altında** (büyük GIF'ler telefonda yavaş işlenir).
4. Dosyaları proje klasöründeki `templates/` klasörüne koy. Claude Code Faz 2'de bunları yükleyen betiği ve varsayılan yazı kutularını tanımlama yöntemini hazırlayacak.

> Telif hakkına dikkat: Ticari yayın düşünüyorsan kullanacağın görsellerin kullanım haklarını kontrol et.

---

## 8. GitHub deposu

1. https://github.com üzerinde **New repository** oluştur. Ad: `memeyap`. Görünürlük: **Private** önerilir.
2. README ekleme seçeneğini boş bırak (projeyi Claude Code oluşturacak).
3. Claude Code Faz 0'ı bitirince proje klasöründe:
   ```bash
   git init
   git add .
   git commit -m "Faz 0: proje iskeleti"
   git branch -M main
   git remote add origin https://github.com/<kullanici-adin>/memeyap.git
   git push -u origin main
   ```
   (Bu adımları Claude Code'a da yaptırabilirsin.)
4. `.env.local` dosyasının `.gitignore` içinde olduğundan emin ol. **Anahtarlar GitHub'a gitmemeli.**

---

## 9. Vercel ile yayın (kullanılmıyor)

> **Not:** Proje Vercel yerine **GitHub Pages**'te yayınlanıyor. Güncel adımlar için README'deki "Yayın (GitHub Pages)" bölümüne bak. Bu bölüm sadece kayıt amaçlı duruyor.

1. https://vercel.com adresine **GitHub hesabınla** kaydol.
2. **Add New → Project** → GitHub'daki `memeyap` deposunu seç → **Import**.
3. Framework olarak **Next.js** otomatik algılanır.
4. **Environment Variables** bölümüne ekle:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon / publishable key
   - (service_role anahtarını **Vercel'e ekleme**; sadece yerel şablon yükleme betiği kullanır.)
5. **Deploy**'a tıkla. Bundan sonra `main` dalına her push'ta site otomatik güncellenir.
6. Sana verilen `https://memeyap-xxxx.vercel.app` adresinden oyunu açıp arkadaşlarınla test edebilirsin.

---

## 10. Claude Code'a başlamadan önce kontrol listesi

- [ ] Node.js ve Git kurulu
- [ ] Supabase projesi oluşturuldu (bölge: Frankfurt)
- [ ] Project URL, anon key, Project ID ve veritabanı şifresi not edildi
- [ ] Anonim giriş açık
- [ ] pg_cron açık
- [ ] GitHub deposu oluşturuldu
- [ ] Şablon görselleri toplanmaya başlandı
- [ ] `CLAUDE_CODE_PROMPT.md` dosyası proje klasörüne `PLAN.md` olarak kopyalandı

Hazır olunca proje klasöründe Claude Code'u aç ve şunu yaz:

> **PLAN.md dosyasını baştan sona oku. Faz 0'dan başla. Her fazın sonunda dur, bana özet ver ve onayımı bekle.**
