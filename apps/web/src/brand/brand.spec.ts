// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/** Se mudares o logótipo de propósito, actualiza este valor (sha256 de logo-mark.svg). */
const EXPECTED_SHA256 = "8d42a66cb5360792ac94c79e6bd2deded4dadb29088e6fc831973450ab1490cb";

test("o ficheiro do logótipo não foi alterado", () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), "logo-mark.svg");
  expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(EXPECTED_SHA256);
});
