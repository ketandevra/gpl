import { describe, expect, it } from "vitest";
import { evaluateLeagueEligibility } from "../../src/lib/fixtures/eligibility";

const teams = [
  { id: "a", name: "Team Falcon" },
  { id: "b", name: "Team Lions" },
  { id: "c", name: "Team Tigers" },
];

describe("knockout eligibility", () => {
  it("blocks knockout until each team has the required completed matches", () => {
    const report = evaluateLeagueEligibility({
      teams,
      matches: [
        {
          team_a_id: "a",
          team_b_id: "b",
          status: "completed",
          match_type: "league",
          stage: "league",
        },
        {
          team_a_id: "b",
          team_b_id: "c",
          status: "scheduled",
          match_type: "league",
          stage: "league",
        },
      ],
      minMatches: 2,
      qualifierCount: 2,
      drawConfirmed: true,
      leagueFixturesConfirmed: true,
      leagueStageCompleted: false,
    });
    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.message.includes("Team Falcon"))).toBe(
      true,
    );
    expect(report.issues.some((issue) => /completed only 1 of the required 2/.test(issue.message))).toBe(
      true,
    );
  });

  it("does not count scheduled, postponed, cancelled, or abandoned matches", () => {
    const report = evaluateLeagueEligibility({
      teams,
      matches: [
        { team_a_id: "a", team_b_id: "b", status: "scheduled", match_type: "league" },
        { team_a_id: "a", team_b_id: "c", status: "postponed", match_type: "league" },
        { team_a_id: "b", team_b_id: "c", status: "cancelled", match_type: "league" },
        { team_a_id: "a", team_b_id: "b", status: "abandoned", match_type: "league" },
      ],
      minMatches: 2,
      qualifierCount: 2,
      drawConfirmed: true,
      leagueFixturesConfirmed: true,
      leagueStageCompleted: true,
    });
    expect(report.teams.every((row) => row.completed_matches === 0)).toBe(true);
    expect(report.ok).toBe(false);
  });

  it("passes when every required league result is finalized", () => {
    const report = evaluateLeagueEligibility({
      teams,
      matches: [
        { team_a_id: "a", team_b_id: "b", status: "completed", match_type: "league" },
        { team_a_id: "b", team_b_id: "c", status: "completed", match_type: "league" },
        { team_a_id: "c", team_b_id: "a", status: "completed", match_type: "league" },
      ],
      minMatches: 2,
      qualifierCount: 2,
      drawConfirmed: true,
      leagueFixturesConfirmed: true,
      leagueStageCompleted: true,
    });
    expect(report.ok).toBe(true);
    expect(report.pending_league_matches).toBe(0);
  });
});
