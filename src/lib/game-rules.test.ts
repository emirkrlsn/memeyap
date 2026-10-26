import { describe, expect, it } from "vitest";

import { normalizeRoomCode, normalizeUsername } from "./game-rules";

describe("normalizeUsername", () => {
  it("baştaki ve sondaki boşlukları kırpar", () => {
    expect(normalizeUsername("  Emir ")).toBe("Emir");
  });

  it("4–16 karakter kuralını uygular", () => {
    expect(normalizeUsername("abc")).toBeNull();
    expect(normalizeUsername("abcd")).toBe("abcd");
    expect(normalizeUsername("a".repeat(16))).toBe("a".repeat(16));
    expect(normalizeUsername("a".repeat(17))).toBeNull();
    expect(normalizeUsername("     ")).toBeNull();
  });

  it("Türkçe harf, boşluk, özel karakter ve emojiye izin verir", () => {
    expect(normalizeUsername("Çağrı Öz")).toBe("Çağrı Öz");
    expect(normalizeUsername("Zey 😀 #1")).toBe("Zey 😀 #1");
    // Emoji tek karakter sayılır (sunucudaki char_length ile aynı).
    expect(normalizeUsername("😀😀😀😀")).toBe("😀😀😀😀");
  });

  it("kontrol karakterlerini reddeder", () => {
    expect(normalizeUsername("ab\tcd")).toBeNull();
    expect(normalizeUsername("ab\ncd")).toBeNull();
  });
});

describe("normalizeRoomCode", () => {
  it("büyük harfe çevirir, geçersiz karakterleri atar ve 6 karakterle sınırlar", () => {
    expect(normalizeRoomCode("ab12cd")).toBe("AB12CD");
    expect(normalizeRoomCode(" ab-12 cd ")).toBe("AB12CD");
    expect(normalizeRoomCode("abcdefgh")).toBe("ABCDEF");
  });
});
