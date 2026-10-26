import { describe, expect, it } from "vitest";

import { errorMessage, strings } from "./strings";

function collectValues(
  value: unknown,
  path: string,
  out: Array<[string, unknown]>,
) {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value))
      collectValues(child, `${path}.${key}`, out);
  } else {
    out.push([path, value]);
  }
}

describe("strings", () => {
  it("her metin boş olmayan bir dizgi ya da dizgi üreten bir fonksiyon", () => {
    const values: Array<[string, unknown]> = [];
    collectValues(strings, "strings", values);

    expect(values.length).toBeGreaterThan(0);
    for (const [path, value] of values) {
      const text =
        typeof value === "function"
          ? (value as (...args: unknown[]) => unknown)("1", "2")
          : value;
      expect(typeof text, path).toBe("string");
      expect((text as string).trim(), path).not.toBe("");
    }
  });
});

describe("errorMessage", () => {
  it("sunucu hata kodunu Türkçe mesaja çevirir", () => {
    expect(errorMessage({ message: "ROOM_FULL" })).toBe(
      strings.errors.ROOM_FULL,
    );
  });

  it("bilinmeyen hatalarda genel mesaj döner", () => {
    expect(errorMessage(new Error("network"))).toBe(strings.errors.UNKNOWN);
    expect(errorMessage(null)).toBe(strings.errors.UNKNOWN);
  });
});
