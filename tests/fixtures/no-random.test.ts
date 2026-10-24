import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "src/lib/fixtures/draw.ts",
  "src/lib/fixtures/league.ts",
  "src/lib/fixtures/knockout.ts",
  "src/lib/fixtures/eligibility.ts",
  "src/lib/fixtures/service.ts",
];

describe("fixture engine source", () => {
  it("does not use Math.random or shuffle helpers to place teams", () => {
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/Math\.random\s*\(/);
      expect(source, file).not.toMatch(/shuffleInPlace|fisherYates|mulberry32/);
    }
  });
});
