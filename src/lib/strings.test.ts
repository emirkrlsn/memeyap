import { describe, expect, it } from "vitest";

import { strings } from "./strings";

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
  it("her metin boş olmayan bir dizgi", () => {
    const values: Array<[string, unknown]> = [];
    collectValues(strings, "strings", values);

    expect(values.length).toBeGreaterThan(0);
    for (const [path, value] of values) {
      expect(typeof value, path).toBe("string");
      expect((value as string).trim(), path).not.toBe("");
    }
  });
});
