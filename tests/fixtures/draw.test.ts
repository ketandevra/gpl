import { describe, expect, it } from "vitest";
import {
  confirmDrawOrder,
  FixtureError,
  nextDrawPosition,
  placeDrawnTeam,
  removeDrawPosition,
  validateTournamentConfig,
} from "../../src/lib/fixtures/draw";

describe("manual draw", () => {
  it("preserves the exact organizer-entered order", () => {
    const participants = ["a", "b", "c", "d"];
    let draw = placeDrawnTeam([], "c", participants);
    draw = placeDrawnTeam(draw, "a", participants);
    draw = placeDrawnTeam(draw, "d", participants);
    draw = placeDrawnTeam(draw, "b", participants);
    expect(confirmDrawOrder(draw, participants)).toEqual(["c", "a", "d", "b"]);
  });

  it("rejects a team that was already drawn", () => {
    const participants = ["a", "b", "c"];
    const draw = placeDrawnTeam([], "a", participants);
    expect(() => placeDrawnTeam(draw, "a", participants)).toThrow(FixtureError);
  });

  it("does not confirm an incomplete draw", () => {
    const participants = ["a", "b", "c"];
    const draw = placeDrawnTeam([], "a", participants);
    expect(() => confirmDrawOrder(draw, participants)).toThrow(
      /still waiting to be drawn/,
    );
  });

  it("compacts positions after a correction", () => {
    let draw = [
      { team_id: "a", draw_position: 1 },
      { team_id: "b", draw_position: 2 },
      { team_id: "c", draw_position: 3 },
    ];
    draw = removeDrawPosition(draw, 2);
    expect(draw).toEqual([
      { team_id: "a", draw_position: 1 },
      { team_id: "c", draw_position: 2 },
    ]);
    expect(nextDrawPosition(draw)).toBe(3);
  });

  it("rejects invalid qualifier and match settings", () => {
    expect(() =>
      validateTournamentConfig({
        teamCount: 3,
        minLeagueMatches: 2,
        knockoutQualifiers: 8,
      }),
    ).toThrow(/qualify 8/);
    expect(() =>
      validateTournamentConfig({
        teamCount: 2,
        minLeagueMatches: 2,
        knockoutQualifiers: 2,
      }),
    ).toThrow(/cannot exceed 1/);
  });
});
