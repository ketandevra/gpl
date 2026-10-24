import { describe, expect, it } from "vitest";
import {
  nextPublicCodeFrom,
  pickCanonicalPublicCode,
} from "@/lib/teams/public-code";

describe("nextPublicCodeFrom", () => {
  it("continues the global sequence", () => {
    expect(nextPublicCodeFrom(["P001", "P111", "P007"])).toBe("P112");
  });
});

describe("pickCanonicalPublicCode", () => {
  it("reuses the only code a player already has", () => {
    expect(
      pickCanonicalPublicCode([
        { public_code: "P004", tournament_id: "t1" },
        { public_code: "P004", tournament_id: "t2" },
      ]),
    ).toBe("P004");
  });

  it("keeps the current-tournament id when editions disagree", () => {
    expect(
      pickCanonicalPublicCode(
        [
          { public_code: "P001", tournament_id: "gpl1", created_at: "2024-01-01" },
          { public_code: "P004", tournament_id: "gpl2", created_at: "2026-01-01" },
        ],
        "gpl2",
      ),
    ).toBe("P004");
  });
});
