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
    spectating: "Oyun devam ediyor",
    spectatingDetail: (round: number) =>
      `${round}. turdan itibaren sen de oynayacaksın. O zamana kadar izleyebilirsin.`,
    notFound: "Bu oda bulunamadı ya da artık bu odada değilsin.",
  },
  game: {
    round: (round: number, total: number) => `Tur ${round}/${total}`,
    timeLeft: "Kalan süre",
    readyCount: (ready: number, total: number) => `${ready}/${total} hazır`,
    ready: "Hazırım!",
    unready: "Vazgeç, düzenleyeceğim",
    waitingOthers: "Hazırsın! Diğer oyuncular bekleniyor…",
    timeUp: "Süre doldu!",
    reroll: (left: number) => `Şablonu değiştir (${left})`,
    addBox: "+ Kutu ekle",
    maxBoxes: (max: number) => `En fazla ${max} kutu`,
    boxLabel: (index: number) => `${index}. kutu`,
    removeBox: (index: number) => `${index}. kutuyu sil`,
    boxPlaceholder: "Komik bir şey yaz…",
    editorHint: "Kutuları sürükleyerek taşı, sarı köşeden boyutlandır.",
  },
  voting: {
    progress: (index: number, total: number) => `Meme ${index}/${total}`,
    question: "Bu meme nasıl?",
    votesCast: (cast: number, voters: number) => `${cast}/${voters} oy verildi`,
    yours: "Bu senin meme'in! Diğerleri oyluyor…",
    spectating: "Bu turda izleyicisin; bir sonraki turda sen de oynayacaksın.",
    voted: "Oyun kaydedildi. İstersen değiştirebilirsin.",
  },
  ratings: {
    cok_begenildi: "Çok beğenildi",
    begenildi: "Beğenildi",
    fena_degil: "Fena değil",
    begenilmedi: "Beğenilmedi",
    berbat: "Berbat",
  },
  results: {
    roundOver: (round: number) => `${round}. tur bitti!`,
    standings: "Ara sıralama",
    roundMemes: (round: number) => `${round}. turun meme'leri`,
    noMemes: "Bu turda oylanan meme yok.",
    madeBy: "Yapan",
    unknownOwner: "Oyundan ayrılan bir oyuncu",
    nextRound: "Sonraki tura geç",
    waitingForHost: "Yöneticinin sonraki turu başlatması bekleniyor…",
    gameOver: "Oyun bitti!",
    endedEarly:
      "Bağlı oyuncu sayısı 3'ün altına düştüğü için oyun erken bitti.",
    finalStandings: "Sıralama",
    points: (points: string) => `${points} puan`,
  },
  devTools: {
    title: "Kutu tanımlama yardımcısı",
    intro:
      "Şablon seç, kutuları sürükleyerek yerleştir ve kaydet. Kayıt templates/templates.json dosyasına ve veritabanına yazılır.",
    filterAll: "Tümü",
    filterTodo: "Varsayılan kutulu",
    filterDone: "Özel kutulu",
    sample: (index: number) => `Örnek yazı ${index}`,
    save: "Kaydet",
    saveAndNext: "Kaydet ve sonraki",
    saved: "Kaydedildi!",
    reset: "Varsayılana dön",
    copyJson: "JSON'u kopyala",
    copied: "JSON kopyalandı!",
    count: (shown: number, total: number) => `${shown} / ${total} şablon`,
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
    INVALID_BOXES: "Yazı kutuları geçersiz.",
    PHASE_OVER: "Bu aşama bitti.",
    NOT_PLAYING: "Bu turda oynamıyorsun.",
    NO_REROLLS_LEFT: "Pas hakkın kalmadı.",
    NO_TEMPLATES: "Hiç meme şablonu yüklenmemiş.",
    OWN_MEME: "Kendi meme'ine oy veremezsin.",
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
