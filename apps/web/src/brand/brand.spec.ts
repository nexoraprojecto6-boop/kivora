// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/** Se mudares o logótipo de propósito, actualiza este valor (sha256 de logo-mark.svg). */
const EXPECTED_SHA256 = "fcc3ce488b1cdf25db849d5fc95e67efd4c9fcab4e7d0daf287951592959b13d";

test("o ficheiro do logótipo não foi alterado", () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), "logo-mark.svg");
  expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(EXPECTED_SHA256);
});
