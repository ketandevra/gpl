import { describe, expect, it } from "vitest";
import { FixtureError } from "../../src/lib/fixtures/draw";
import { generateCircleRounds, generateLeaguePreview } from "../../src/lib/fixtures/league";

function teams(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    short_name: `T${index + 1}`,
    logo_url: null,
    draw_position: index + 1,
  }));
}

function pairSet(preview: ReturnType<typeof generateLeaguePreview>) {
  return new Set(
    preview.fixtures.map((fixture) =>
      [fixture.team_a_id, fixture.team_b_id].sort().join("|"),
    ),
  );
}

describe("deterministic league fixtures", () => {
  it.each([3, 4, 8, 12, 13, 14, 17, 32])(
    "gives every team at least 2 distinct opponents for %s teams",
    (count) => {
      const preview = generateLeaguePreview({
        teams: teams(count),
        method: "minimum",
        minMatches: 2,
      });
      expect(preview.valid).toBe(true);
      expect(preview.duplicate_pairings).toBe(0);
      for (const row of preview.team_counts) {
        expect(row.matches).toBeGreaterThanOrEqual(2);
        expect(new Set(row.opponents).size).toBeGreaterThanOrEqual(2);
      }
      const seenRoundTeams = new Map<number, string[]>();
      for (const fixture of preview.fixtures) {
        const list = seenRoundTeams.get(fixture.round_number) ?? [];
        expect(list).not.toContain(fixture.team_a_id);
        expect(list).not.toContain(fixture.team_b_id);
        list.push(fixture.team_a_id, fixture.team_b_id);
        seenRoundTeams.set(fixture.round_number, list);
      }
    },
  );

  it("rejects 2 teams when 2 distinct opponents are required", () => {
    expect(() =>
      generateLeaguePreview({
        teams: teams(2),
        method: "minimum",
        minMatches: 2,
      }),
    ).toThrow(FixtureError);
  });

  it("never randomizes: the same draw always yields the same fixtures", () => {
    const input = teams(13);
    const first = generateLeaguePreview({
      teams: input,
      method: "minimum",
      minMatches: 2,
    });
    const second = generateLeaguePreview({
      teams: input,
      method: "minimum",
      minMatches: 2,
    });
    expect(second.fixtures).toEqual(first.fixtures);
  });

  it("changes pairings when the draw order changes", () => {
    const base = teams(8);
    const rotated = [...base.slice(1), base[0]!].map((team, index) => ({
      ...team,
      draw_position: index + 1,
    }));
    const a = generateLeaguePreview({ teams: base, method: "minimum", minMatches: 2 });
    const b = generateLeaguePreview({
      teams: rotated,
      method: "minimum",
      minMatches: 2,
    });
    expect([...pairSet(a)]).not.toEqual([...pairSet(b)]);
  });

  it("assigns byes for odd team counts and does not count them as matches", () => {
    const preview = generateLeaguePreview({
      teams: teams(13),
      method: "minimum",
      minMatches: 2,
    });
    expect(preview.bye_rounds.length).toBeGreaterThan(0);
    const appearances =
      preview.team_counts.reduce((sum, row) => sum + row.matches, 0) +
      preview.bye_rounds.length;
    expect(appearances).toBe(preview.rounds.length * 13);
  });

  it("can generate a full round-robin without duplicate pairings", () => {
    const preview = generateLeaguePreview({
      teams: teams(8),
      method: "round_robin",
      minMatches: 2,
    });
    expect(preview.total_matches).toBe(28);
    expect(pairSet(preview).size).toBe(28);
    expect(generateCircleRounds(teams(8).map((team) => team.id))).toHaveLength(7);
  });
});
