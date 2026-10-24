import { runsAgainstBowler } from "@/lib/scoring/event";
import { oversFromLegalBalls } from "@/lib/scoring/format";

type NamedPlayer = { id: string; name: string };

type InningsLike = {
  id: string;
  innings_number: number;
  batting_team_id: string;
  bowling_team_id: string;
  total_runs: number;
  wickets: number;
  legal_balls: number;
  target_runs: number | null;
  status: string;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
};

type BallLike = {
  over_number: number;
  ball_in_over: number;
  striker_id: string | null;
  bowler_id: string | null;
  batsman_runs: number;
  extra_runs: number;
  total_runs: number;
  is_legal_delivery: boolean;
  extra_type: string | null;
  is_wicket: boolean;
  wicket_type: string | null;
  dismissed_player_id: string | null;
};

export type BatterLine = {
  player_id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  how_out: string | null;
  on_strike: boolean;
  non_strike: boolean;
};

export type BowlerLine = {
  player_id: string;
  name: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
};

export type ExtrasLine = {
  total: number;
  wide: number;
  no_ball: number;
  bye: number;
  leg_bye: number;
  penalty: number;
};

export type FallLine = {
  wicket: number;
  score: number;
  name: string;
  overs: string;
};

export type RecentOver = {
  over: number;
  balls: string[];
};

export type InningsCard = {
  innings_id: string;
  innings_number: number;
  batting_team_id: string;
  bowling_team_id: string;
  batting_name: string;
  bowling_name: string;
  batting_short: string;
  bowling_short: string;
  total_runs: number;
  wickets: number;
  overs: string;
  target_runs: number | null;
  status: string;
  batters: BatterLine[];
  yet_to_bat: string[];
  bowlers: BowlerLine[];
  extras: ExtrasLine;
  fall: FallLine[];
  this_over: string[];
  recent_overs: RecentOver[];
  current_bowler_id: string | null;
  partnership_runs: number;
  partnership_balls: number;
};

function playerName(
  players: NamedPlayer[],
  id: string | null,
  fallback = "Player",
) {
  if (!id) return fallback;
  return players.find((p) => p.id === id)?.name ?? fallback;
}

function howOut(type: string | null): string {
  switch (type) {
    case "bowled":
      return "b";
    case "caught":
      return "c";
    case "lbw":
      return "lbw";
    case "run_out":
      return "run out";
    case "stumped":
      return "st";
    case "hit_wicket":
      return "hit wicket";
    case "retired_hurt":
      return "retired hurt";
    case "retired_out":
      return "retired out";
    default:
      return "out";
  }
}

function chip(ball: BallLike): string {
  if (ball.is_wicket) return "W";
  if (ball.extra_type === "wide") {
    return ball.extra_runs > 1 ? `Wd${ball.extra_runs}` : "Wd";
  }
  if (ball.extra_type === "no_ball") {
    return ball.batsman_runs ? `Nb${ball.batsman_runs}` : "Nb";
  }
  if (ball.extra_type === "bye") return `B${ball.extra_runs}`;
  if (ball.extra_type === "leg_bye") return `Lb${ball.extra_runs}`;
  if (ball.batsman_runs === 0) return "·";
  return String(ball.batsman_runs);
}

function isBowlerWicket(ball: BallLike) {
  if (!ball.is_wicket) return false;
  return (
    ball.wicket_type !== "run_out" &&
    ball.wicket_type !== "retired_hurt" &&
    ball.wicket_type !== "retired_out"
  );
}

export function buildInningsCard(params: {
  innings: InningsLike;
  balls: BallLike[];
  batting: NamedPlayer[];
  bowling: NamedPlayer[];
  battingName: string;
  bowlingName: string;
  battingShort?: string;
  bowlingShort?: string;
}): InningsCard {
  const {
    innings,
    balls,
    batting,
    bowling,
    battingName,
    bowlingName,
    battingShort,
    bowlingShort,
  } = params;
  const batters = new Map<string, BatterLine>();
  const bowlers = new Map<string, BowlerLine & { overRuns: number[] }>();
  const extras: ExtrasLine = {
    total: 0,
    wide: 0,
    no_ball: 0,
    bye: 0,
    leg_bye: 0,
    penalty: 0,
  };
  const fall: FallLine[] = [];
  let running = 0;
  let wickets = 0;

  function batter(id: string | null) {
    if (!id) return null;
    const existing = batters.get(id);
    if (existing) return existing;
    const row: BatterLine = {
      player_id: id,
      name: playerName(batting, id),
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      how_out: null,
      on_strike: false,
      non_strike: false,
    };
    batters.set(id, row);
    return row;
  }

  function bowler(id: string | null) {
    if (!id) return null;
    const existing = bowlers.get(id);
    if (existing) return existing;
    const row = {
      player_id: id,
      name: playerName(bowling, id),
      balls: 0,
      runs: 0,
      wickets: 0,
      maidens: 0,
      overRuns: [] as number[],
    };
    bowlers.set(id, row);
    return row;
  }

  for (const ball of balls) {
    running += ball.total_runs;
    const strike = batter(ball.striker_id);
    const bowl = bowler(ball.bowler_id);
    const faced = ball.is_legal_delivery || ball.extra_type === "no_ball";
    if (strike && faced) strike.balls += 1;
    if (strike && ball.batsman_runs) {
      strike.runs += ball.batsman_runs;
      if (ball.batsman_runs === 4) strike.fours += 1;
      if (ball.batsman_runs === 6) strike.sixes += 1;
    }
    if (bowl) {
      if (ball.is_legal_delivery) bowl.balls += 1;
      bowl.runs += runsAgainstBowler(ball);
      if (isBowlerWicket(ball)) bowl.wickets += 1;
    }
    if (ball.extra_runs && ball.extra_type) {
      extras.total += ball.extra_runs;
      if (ball.extra_type === "wide") extras.wide += ball.extra_runs;
      if (ball.extra_type === "no_ball") {
        extras.no_ball += 1;
        const fielding = Math.max(0, ball.extra_runs - 1);
        if (ball.batsman_runs === 0 && fielding > 0) {
          extras.bye += fielding;
        }
      }
      if (ball.extra_type === "bye") extras.bye += ball.extra_runs;
      if (ball.extra_type === "leg_bye") extras.leg_bye += ball.extra_runs;
      if (ball.extra_type === "penalty") extras.penalty += ball.extra_runs;
    }
    if (ball.is_wicket) {
      wickets += 1;
      const outId = ball.dismissed_player_id ?? ball.striker_id;
      const out = batter(outId);
      if (out) {
        out.out = true;
        out.how_out = howOut(ball.wicket_type);
      }
      fall.push({
        wicket: wickets,
        score: running,
        name: playerName(batting, outId),
        overs: `${ball.over_number}.${ball.is_legal_delivery ? ball.ball_in_over : Math.max(0, ball.ball_in_over - 1)}`,
      });
    }
  }

  const currentOver =
    balls.length > 0 ? balls[balls.length - 1]!.over_number : 0;
  const thisOver = balls
    .filter((b) => b.over_number === currentOver)
    .map(chip);

  const overMap = new Map<number, string[]>();
  for (const ball of balls) {
    const list = overMap.get(ball.over_number) ?? [];
    list.push(chip(ball));
    overMap.set(ball.over_number, list);
  }
  const recent_overs = [...overMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-3)
    .map(([over, overBalls]) => ({ over, balls: overBalls }));

  let lastWicketAt = -1;
  balls.forEach((ball, index) => {
    if (ball.is_wicket) lastWicketAt = index;
  });
  const partnershipBalls = balls.slice(lastWicketAt + 1);
  const partnership_runs = partnershipBalls.reduce(
    (sum, ball) => sum + ball.total_runs,
    0,
  );
  const partnership_balls = partnershipBalls.filter(
    (ball) => ball.is_legal_delivery || ball.extra_type === "no_ball",
  ).length;

  const maidenKey = new Map<string, { legal: number; runs: number }>();
  for (const ball of balls) {
    if (!ball.bowler_id) continue;
    const key = `${ball.bowler_id}:${ball.over_number}`;
    const slot = maidenKey.get(key) ?? { legal: 0, runs: 0 };
    if (ball.is_legal_delivery) slot.legal += 1;
    slot.runs += runsAgainstBowler(ball);
    maidenKey.set(key, slot);
  }
  for (const [key, slot] of maidenKey) {
    if (slot.legal === 6 && slot.runs === 0) {
      const bowlerId = key.split(":")[0]!;
      const row = bowlers.get(bowlerId);
      if (row) row.maidens += 1;
    }
  }

  const strikerId = innings.striker_id;
  const nonStrikerId = innings.non_striker_id;
  if (strikerId) {
    const row = batter(strikerId);
    if (row) row.on_strike = innings.status === "in_progress";
  }
  if (nonStrikerId) {
    const row = batter(nonStrikerId);
    if (row) row.non_strike = innings.status === "in_progress";
  }

  const order = [...batters.values()].sort((a, b) => {
    if (a.on_strike !== b.on_strike) return a.on_strike ? -1 : 1;
    if (a.non_strike !== b.non_strike) return a.non_strike ? -1 : 1;
    return 0;
  });

  const seen = new Set(order.map((b) => b.player_id));
  const yet_to_bat = batting
    .filter((p) => !seen.has(p.id))
    .map((p) => p.name);

  const lastBall = balls[balls.length - 1] ?? null;
  const current_bowler_id =
    innings.bowler_id ?? lastBall?.bowler_id ?? null;

  return {
    innings_id: innings.id,
    innings_number: innings.innings_number,
    batting_team_id: innings.batting_team_id,
    bowling_team_id: innings.bowling_team_id,
    batting_name: battingName,
    bowling_name: bowlingName,
    batting_short: battingShort ?? battingName,
    bowling_short: bowlingShort ?? bowlingName,
    total_runs: innings.total_runs,
    wickets: innings.wickets,
    overs: oversFromLegalBalls(innings.legal_balls),
    target_runs: innings.target_runs,
    status: innings.status,
    batters: order,
    yet_to_bat,
    bowlers: [...bowlers.values()].map(({ overRuns: _o, ...row }) => row),
    extras,
    fall,
    this_over: thisOver,
    recent_overs,
    current_bowler_id,
    partnership_runs,
    partnership_balls,
  };
}

export function extrasLabel(extras: ExtrasLine): string {
  const parts: string[] = [];
  if (extras.wide) parts.push(`${extras.wide} wd`);
  if (extras.no_ball) parts.push(`${extras.no_ball} nb`);
  if (extras.bye) parts.push(`${extras.bye} b`);
  if (extras.leg_bye) parts.push(`${extras.leg_bye} lb`);
  if (extras.penalty) parts.push(`${extras.penalty} pen`);
  return parts.length ? `${extras.total} (${parts.join(", ")})` : String(extras.total);
}
