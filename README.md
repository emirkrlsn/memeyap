# MemeYap

Arkadaşlarınla oynanan, çok oyunculu ve web tabanlı bir meme yapma oyunu.

**Oyna:** https://emirkrlsn.github.io/memeyap/

Geliştirme planı için [PLAN.md](PLAN.md), Supabase hazırlıkları için [SUPABASE_KURULUM.md](SUPABASE_KURULUM.md) dosyasına bak. Yayın artık Vercel'de değil, GitHub Pages'te (aşağıda).

## Teknolojiler

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- Supabase: Postgres, Realtime, Storage, Anonymous Auth, RPC, pg_cron
- Vitest (birim testleri), Playwright (uçtan uca testler)

## Gereksinimler

- Node.js 24 LTS
- Bir Supabase projesi (anonim giriş ve pg_cron açık)
- Supabase erişim token'ı: `SUPABASE_ACCESS_TOKEN` ortam değişkeni olarak tanımlı olmalı (Supabase CLI ve MCP bunu kullanır)

## Kurulum

```bash
npm install
cp .env.example .env.local   # sonra değerleri doldur
npx playwright install chromium webkit   # webkit: iPhone Safari testi
```

`.env.local` içindeki değerler:

| Değişken | Nereden alınır |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sadece şablon yükleme betiği için. **Asla paylaşma, commit'leme veya GitHub'a ekleme.** |

Supabase projesini bağlamak (bir kez):

```bash
npx supabase link --project-ref <PROJECT_ID>
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu: http://localhost:3000 |
| `npm run build` | Yayın derlemesi: `out/` klasörüne statik site (GitHub Pages için `PAGES_BASE_PATH=/memeyap` ile) |
| `npm run preview` | `out/` klasörünü GitHub Pages'teki gibi http://localhost:4173/memeyap/ adresinde sunar |
| `npm run lint` | ESLint |
| `npm run format` | Prettier ile tüm dosyaları biçimlendir |
| `npm test` | Vitest birim testleri |
| `npm run test:e2e` | Playwright uçtan uca testleri (geliştirme sunucusunu kendisi başlatır; bazı testler süreyi ileri sarmak için `SUPABASE_ACCESS_TOKEN` kullanır). `BASE_URL=https://emirkrlsn.github.io/memeyap/` ile canlı siteye karşı da çalışır |
| `npm run test:db` | `supabase/tests/*.sql` sunucu kuralı testlerini bağlı projede çalıştırır (değişiklikler geri alınır) ve puan tablosunun sunucu/istemcide aynı olduğunu doğrular |
| `npm run templates:seed` | `templates/` klasöründeki görselleri Supabase'e yükler ve şablon tablosunu günceller |
| `npm run db:push` | `supabase/migrations/` içindeki yeni migration'ları bağlı projeye uygula |
| `npm run db:types` | Veritabanı şemasından `src/types/database.ts` tiplerini üret |

## Veritabanı değişiklikleri

Şema yalnızca migration dosyalarıyla yönetilir; Supabase panelinden elle tablo oluşturulmaz.

```bash
npx supabase migration new <ad>   # supabase/migrations/ altında yeni dosya oluşturur
# dosyaya SQL'i yaz
npm run db:push                     # uzak veritabanına uygula
npm run db:types                    # TypeScript tiplerini güncelle
npm run test:db                     # sunucu kurallarını test et
```

Oda verileri (oyuncular, meme'ler, oylar) son oyuncu odadan çıkınca silinir; bağlı kimse kalmayan odaları 15 sn'de bir çalışan bir pg_cron işi temizler. Şablonlar silinmez.

Oyun durumunu değiştiren her işlem bir Postgres fonksiyonudur (RPC, `SECURITY DEFINER`); tablolara istemciden sadece okuma yapılır ve RLS ile kişi yalnızca kendi odasını görür. Sunucu hataları sabit kodlar döner (ör. `ROOM_FULL`); Türkçe karşılıkları `src/lib/strings.ts` içindeki `errors` bölümündedir.

> Supabase, aynı IP'den saatte en fazla 100 yeni anonim girişe izin verir (projede 30'dan 100'e çıkarıldı). Her Playwright tarayıcı bağlamı yeni bir anonim kullanıcıdır; tüm takım yaklaşık 50 kullanır. Art arda çok sık çalıştırırsan sınıra takılabilirsin.

## Meme şablonları

Şablon görselleri **depoya girmez** (telif ve boyut nedeniyle); `templates/` klasöründe yerel olarak durur ve Supabase Storage'daki herkese açık `templates` alanına yüklenir.

1. PNG, JPG, WebP veya GIF dosyalarını `templates/` klasörüne koy.
2. `npm run templates:seed` çalıştır (`.env.local` içinde `SUPABASE_SERVICE_ROLE_KEY` gerekir).
   - Sabit görseller en fazla 1000 px genişliğe küçültülüp WebP'ye, hareketli GIF/WebP'ler 480 px genişliğe küçültülüp GIF'e çevrilir.
   - Aynı görsel iki kez yüklenmez; klasörden silinen şablonlar pasifleştirilir.
   - Betik tekrar çalıştırılabilir: sadece yeni görselleri yükler, kutuları günceller.

### Varsayılan yazı kutuları

Her şablonun varsayılan kutuları `templates/templates.json` dosyasındadır (depoya girer). Tanımı olmayan şablonlar klasik **üst + alt** kutuyla gelir. Biçim — dosya adı → kutular; koordinatlar görselin boyutuna oranla 0–1 arasıdır:

```json
{
  "drake.jpg": [
    { "x": 0.5, "y": 0.0, "w": 0.5, "h": 0.5 },
    { "x": 0.5, "y": 0.5, "w": 0.5, "h": 0.5 }
  ]
}
```

En kolay yol **kutu tanımlama yardımcısı**: `npm run dev` çalışırken http://localhost:3000/dev/kutular adresini aç, şablon seç, kutuları sürükle/boyutlandır ve **Kaydet**'e bas. Kayıt hem `templates.json`'a hem veritabanına yazılır (oyunda hemen geçerli olur). Bu sayfa sadece geliştirme ortamında açılır.

## Yayın (GitHub Pages)

Site statik olarak derlenir ve `main` dalına her gönderimde [.github/workflows/pages.yml](.github/workflows/pages.yml) ile https://emirkrlsn.github.io/memeyap/ adresine yayınlanır. Sunucu gerekmez: oyunun tüm mantığı Supabase'de (RPC, Realtime, pg_cron).

Kontrol listesi:

- [ ] Depo **herkese açık** (ücretsiz GitHub Pages için) ve **Settings → Pages → Source: GitHub Actions**.
- [ ] **Settings → Secrets and variables → Actions → Variables**: `SUPABASE_URL` ve `SUPABASE_PUBLISHABLE_KEY` (herkese açık anahtar). Gizli anahtarlar (`service_role`, erişim token'ı) burada **kullanılmaz**.
- [ ] Supabase: anonim giriş açık; anonim giriş sınırı oyuncu sayısına yetecek kadar (şu an saatte 100 / IP).
- [ ] Gönderimden sonra **Actions** sekmesinde "GitHub Pages" iş akışı yeşil; site açılıyor.
- [ ] İsteğe bağlı: canlı siteye karşı uçtan uca test — `BASE_URL=https://emirkrlsn.github.io/memeyap/ npx playwright test e2e/final.spec.ts`

Statik yayın nedeniyle oda adresi `/oda/?kod=ABC123` biçimindedir. Kutu tanımlama yardımcısı (`*.dev.tsx`) yayına girmez.

## Proje yapısı

```
src/
  app/                 Sayfalar: ana ekran (/) ve oda (/oda/?kod=…); renk paleti: globals.css
  app/dev/kutular/     Kutu tanımlama yardımcısı (sadece geliştirmede)
  components/          Ekranlar (HomeScreen, room/*, game/MemeEditor, meme/BoxEditor …)
  components/ui/       Temel bileşenler: Button, Input, Card, Modal, Toast, Segmented
  lib/game-rules.ts    Oyun kuralları (sunucudaki kontrollerle aynı)
  lib/meme/            Ortak meme çizimi (renderMemeFrame), şablonlar, PNG/GIF/ZIP indirme (GIF: Web Worker)
  lib/strings.ts       Kullanıcıya görünen tüm Türkçe metinler ve hata mesajları
  lib/sound.ts         Oyun sesleri (Web Audio) ve titreşim; ses aç/kapa tercihi
  lib/supabase/        Supabase istemcisi, anonim oturum ve canlı oda durumu (use-room)
  types/database.ts    Otomatik üretilen veritabanı tipleri (elle düzenleme)
supabase/migrations/   Veritabanı migration'ları
supabase/tests/        Sunucu kuralı testleri (npm run test:db)
scripts/               Şablon yükleme, DB test ve yayın önizleme betikleri
.github/workflows/     GitHub Pages yayını
templates/             Şablon görselleri (depoda değil) ve templates.json (depoda)
e2e/                   Playwright testleri
public/fonts/          Anton fontu (SIL Open Font License)
```
