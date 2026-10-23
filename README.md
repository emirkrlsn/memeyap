# MemeYap

Arkadaşlarınla oynanan, çok oyunculu ve web tabanlı bir meme yapma oyunu. Geliştirme planı için [PLAN.md](PLAN.md), Supabase / GitHub / Vercel hazırlıkları için [SUPABASE_KURULUM.md](SUPABASE_KURULUM.md) dosyasına bak.

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
npx playwright install chromium
```

`.env.local` içindeki değerler:

| Değişken | Nereden alınır |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sadece şablon yükleme betiği için. **Asla paylaşma, commit'leme veya Vercel'e ekleme.** |

Supabase projesini bağlamak (bir kez):

```bash
npx supabase link --project-ref <PROJECT_ID>
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu: http://localhost:3000 |
| `npm run build` | Production derlemesi |
| `npm run lint` | ESLint |
| `npm run format` | Prettier ile tüm dosyaları biçimlendir |
| `npm test` | Vitest birim testleri |
| `npm run test:e2e` | Playwright uçtan uca testleri (geliştirme sunucusunu kendisi başlatır) |
| `npm run db:push` | `supabase/migrations/` içindeki yeni migration'ları bağlı projeye uygula |
| `npm run db:types` | Veritabanı şemasından `src/types/database.ts` tiplerini üret |

## Veritabanı değişiklikleri

Şema yalnızca migration dosyalarıyla yönetilir; Supabase panelinden elle tablo oluşturulmaz.

```bash
npx supabase migration new <ad>   # supabase/migrations/ altında yeni dosya oluşturur
# dosyaya SQL'i yaz
npm run db:push                     # uzak veritabanına uygula
npm run db:types                    # TypeScript tiplerini güncelle
```

## Proje yapısı

```
src/
  app/                 Sayfalar ve genel stiller (renk paleti: globals.css)
  components/ui/       Temel bileşenler: Button, Input, Card, Modal, Toast
  lib/strings.ts       Kullanıcıya görünen tüm Türkçe metinler
  lib/supabase/        Supabase istemcisi ve anonim oturum yardımcısı
  types/database.ts    Otomatik üretilen veritabanı tipleri (elle düzenleme)
supabase/migrations/   Veritabanı migration'ları
e2e/                   Playwright testleri
public/fonts/          Anton fontu (SIL Open Font License)
```
