/**
 * Kullanıcıya görünen tüm metinler. Metin değiştirmek için sadece bu dosyayı düzenle.
 */
export const strings = {
  app: {
    name: "MemeYap",
    tagline: "Şablonu kap, yazını yaz, en komik meme'i sen yap!",
    description: "Arkadaşlarınla oynanan çok oyunculu meme yapma oyunu.",
  },
  common: {
    close: "Kapat",
    loading: "Yükleniyor…",
  },
  home: {
    usernameLabel: "Kullanıcı adın",
    usernamePlaceholder: "Ör. MemeKralı",
    usernameHint: "4–16 karakter",
    create: "Oyun Oluştur",
    or: "ya da",
    codeLabel: "Oyun kodu",
    codePlaceholder: "ABC123",
    join: "Oyuna Katıl",
    alreadyInRoom: (code: string) => `Şu an ${code} kodlu odadasın.`,
    backToRoom: "Odaya dön",
  },
  room: {
    codeLabel: "Oyun kodu",
    copyCode: "Kodu kopyala",
    codeCopied: "Kod kopyalandı!",
    players: "Oyuncular",
    playerCount: (count: number, max: number) => `${count} / ${max}`,
    you: "sen",
    host: "Yönetici",
    disconnected: "Bağlantı koptu",
    settings: "Oyun ayarları",
    rounds: "Tur sayısı",
    roundSeconds: "Tur süresi",
    seconds: (value: number) => `${value} sn`,
    rerolls: "Pas hakkı (her tur)",
    start: "Oyunu Başlat",
    needMorePlayers: (min: number, connected: number) =>
      `Başlatmak için en az ${min} bağlı oyuncu gerekli (şu an ${connected}).`,
    waitingForHost: "Yöneticinin oyunu başlatması bekleniyor…",
    leave: "Odadan ayrıl",
    newHost: (username: string) => `${username} artık oyunun yöneticisi.`,
    youAreHost: "Artık oyunun yöneticisi sensin!",
    roundStarted: (round: number) => `${round}. tur başladı!`,
    gameComingSoon: "Meme oluşturma ekranı bir sonraki aşamada eklenecek.",
    spectating: "Oyun devam ediyor",
    spectatingDetail: (round: number) =>
      `${round}. turdan itibaren sen de oynayacaksın. O zamana kadar izleyebilirsin.`,
    notFound: "Bu oda bulunamadı ya da artık bu odada değilsin.",
  },
  errors: {
    USERNAME_INVALID: "Kullanıcı adı 4–16 karakter olmalı.",
    USERNAME_TAKEN: "Bu kullanıcı adı odada zaten alınmış.",
    ROOM_NOT_FOUND: "Bu kodla bir oda bulunamadı.",
    ROOM_CODE_INVALID: "Oyun kodu 6 karakter olmalı.",
    ROOM_FULL: "Oda dolu (en fazla 15 oyuncu).",
    NOT_HOST: "Bunu sadece oyunun yöneticisi yapabilir.",
    NOT_IN_ROOM: "Artık bu odada değilsin.",
    NOT_ENOUGH_PLAYERS: "Başlatmak için en az 3 bağlı oyuncu gerekli.",
    GAME_ALREADY_STARTED: "Oyun zaten başladı.",
    INVALID_SETTINGS: "Geçersiz oyun ayarı.",
    UNKNOWN: "Bir şeyler ters gitti. Tekrar dene.",
  },
} as const;

export type ErrorCode = keyof typeof strings.errors;

/** Sunucu hata kodunu (ör. ROOM_FULL) Türkçe mesaja çevirir. */
export function errorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  return code in strings.errors
    ? strings.errors[code as ErrorCode]
    : strings.errors.UNKNOWN;
}
