import { oversFromLegalBallsDecimal } from "@/lib/stats/points";
import type {
  StatsBallRow,
  StatsPlayerRow,
  StatsTeamRow,
} from "@/lib/stats/queries";
import type { WicketType } from "@/lib/types/database";

/** Wickets credited to the bowler (not run outs / retirements). */
const BOWLER_WICKET_TYPES: ReadonlySet<WicketType> = new Set([
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hit_wicket",
]);

export type BattingLeader = {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  team_short_name: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  strike_rate: number;
};

export type BowlingLeader = {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  team_short_name: string;
  wickets: number;
  runs_conceded: number;
  legal_balls: number;
  overs: number;
  economy: number;
};

function ballsFacedForBatsman(ball: StatsBallRow): boolean {
  // Wides do not count as balls faced; no-balls and legal deliveries do.
  if (ball.extra_type === "wide") return false;
  return ball.is_legal_delivery || ball.extra_type === "no_ball";
}

function bowlerRunsConceded(ball: StatsBallRow): number {
  // Byes / leg byes / penalties are not charged to the bowler.
  if (
    ball.extra_type === "bye" ||
    ball.extra_type === "leg_bye" ||
    ball.extra_type === "penalty"
  ) {
    return ball.batsman_runs;
  }
  return ball.total_runs;
}

function teamLookup(teams: StatsTeamRow[]) {
  return new Map(teams.map((t) => [t.id, t]));
}

function playerLookup(players: StatsPlayerRow[]) {
  return new Map(players.map((p) => [p.id, p]));
}

export function aggregateBattingLeaders(input: {
  balls: StatsBallRow[];
  players: StatsPlayerRow[];
  teams: StatsTeamRow[];
  limit?: number;
}): BattingLeader[] {
  const limit = input.limit ?? 10;
  const players = playerLookup(input.players);
  const teams = teamLookup(input.teams);

  type Acc = {
    player_id: string;
    runs: number;
    balls_faced: number;
    fours: number;
    sixes: number;
  };
  const byPlayer = new Map<string, Acc>();

  for (const ball of input.balls) {
    if (!ball.striker_id) continue;
    const player = players.get(ball.striker_id);
    if (!player) continue;

    let acc = byPlayer.get(ball.striker_id);
    if (!acc) {
      acc = {
        player_id: ball.striker_id,
        runs: 0,
        balls_faced: 0,
        fours: 0,
        sixes: 0,
      };
      byPlayer.set(ball.striker_id, acc);
    }

    acc.runs += ball.batsman_runs;
    if (ballsFacedForBatsman(ball)) acc.balls_faced += 1;
    if (ball.batsman_runs === 4) acc.fours += 1;
    if (ball.batsman_runs === 6) acc.sixes += 1;
  }

  const leaders: BattingLeader[] = [];
  for (const acc of byPlayer.values()) {
    if (acc.runs <= 0 && acc.balls_faced <= 0) continue;
    const player = players.get(acc.player_id);
    if (!player) continue;
    const team = teams.get(player.team_id);
    const strike_rate =
      acc.balls_faced > 0
        ? Number(((acc.runs / acc.balls_faced) * 100).toFixed(2))
        : 0;
    leaders.push({
      player_id: acc.player_id,
      player_name: player.name,
      team_id: player.team_id,
      team_name: team?.name ?? "Team",
      team_short_name: team?.short_name ?? "—",
      runs: acc.runs,
      balls_faced: acc.balls_faced,
      fours: acc.fours,
      sixes: acc.sixes,
      strike_rate,
    });
  }

  leaders.sort((a, b) => {
    if (b.runs !== a.runs) return b.runs - a.runs;
    if (b.strike_rate !== a.strike_rate) return b.strike_rate - a.strike_rate;
    return a.player_name.localeCompare(b.player_name);
  });

  return leaders.slice(0, limit);
}

export function aggregateBowlingLeaders(input: {
  balls: StatsBallRow[];
  players: StatsPlayerRow[];
  teams: StatsTeamRow[];
  limit?: number;
}): BowlingLeader[] {
  const limit = input.limit ?? 10;
  const players = playerLookup(input.players);
  const teams = teamLookup(input.teams);

  type Acc = {
    player_id: string;
    wickets: number;
    runs_conceded: number;
    legal_balls: number;
  };
  const byPlayer = new Map<string, Acc>();

  for (const ball of input.balls) {
    if (!ball.bowler_id) continue;
    const player = players.get(ball.bowler_id);
    if (!player) continue;

    let acc = byPlayer.get(ball.bowler_id);
    if (!acc) {
      acc = {
        player_id: ball.bowler_id,
        wickets: 0,
        runs_conceded: 0,
        legal_balls: 0,
      };
      byPlayer.set(ball.bowler_id, acc);
    }

    acc.runs_conceded += bowlerRunsConceded(ball);
    if (ball.is_legal_delivery) acc.legal_balls += 1;
    if (
      ball.is_wicket &&
      ball.wicket_type &&
      BOWLER_WICKET_TYPES.has(ball.wicket_type)
    ) {
      acc.wickets += 1;
    }
  }

  const leaders: BowlingLeader[] = [];
  for (const acc of byPlayer.values()) {
    if (acc.wickets <= 0 && acc.legal_balls <= 0) continue;
    const player = players.get(acc.player_id);
    if (!player) continue;
    const team = teams.get(player.team_id);
    const overs = oversFromLegalBallsDecimal(acc.legal_balls);
    const economy =
      overs > 0 ? Number((acc.runs_conceded / overs).toFixed(2)) : 0;
    leaders.push({
      player_id: acc.player_id,
      player_name: player.name,
      team_id: player.team_id,
      team_name: team?.name ?? "Team",
      team_short_name: team?.short_name ?? "—",
      wickets: acc.wickets,
      runs_conceded: acc.runs_conceded,
      legal_balls: acc.legal_balls,
      overs: Number(overs.toFixed(1)),
      economy,
    });
  }

  leaders.sort((a, b) => {
    if (b.wickets !== a.wickets) return b.wickets - a.wickets;
    if (a.economy !== b.economy) return a.economy - b.economy;
    return a.player_name.localeCompare(b.player_name);
  });

  return leaders.slice(0, limit);
}

export type PlayerMatchStats = {
  batting: {
    runs: number;
    balls_faced: number;
    fours: number;
    sixes: number;
    strike_rate: number;
  };
  bowling: {
    wickets: number;
    runs_conceded: number;
    legal_balls: number;
    overs: number;
    economy: number;
  };
  has_batting: boolean;
  has_bowling: boolean;
};

/** Aggregate batting + bowling for one player from tournament ball events. */
export function computePlayerMatchStats(
  playerId: string,
  balls: StatsBallRow[],
): PlayerMatchStats {
  let runs = 0;
  let balls_faced = 0;
  let fours = 0;
  let sixes = 0;
  let wickets = 0;
  let runs_conceded = 0;
  let legal_balls = 0;

  for (const ball of balls) {
    if (ball.striker_id === playerId) {
      runs += ball.batsman_runs;
      if (ballsFacedForBatsman(ball)) balls_faced += 1;
      if (ball.batsman_runs === 4) fours += 1;
      if (ball.batsman_runs === 6) sixes += 1;
    }
    if (ball.bowler_id === playerId) {
      runs_conceded += bowlerRunsConceded(ball);
      if (ball.is_legal_delivery) legal_balls += 1;
      if (
        ball.is_wicket &&
        ball.wicket_type &&
        BOWLER_WICKET_TYPES.has(ball.wicket_type)
      ) {
        wickets += 1;
      }
    }
  }

  const strike_rate =
    balls_faced > 0 ? Number(((runs / balls_faced) * 100).toFixed(2)) : 0;
  const overs = oversFromLegalBallsDecimal(legal_balls);
  const economy =
    overs > 0 ? Number((runs_conceded / overs).toFixed(2)) : 0;

  return {
    batting: { runs, balls_faced, fours, sixes, strike_rate },
    bowling: {
      wickets,
      runs_conceded,
      legal_balls,
      overs: Number(overs.toFixed(1)),
      economy,
    },
    has_batting: runs > 0 || balls_faced > 0,
    has_bowling: wickets > 0 || legal_balls > 0,
  };
}
