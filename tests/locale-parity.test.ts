/**
 * Velnox — i18n locale parity (spec §9).
 *
 * Thai is the source of truth for the key shape (Dict = typeof th). Every
 * locale must expose the exact same flattened key set — switching language
 * must never leave a screen untranslated or crash on a missing key.
 */
import { describe, expect, it } from "vitest";
import { translations } from "../packages/shared/src/lib/i18n/locales";

type DictNode = Record<string, unknown>;

function flattenKeys(node: DictNode, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      keys.push(...flattenKeys(value as DictNode, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe("§9 — locale key parity", () => {
  const thKeys = flattenKeys(translations.th as DictNode);

  it("every locale exposes the same flattened key set as Thai", () => {
    for (const [lang, dict] of Object.entries(translations)) {
      const keys = flattenKeys(dict as DictNode);
      expect(keys, `locale '${lang}' key set must match Thai`).toEqual(thKeys);
    }
  });

  it("all values are non-empty strings", () => {
    for (const [lang, dict] of Object.entries(translations)) {
      for (const key of flattenKeys(dict as DictNode)) {
        const value = key
          .split(".")
          .reduce<unknown>((node, part) => (node as DictNode)?.[part], dict);
        expect(typeof value, `${lang}: ${key} must be a string`).toBe("string");
        expect((value as string).length, `${lang}: ${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });
});
