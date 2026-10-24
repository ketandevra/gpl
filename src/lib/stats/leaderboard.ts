import { runsAgainstBowler } from "@/lib/scoring/event";
import { oversFromLegalBalls } from "@/lib/scoring/format";
import { oversFromLegalBallsDecimal } from "@/lib/stats/points";
import type {
  StatsBallRow,
  StatsInningsRow,
  StatsMatchRow,
  StatsPlayerRow,
  StatsTeamRow,
} from "@/lib/stats/queries";
import type { WicketType } from "@/lib/types/database";

const BOWLER_WICKET_TYPES: ReadonlySet<WicketType> = new Set([
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hit_wicket",
]);

const RUNS_PER_MVP_POINT = 10;

export type BattingMatchLine = {
  match_id: string;
  date_label: string;
  opponent: string;
  innings_number: number;
  runs: number;
  balls: number;
  not_out: boolean;
};

export type BowlingMatchLine = {
  match_id: string;
  date_label: string;
  opponent: string;
  innings_number: number;
  legal_balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  figures: string;
};

export type BattingLeaderRow = {
  player_id: string;
  player_name: string;
  photo_url: string | null;
  team_id: string;
  team_name: string;
  innings: number;
  runs: number;
  average: number | null;
  strike_rate: number;
  highest_score: number;
  highest_not_out: boolean;
  not_outs: number;
  sixes: number;
  fours: number;
  fifties: number;
  hundreds: number;
  balls_faced: number;
  matches: BattingMatchLine[];
};

export type BowlingLeaderRow = {
  player_id: string;
  player_name: string;
  photo_url: string | null;
  team_id: string;
  team_name: string;
  innings: number;
  wickets: number;
  economy: number;
  average: number | null;
  maidens: number;
  highest_wickets: number;
  strike_rate: number | null;
  dots: number;
  runs_conceded: number;
  legal_balls: number;
  matches: BowlingMatchLine[];
};

export type FieldingLeaderRow = {
  player_id: string;
  player_name: string;
  photo_url: string | null;
  team_id: string;
  team_name: string;
  matches_played: number;
  dismissals: number;
  catches: number;
  run_outs: number;
  caught_and_bowled: number;
  caught_behind: number;
  stumpings: number;
  assist_run_outs: number;
};

export type MvpLeaderRow = {
  player_id: string;
  player_name: string;
  photo_url: string | null;
  team_id: string;
  team_name: string;
  batting: number;
  bowling: number;
  fielding: number;
  total: number;
};

export type TournamentLeaderboard = {
  batting: BattingLeaderRow[];
  bowling: BowlingLeaderRow[];
  fielding: FieldingLeaderRow[];
  mvp: MvpLeaderRow[];
};

function ballsFacedForBatsman(ball: StatsBallRow): boolean {
  if (ball.extra_type === "wide") return false;
  return ball.is_legal_delivery || ball.extra_type === "no_ball";
}

function bowlerRunsConceded(ball: StatsBallRow): number {
  return runsAgainstBowler(ball);
}

function isDotBall(ball: StatsBallRow): boolean {
  return ball.is_legal_delivery && ball.total_runs === 0;
}

function formatMatchDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function opponentName(
  match: StatsMatchRow,
  teamId: string,
  teams: Map<string, StatsTeamRow>,
): string {
  const otherId = match.team_a_id === teamId ? match.team_b_id : match.team_a_id;
  return teams.get(otherId)?.name ?? "Opponent";
}

function battingOrder(balls: StatsBallRow[]): Map<string, number> {
  const order = new Map<string, number>();
  for (const ball of [...balls].sort((a, b) => a.sequence_no - b.sequence_no)) {
    for (const id of [ball.striker_id, ball.non_striker_id]) {
      if (id && !order.has(id)) order.set(id, order.size + 1);
    }
  }
  return order;
}

function positionStrength(position: number): number {
  if (position <= 4) return 1;
  if (position <= 8) return 0.8;
  return 0.6;
}

function baseRunsPerWicket(overs: number): number {
  if (overs <= 7) return 12;
  if (overs <= 12) return 14;
  if (overs <= 16) return 16;
  if (overs <= 20) return 18;
  if (overs <= 26) return 20;
  if (overs <= 40) return 22;
  if (overs <= 50) return 25;
  return 27;
}

function srBonusPct(overs: number): number {
  if (overs <= 20) return 0.08;
  if (overs <= 35) return 0.06;
  if (overs <= 50) return 0.04;
  return 0.02;
}

function maidensPerWicket(overs: number): number {
  if (overs <= 7) return 1;
  if (overs <= 26) return 2;
  if (overs <= 50) return 3;
  return 6;
}

function wicketMvpPoints(overs: number, battingPosition: number): number {
  return (baseRunsPerWicket(overs) * positionStrength(battingPosition)) / RUNS_PER_MVP_POINT;
}

function extraWicketBonus(wickets: number): number {
  if (wickets >= 10) return 1.5;
  if (wickets >= 5) return 1;
  if (wickets >= 3) return 0.5;
  return 0;
}

function countMaidens(balls: StatsBallRow[], bowlerId: string): number {
  const overs = new Map<number, StatsBallRow[]>();
  let overIndex = -1;
  let ballsInOver = 0;
  for (const ball of balls.filter((b) => b.bowler_id === bowlerId)) {
    if (ball.is_legal_delivery) {
      if (ballsInOver === 0) overIndex += 1;
      const list = overs.get(overIndex) ?? [];
      list.push(ball);
      overs.set(overIndex, list);
      ballsInOver += 1;
      if (ballsInOver === 6) ballsInOver = 0;
    } else if (overIndex >= 0) {
      const list = overs.get(overIndex) ?? [];
      list.push(ball);
      overs.set(overIndex, list);
    }
  }

  let maidens = 0;
  for (const overBalls of overs.values()) {
    const legalCount = overBalls.filter((b) => b.is_legal_delivery).length;
    if (legalCount < 6) continue;
    const conceded = overBalls.reduce((sum, b) => sum + bowlerRunsConceded(b), 0);
    if (conceded === 0) maidens += 1;
  }
  return maidens;
}

function battingInningsRuns(balls: StatsBallRow[], playerId: string) {
  let runs = 0;
  let faced = 0;
  let fours = 0;
  let sixes = 0;
  let appeared = false;
  let dismissed = false;
  for (const ball of balls) {
    if (ball.striker_id === playerId || ball.non_striker_id === playerId) {
      appeared = true;
    }
    if (ball.striker_id === playerId) {
      runs += ball.batsman_runs;
      if (ballsFacedForBatsman(ball)) faced += 1;
      if (ball.batsman_runs === 4) fours += 1;
      if (ball.batsman_runs === 6) sixes += 1;
    }
    if (
      ball.is_wicket &&
      ball.dismissed_player_id === playerId &&
      ball.wicket_type &&
      ball.wicket_type !== "retired_hurt"
    ) {
      dismissed = true;
    }
  }
  return { runs, faced, fours, sixes, appeared, not_out: appeared && !dismissed };
}

function bowlingInningsFigures(balls: StatsBallRow[], playerId: string) {
  let runs = 0;
  let legal = 0;
  let wickets = 0;
  let dots = 0;
  let bowled = false;
  for (const ball of balls) {
    if (ball.bowler_id !== playerId) continue;
    bowled = true;
    runs += bowlerRunsConceded(ball);
    if (ball.is_legal_delivery) legal += 1;
    if (isDotBall(ball)) dots += 1;
    if (
      ball.is_wicket &&
      ball.wicket_type &&
      BOWLER_WICKET_TYPES.has(ball.wicket_type)
    ) {
      wickets += 1;
    }
  }
  return { runs, legal, wickets, dots, bowled, maidens: countMaidens(balls, playerId) };
}

function inningsStrikeRate(innings: StatsInningsRow, balls: StatsBallRow[]): number {
  const faced = balls.filter((b) => ballsFacedForBatsman(b)).length;
  if (faced <= 0) return 0;
  return (innings.total_runs / faced) * 100;
}

function battingMvp(
  runs: number,
  ballsFaced: number,
  teamSr: number,
  overs: number,
): number {
  if (runs <= 0 && ballsFaced <= 0) return 0;
  const base = runs / RUNS_PER_MVP_POINT;
  const playerSr = ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0;
  let srBonus = 0;
  if (teamSr > 0 && playerSr > teamSr) {
    srBonus = (playerSr / teamSr) * srBonusPct(overs) * base;
  }
  return base + srBonus;
}

function bowlingMvp(input: {
  balls: StatsBallRow[];
  playerId: string;
  order: Map<string, number>;
  teamSr: number;
  overs: number;
  figures: ReturnType<typeof bowlingInningsFigures>;
}): number {
  const { balls, playerId, order, teamSr, overs, figures } = input;
  if (!figures.bowled) return 0;

  let wicketBase = 0;
  for (const ball of balls) {
    if (
      ball.bowler_id !== playerId ||
      !ball.is_wicket ||
      !ball.wicket_type ||
      !BOWLER_WICKET_TYPES.has(ball.wicket_type)
    ) {
      continue;
    }
    const pos = ball.dismissed_player_id
      ? (order.get(ball.dismissed_player_id) ?? 11)
      : 11;
    wicketBase += wicketMvpPoints(overs, pos);
  }

  const bonus = extraWicketBonus(figures.wickets);
  let srBonus = 0;
  if (figures.legal > 0 && figures.runs > 0 && teamSr > 0) {
    const playerSr = (figures.runs / figures.legal) * 100;
    if (playerSr < teamSr) {
      srBonus = (teamSr / playerSr) * (teamSr - playerSr) * srBonusPct(overs);
    }
  }

  const maidenUnit = wicketMvpPoints(overs, 1) / maidensPerWicket(overs);
  const maidenBonus = figures.maidens * maidenUnit;
  return wicketBase + bonus + srBonus + maidenBonus;
}

function fieldingMvp(input: {
  balls: StatsBallRow[];
  playerId: string;
  order: Map<string, number>;
  overs: number;
}): number {
  let points = 0;
  for (const ball of input.balls) {
    if (!ball.is_wicket || !ball.wicket_type) continue;
    const pos = ball.dismissed_player_id
      ? (input.order.get(ball.dismissed_player_id) ?? 11)
      : 11;
    const wicketPts = wicketMvpPoints(input.overs, pos);

    if (ball.wicket_type === "caught" || ball.wicket_type === "stumped") {
      if (ball.fielder_id === input.playerId) points += wicketPts * 0.2;
    } else if (ball.wicket_type === "run_out") {
      if (ball.assist_fielder_id) {
        if (
          ball.fielder_id === input.playerId ||
          ball.assist_fielder_id === input.playerId
        ) {
          points += wicketPts * 0.2;
        }
      } else if (ball.fielder_id === input.playerId) {
        points += wicketPts;
      }
    }
  }
  return points;
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

export function buildTournamentLeaderboard(input: {
  teams: StatsTeamRow[];
  matches: StatsMatchRow[];
  innings: StatsInningsRow[];
  balls: StatsBallRow[];
  players: StatsPlayerRow[];
}): TournamentLeaderboard {
  const teams = new Map(input.teams.map((t) => [t.id, t]));
  const players = new Map(input.players.map((p) => [p.id, p]));
  const matches = new Map(input.matches.map((m) => [m.id, m]));
  const ballsByInnings = new Map<string, StatsBallRow[]>();
  for (const ball of input.balls) {
    const list = ballsByInnings.get(ball.innings_id) ?? [];
    list.push(ball);
    ballsByInnings.set(ball.innings_id, list);
  }

  type BatAcc = {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    innings: number;
    not_outs: number;
    fifties: number;
    hundreds: number;
    highest: number;
    highest_not_out: boolean;
    matches: BattingMatchLine[];
  };
  type BowlAcc = {
    innings: number;
    wickets: number;
    runs: number;
    legal: number;
    maidens: number;
    dots: number;
    highest_wickets: number;
    matches: BowlingMatchLine[];
  };
  type FieldAcc = {
    matchIds: Set<string>;
    catches: number;
    run_outs: number;
    caught_and_bowled: number;
    caught_behind: number;
    stumpings: number;
    assist_run_outs: number;
  };
  type MvpAcc = { batting: number; bowling: number; fielding: number };

  const batting = new Map<string, BatAcc>();
  const bowling = new Map<string, BowlAcc>();
  const fielding = new Map<string, FieldAcc>();
  const mvp = new Map<string, MvpAcc>();

  const ensureBat = (id: string): BatAcc => {
    let acc = batting.get(id);
    if (!acc) {
      acc = {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        innings: 0,
        not_outs: 0,
        fifties: 0,
        hundreds: 0,
        highest: 0,
        highest_not_out: false,
        matches: [],
      };
      batting.set(id, acc);
    }
    return acc;
  };
  const ensureBowl = (id: string): BowlAcc => {
    let acc = bowling.get(id);
    if (!acc) {
      acc = {
        innings: 0,
        wickets: 0,
        runs: 0,
        legal: 0,
        maidens: 0,
        dots: 0,
        highest_wickets: 0,
        matches: [],
      };
      bowling.set(id, acc);
    }
    return acc;
  };
  const ensureField = (id: string): FieldAcc => {
    let acc = fielding.get(id);
    if (!acc) {
      acc = {
        matchIds: new Set(),
        catches: 0,
        run_outs: 0,
        caught_and_bowled: 0,
        caught_behind: 0,
        stumpings: 0,
        assist_run_outs: 0,
      };
      fielding.set(id, acc);
    }
    return acc;
  };
  const ensureMvp = (id: string): MvpAcc => {
    let acc = mvp.get(id);
    if (!acc) {
      acc = { batting: 0, bowling: 0, fielding: 0 };
      mvp.set(id, acc);
    }
    return acc;
  };

  const scoredInnings = input.innings.filter(
    (inn) => inn.status === "completed" || inn.legal_balls > 0 || inn.total_runs > 0,
  );

  for (const inn of scoredInnings) {
    const match = matches.get(inn.match_id);
    if (!match) continue;
    const balls = (ballsByInnings.get(inn.id) ?? []).sort(
      (a, b) => a.sequence_no - b.sequence_no,
    );
    if (!balls.length) continue;

    const overs =
      inn.innings_number >= 3 ? 1 : Math.max(1, match.overs_per_innings);
    const order = battingOrder(balls);
    const teamSr = inningsStrikeRate(inn, balls);
    const batters = new Set<string>();
    const bowlers = new Set<string>();

    for (const ball of balls) {
      if (ball.striker_id) batters.add(ball.striker_id);
      if (ball.non_striker_id) batters.add(ball.non_striker_id);
      if (ball.bowler_id) bowlers.add(ball.bowler_id);
    }

    for (const playerId of batters) {
      const line = battingInningsRuns(balls, playerId);
      if (!line.appeared) continue;
      const acc = ensureBat(playerId);
      acc.innings += 1;
      acc.runs += line.runs;
      acc.balls += line.faced;
      acc.fours += line.fours;
      acc.sixes += line.sixes;
      if (line.not_out) acc.not_outs += 1;
      if (line.runs >= 100) acc.hundreds += 1;
      else if (line.runs >= 50) acc.fifties += 1;
      if (
        line.runs > acc.highest ||
        (line.runs === acc.highest && line.not_out)
      ) {
        acc.highest = line.runs;
        acc.highest_not_out = line.not_out;
      }
      const player = players.get(playerId);
      acc.matches.push({
        match_id: match.id,
        date_label: formatMatchDate(match.scheduled_at),
        opponent: opponentName(match, player?.team_id ?? inn.batting_team_id, teams),
        innings_number: inn.innings_number,
        runs: line.runs,
        balls: line.faced,
        not_out: line.not_out,
      });
      ensureMvp(playerId).batting += battingMvp(
        line.runs,
        line.faced,
        teamSr,
        overs,
      );
    }

    for (const playerId of bowlers) {
      const figs = bowlingInningsFigures(balls, playerId);
      if (!figs.bowled) continue;
      const acc = ensureBowl(playerId);
      acc.innings += 1;
      acc.wickets += figs.wickets;
      acc.runs += figs.runs;
      acc.legal += figs.legal;
      acc.maidens += figs.maidens;
      acc.dots += figs.dots;
      if (figs.wickets > acc.highest_wickets) acc.highest_wickets = figs.wickets;
      const player = players.get(playerId);
      acc.matches.push({
        match_id: match.id,
        date_label: formatMatchDate(match.scheduled_at),
        opponent: opponentName(match, player?.team_id ?? inn.bowling_team_id, teams),
        innings_number: inn.innings_number,
        legal_balls: figs.legal,
        maidens: figs.maidens,
        runs: figs.runs,
        wickets: figs.wickets,
        figures: `${oversFromLegalBalls(figs.legal)}-${figs.maidens}-${figs.runs}-${figs.wickets}`,
      });
      ensureMvp(playerId).bowling += bowlingMvp({
        balls,
        playerId,
        order,
        teamSr,
        overs,
        figures: figs,
      });
    }

    for (const ball of balls) {
      if (!ball.is_wicket || !ball.wicket_type) continue;
      if (ball.wicket_type === "caught" && ball.fielder_id) {
        const acc = ensureField(ball.fielder_id);
        acc.matchIds.add(match.id);
        if (ball.fielder_id === ball.bowler_id) acc.caught_and_bowled += 1;
        else if (ball.is_caught_behind) acc.caught_behind += 1;
        else acc.catches += 1;
      } else if (ball.wicket_type === "stumped" && ball.fielder_id) {
        const acc = ensureField(ball.fielder_id);
        acc.matchIds.add(match.id);
        acc.stumpings += 1;
      } else if (ball.wicket_type === "run_out") {
        if (ball.assist_fielder_id) {
          if (ball.fielder_id) {
            const acc = ensureField(ball.fielder_id);
            acc.matchIds.add(match.id);
            acc.assist_run_outs += 1;
          }
          const assist = ensureField(ball.assist_fielder_id);
          assist.matchIds.add(match.id);
          assist.assist_run_outs += 1;
        } else if (ball.fielder_id) {
          const acc = ensureField(ball.fielder_id);
          acc.matchIds.add(match.id);
          acc.run_outs += 1;
        }
      }
    }

    const fielders = new Set<string>();
    for (const ball of balls) {
      if (ball.fielder_id) fielders.add(ball.fielder_id);
      if (ball.assist_fielder_id) fielders.add(ball.assist_fielder_id);
    }
    for (const playerId of fielders) {
      ensureMvp(playerId).fielding += fieldingMvp({
        balls,
        playerId,
        order,
        overs,
      });
    }
  }

  const toIdentity = (playerId: string) => {
    const player = players.get(playerId);
    const team = player ? teams.get(player.team_id) : undefined;
    return {
      player_id: playerId,
      player_name: player?.name ?? "Player",
      photo_url: player?.photo_url ?? null,
      team_id: player?.team_id ?? "",
      team_name: team?.name ?? "Team",
    };
  };

  const battingRows: BattingLeaderRow[] = [...batting.entries()].map(
    ([id, acc]) => {
      const outs = acc.innings - acc.not_outs;
      return {
        ...toIdentity(id),
        innings: acc.innings,
        runs: acc.runs,
        average: outs > 0 ? round2(acc.runs / outs) : null,
        strike_rate: acc.balls > 0 ? round2((acc.runs / acc.balls) * 100) : 0,
        highest_score: acc.highest,
        highest_not_out: acc.highest_not_out,
        not_outs: acc.not_outs,
        sixes: acc.sixes,
        fours: acc.fours,
        fifties: acc.fifties,
        hundreds: acc.hundreds,
        balls_faced: acc.balls,
        matches: acc.matches.sort((a, b) => b.innings_number - a.innings_number),
      };
    },
  );
  battingRows.sort((a, b) => {
    if (b.runs !== a.runs) return b.runs - a.runs;
    if (b.strike_rate !== a.strike_rate) return b.strike_rate - a.strike_rate;
    return a.player_name.localeCompare(b.player_name);
  });

  const bowlingRows: BowlingLeaderRow[] = [...bowling.entries()].map(
    ([id, acc]) => {
      const overs = oversFromLegalBallsDecimal(acc.legal);
      return {
        ...toIdentity(id),
        innings: acc.innings,
        wickets: acc.wickets,
        economy: overs > 0 ? round2(acc.runs / overs) : 0,
        average: acc.wickets > 0 ? round2(acc.runs / acc.wickets) : null,
        maidens: acc.maidens,
        highest_wickets: acc.highest_wickets,
        strike_rate: acc.wickets > 0 ? round2(acc.legal / acc.wickets) : null,
        dots: acc.dots,
        runs_conceded: acc.runs,
        legal_balls: acc.legal,
        matches: acc.matches.sort((a, b) => b.innings_number - a.innings_number),
      };
    },
  );
  bowlingRows.sort((a, b) => {
    if (b.wickets !== a.wickets) return b.wickets - a.wickets;
    if (a.economy !== b.economy) return a.economy - b.economy;
    return a.player_name.localeCompare(b.player_name);
  });

  const fieldingRows: FieldingLeaderRow[] = [...fielding.entries()].map(
    ([id, acc]) => {
      const dismissals =
        acc.catches +
        acc.run_outs +
        acc.caught_and_bowled +
        acc.caught_behind +
        acc.stumpings +
        acc.assist_run_outs;
      return {
        ...toIdentity(id),
        matches_played: acc.matchIds.size,
        dismissals,
        catches: acc.catches,
        run_outs: acc.run_outs,
        caught_and_bowled: acc.caught_and_bowled,
        caught_behind: acc.caught_behind,
        stumpings: acc.stumpings,
        assist_run_outs: acc.assist_run_outs,
      };
    },
  );
  fieldingRows.sort((a, b) => {
    if (b.dismissals !== a.dismissals) return b.dismissals - a.dismissals;
    return a.player_name.localeCompare(b.player_name);
  });

  const mvpRows: MvpLeaderRow[] = [...mvp.entries()]
    .map(([id, acc]) => ({
      ...toIdentity(id),
      batting: round4(acc.batting),
      bowling: round4(acc.bowling),
      fielding: round4(acc.fielding),
      total: round4(acc.batting + acc.bowling + acc.fielding),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a.player_name.localeCompare(b.player_name));

  return {
    batting: battingRows,
    bowling: bowlingRows,
    fielding: fieldingRows,
    mvp: mvpRows,
  };
}

export function formatBattingScore(line: BattingMatchLine): string {
  return `${line.runs}(${line.balls})${line.not_out ? "*" : ""}`;
}

export function formatAverage(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}
