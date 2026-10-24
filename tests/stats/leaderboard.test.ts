import { describe, expect, it } from "vitest";
import { buildTournamentLeaderboard } from "../../src/lib/stats/leaderboard";
import type {
  StatsBallRow,
  StatsInningsRow,
  StatsMatchRow,
  StatsPlayerRow,
  StatsTeamRow,
} from "../../src/lib/stats/queries";

function team(id: string, name: string): StatsTeamRow {
  return {
    id,
    tournament_id: "t1",
    name,
    short_name: name.slice(0, 3),
    approved: true,
    registration_status: "approved",
  };
}

function player(id: string, teamId: string, name: string): StatsPlayerRow {
  return { id, team_id: teamId, name, photo_url: null };
}

function match(): StatsMatchRow {
  return {
    id: "m1",
    tournament_id: "t1",
    team_a_id: "ta",
    team_b_id: "tb",
    status: "completed",
    match_type: "league",
    winner_team_id: "ta",
    overs_per_innings: 20,
    result_text: null,
    scheduled_at: "2026-03-18T10:00:00.000Z",
  };
}

function innings(): StatsInningsRow {
  return {
    id: "i1",
    match_id: "m1",
    batting_team_id: "ta",
    bowling_team_id: "tb",
    innings_number: 1,
    total_runs: 60,
    wickets: 1,
    legal_balls: 30,
    status: "completed",
  };
}

function ball(
  overrides: Partial<StatsBallRow> & Pick<StatsBallRow, "id" | "sequence_no">,
): StatsBallRow {
  return {
    innings_id: "i1",
    striker_id: "bat1",
    non_striker_id: "bat2",
    bowler_id: "bowl1",
    batsman_runs: 0,
    extra_runs: 0,
    total_runs: 0,
    is_legal_delivery: true,
    extra_type: null,
    is_wicket: false,
    wicket_type: null,
    dismissed_player_id: null,
    fielder_id: null,
    assist_fielder_id: null,
    is_caught_behind: false,
    ...overrides,
  };
}

describe("buildTournamentLeaderboard", () => {
  it("aggregates batting, bowling, fielding, and MVP", () => {
    const balls: StatsBallRow[] = [
      ball({ id: "b1", sequence_no: 1, batsman_runs: 4, total_runs: 4 }),
      ball({ id: "b2", sequence_no: 2, batsman_runs: 6, total_runs: 6 }),
      ball({
        id: "b3",
        sequence_no: 3,
        is_wicket: true,
        wicket_type: "caught",
        dismissed_player_id: "bat1",
        fielder_id: "field1",
      }),
    ];

    const board = buildTournamentLeaderboard({
      teams: [team("ta", "Alpha"), team("tb", "Bravo")],
      matches: [match()],
      innings: [innings()],
      balls,
      players: [
        player("bat1", "ta", "Batter One"),
        player("bat2", "ta", "Batter Two"),
        player("bowl1", "tb", "Bowler One"),
        player("field1", "tb", "Fielder One"),
      ],
    });

    const batter = board.batting.find((r) => r.player_id === "bat1");
    expect(batter?.runs).toBe(10);
    expect(batter?.fours).toBe(1);
    expect(batter?.sixes).toBe(1);
    expect(batter?.not_outs).toBe(0);
    expect(batter?.matches[0]?.opponent).toBe("Bravo");

    const bowler = board.bowling.find((r) => r.player_id === "bowl1");
    expect(bowler?.wickets).toBe(1);
    expect(bowler?.matches[0]?.figures).toBe("0.3-0-10-1");

    const fielder = board.fielding.find((r) => r.player_id === "field1");
    expect(fielder?.catches).toBe(1);
    expect(fielder?.dismissals).toBe(1);

    const mvpBatter = board.mvp.find((r) => r.player_id === "bat1");
    expect(mvpBatter?.batting).toBeGreaterThan(0);
    const mvpBowler = board.mvp.find((r) => r.player_id === "bowl1");
    expect(mvpBowler?.bowling).toBeGreaterThan(0);
    const mvpField = board.mvp.find((r) => r.player_id === "field1");
    expect(mvpField?.fielding).toBeGreaterThan(0);
  });

  it("treats caught-and-bowled and caught-behind separately", () => {
    const balls: StatsBallRow[] = [
      ball({
        id: "c1",
        sequence_no: 1,
        is_wicket: true,
        wicket_type: "caught",
        dismissed_player_id: "bat1",
        fielder_id: "bowl1",
        bowler_id: "bowl1",
      }),
      ball({
        id: "c2",
        sequence_no: 2,
        is_wicket: true,
        wicket_type: "caught",
        dismissed_player_id: "bat2",
        fielder_id: "field1",
        is_caught_behind: true,
      }),
    ];

    const board = buildTournamentLeaderboard({
      teams: [team("ta", "Alpha"), team("tb", "Bravo")],
      matches: [match()],
      innings: [innings()],
      balls,
      players: [
        player("bat1", "ta", "Batter One"),
        player("bat2", "ta", "Batter Two"),
        player("bowl1", "tb", "Bowler One"),
        player("field1", "tb", "Keeper"),
      ],
    });

    expect(board.fielding.find((r) => r.player_id === "bowl1")?.caught_and_bowled).toBe(1);
    expect(board.fielding.find((r) => r.player_id === "field1")?.caught_behind).toBe(1);
    expect(board.fielding.find((r) => r.player_id === "field1")?.catches).toBe(0);
  });
});
