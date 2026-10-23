/**
 * Kullanıcıya görünen tüm metinler. Metin değiştirmek için sadece bu dosyayı düzenle.
 */
export const strings = {
  app: {
    name: "MemeYap",
    tagline: "Şablonu kap, yazını yaz, en komik meme'i sen yap!",
    description: "Arkadaşlarınla oynanan çok oyunculu meme yapma oyunu.",
  },
  session: {
    connecting: "Bağlanılıyor…",
    ready: "Bağlantı hazır",
    failed: "Bağlantı kurulamadı. Sayfayı yenileyip tekrar dene.",
  },
  common: {
    close: "Kapat",
  },
  home: {
    comingSoon: "Oyun odaları çok yakında burada!",
  },
} as const;
