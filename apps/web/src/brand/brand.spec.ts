// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/** Se mudares o logótipo de propósito, actualiza este valor (sha256 de logo-mark.svg). */
const EXPECTED_SHA256 = "84e62d98b0fa4d9154280b2cd7976008a15408279fb8b90548289e3ee23dd5e2";

test("o ficheiro do logótipo não foi alterado", () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), "logo-mark.svg");
  expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(EXPECTED_SHA256);
});
