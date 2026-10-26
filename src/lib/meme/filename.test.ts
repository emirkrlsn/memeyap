import { describe, expect, it } from "vitest";

import { memeFileName, safeFileName, uniqueFileNames } from "./filename";

describe("safeFileName", () => {
  it("Türkçe harfleri sadeleştirir", () => {
    expect(safeFileName("Çağrı Şükrü Öztürk İpek")).toBe(
      "Cagri_Sukru_Ozturk_Ipek",
    );
  });

  it("boşluk, özel karakter ve emojiyi alt çizgiye çevirir", () => {
    expect(safeFileName("Zey 😀 #1")).toBe("Zey_1");
    expect(safeFileName("a/b\\c:d")).toBe("a_b_c_d");
  });

  it("geriye bir şey kalmazsa 'oyuncu' der", () => {
    expect(safeFileName("😀😀😀😀")).toBe("oyuncu");
  });
});

describe("memeFileName", () => {
  it("tur{N}_{ad}.{uzantı} biçiminde", () => {
    expect(memeFileName(2, "Ayşe Gül", "gif")).toBe("tur2_Ayse_Gul.gif");
  });
});

describe("uniqueFileNames", () => {
  it("aynı adları numaralandırır", () => {
    expect(uniqueFileNames(["a.png", "b.png", "a.png", "a.png"])).toEqual([
      "a.png",
      "b.png",
      "a_2.png",
      "a_3.png",
    ]);
  });
});
