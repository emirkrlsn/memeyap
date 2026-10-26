const TURKISH: Record<string, string> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

/** Kullanıcı adını dosya adında güvenle kullanılacak hâle getirir (Türkçe harfler sadeleşir). */
export function safeFileName(name: string): string {
  const safe = name
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => TURKISH[char])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return safe || "oyuncu";
}

/** tur{N}_{ad}.{uzantı} */
export function memeFileName(
  round: number,
  label: string,
  extension: string,
): string {
  return `tur${round}_${safeFileName(label)}.${extension}`;
}

/** Aynı ada düşen dosyaları ayırt eder: a.png, a_2.png, a_3.png … */
export function uniqueFileNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf(".");
    return `${name.slice(0, dot)}_${count}${name.slice(dot)}`;
  });
}
