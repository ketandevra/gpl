import { describe, expect, it } from "vitest";
import {
  generateKnockoutPreview,
  nextPowerOfTwo,
  parseFeedsKey,
  seedPositions,
} from "../../src/lib/fixtures/knockout";

function seeds(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    team_id: `t${index + 1}`,
    team_name: `Team ${index + 1}`,
    seed: index + 1,
  }));
}

describe("knockout bracket", () => {
  it("uses a final for 2 qualifiers", () => {
    const preview = generateKnockoutPreview(seeds(2));
    expect(preview.bracket_size).toBe(2);
    expect(preview.playable_matches).toHaveLength(1);
    expect(preview.playable_matches[0]?.match_type).toBe("final");
  });

  it("uses semis and a final for 4 qualifiers", () => {
    const preview = generateKnockoutPreview(seeds(4));
    expect(preview.rounds.map((round) => round.match_type)).toEqual([
      "semi",
      "final",
    ]);
    expect(preview.playable_matches).toHaveLength(2);
  });

  it("gives seeds 1 and 2 byes for 6 qualifiers", () => {
    const preview = generateKnockoutPreview(seeds(6));
    expect(preview.bracket_size).toBe(8);
    expect(preview.bye_count).toBe(2);
    expect(preview.playable_matches).toHaveLength(2);
    const byeTeams = preview.slots
      .filter((slot) => slot.source === "bye")
      .map((slot) => slot.team_id);
    expect(byeTeams).toEqual(["t1", "t2"]);
    expect(preview.playable_matches.every((match) => match.match_type === "prelim")).toBe(
      true,
    );
  });

  it("builds quarters through final for 8 qualifiers", () => {
    const preview = generateKnockoutPreview(seeds(8));
    expect(preview.bye_count).toBe(0);
    expect(preview.rounds.map((round) => round.match_type)).toEqual([
      "quarter",
      "semi",
      "final",
    ]);
    expect(preview.playable_matches).toHaveLength(4);
  });

  it("builds a round of 16 for 16 qualifiers", () => {
    const preview = generateKnockoutPreview(seeds(16));
    expect(preview.rounds[0]?.match_type).toBe("last16");
    expect(preview.playable_matches).toHaveLength(8);
  });

  it("keeps seed positions deterministic", () => {
    expect(nextPowerOfTwo(6)).toBe(8);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(parseFeedsKey("R2-M1-A")).toEqual({
      knockout_key: "R2-M1",
      side: "A",
    });
  });
});
