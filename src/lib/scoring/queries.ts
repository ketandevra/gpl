import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { ExtraType, InningsStatus, WicketType } from "@/lib/types/database";
import type { InningsState } from "@/lib/scoring/types";
import { oversFromLegalBalls } from "@/lib/scoring/format";
import {
  getMatchById,
  listInningsForMatch,
  listMatchScorerIds,
  type MatchView,
} from "@/lib/matches/queries";
import { listPlayersByTeam, type TeamPlayerView } from "@/lib/teams/queries";
import type { SessionUser } from "@/lib/auth/permissions";
import { isAdmin } from "@/lib/auth/permissions";

function toPublicRosterPlayer(player: TeamPlayerView): TeamPlayerView {
  return { ...player, mobile_number: null, user_id: null };
}

export type InningsRow = {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  innings_number: number;
  total_runs: number;
  wickets: number;
  legal_balls: number;
  target_runs: number | null;
  status: InningsStatus;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BallRow = {
  id: string;
  innings_id: string;
  sequence_no: number;
  over_number: number;
  ball_in_over: number;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
  batsman_runs: number;
  extra_runs: number;
  total_runs: number;
  is_legal_delivery: boolean;
  extra_type: ExtraType | null;
  is_wicket: boolean;
  wicket_type: WicketType | null;
  dismissed_player_id: string | null;
  free_hit_next: boolean;
  commentary: string | null;
  created_at: string;
};

export async function canScoreMatch(
  user: SessionUser,
  matchId: string,
): Promise<boolean> {
  if (!user.is_active) return false;
  if (isAdmin(user)) return true;
  if (user.role !== "scorer") return false;
  const scorers = await listMatchScorerIds(matchId);
  return scorers.includes(user.id);
}

export async function getInningsById(
  inningsId: string,
): Promise<InningsRow | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<InningsRow[]>("innings", {
      query: `?id=eq.${encodeURIComponent(inningsId)}&select=*`,
    }),
  );
  return rows[0] ?? null;
}

export async function getCurrentInnings(
  matchId: string,
): Promise<InningsRow | null> {
  const all = await listInningsForMatch(matchId);
  const active = all.find((i) => i.status === "in_progress");
  if (active) return getInningsById(active.id);
  const last = all[all.length - 1];
  return last ? getInningsById(last.id) : null;
}

export async function listBallsForInnings(
  inningsId: string,
): Promise<BallRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<BallRow[]>("balls", {
      query: `?innings_id=eq.${encodeURIComponent(inningsId)}&select=*&order=sequence_no.asc`,
    }),
  );
}

export async function getLastBall(
  inningsId: string,
): Promise<BallRow | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<BallRow[]>("balls", {
      query: `?innings_id=eq.${encodeURIComponent(inningsId)}&select=*&order=sequence_no.desc&limit=1`,
    }),
  );
  return rows[0] ?? null;
}

export function deriveFreeHit(balls: BallRow[]): boolean {
  let freeHit = false;
  for (const ball of balls) {
    if (ball.extra_type === "no_ball") freeHit = true;
    else if (ball.is_legal_delivery) freeHit = false;
  }
  return freeHit;
}

export function freeHitFromLastBall(last: BallRow | null): boolean {
  // Prefer full history when available; this helper is a fallback.
  return Boolean(last?.free_hit_next);
}

export function toInningsState(
  innings: InningsRow,
  match: MatchView,
  freeHit: boolean,
  ballCount: number,
): InningsState {
  return {
    total_runs: innings.total_runs,
    wickets: innings.wickets,
    legal_balls: innings.legal_balls,
    target_runs: innings.target_runs,
    status: innings.status,
    striker_id: innings.striker_id,
    non_striker_id: innings.non_striker_id,
    bowler_id: innings.bowler_id,
    overs_per_innings: match.overs_per_innings,
    free_hit: freeHit,
    ball_count: ballCount,
    max_wickets: 10,
  };
}

export type ScoreboardPayload = {
  match: MatchView;
  innings: InningsRow[];
  current: InningsRow | null;
  balls: BallRow[];
  recentBalls: BallRow[];
  free_hit: boolean;
  batting_players: TeamPlayerView[];
  bowling_players: TeamPlayerView[];
  overs: string;
  can_score: boolean;
};

export async function getScoreboard(
  matchId: string,
  user: SessionUser | null,
): Promise<ScoreboardPayload | null> {
  const match = await getMatchById(matchId);
  if (!match) return null;

  const inningsList = await listInningsForMatch(matchId);
  const fullInnings = await Promise.all(
    inningsList.map((i) => getInningsById(i.id)),
  );
  const innings = fullInnings.filter(Boolean) as InningsRow[];
  const current =
    innings.find((i) => i.status === "in_progress") ??
    innings[innings.length - 1] ??
    null;

  const balls = current ? await listBallsForInnings(current.id) : [];
  const free_hit = deriveFreeHit(balls);

  let batting_players: Awaited<ReturnType<typeof listPlayersByTeam>> = [];
  let bowling_players: Awaited<ReturnType<typeof listPlayersByTeam>> = [];
  if (current) {
    [batting_players, bowling_players] = await Promise.all([
      listPlayersByTeam(current.batting_team_id),
      listPlayersByTeam(current.bowling_team_id),
    ]);
  } else {
    [batting_players, bowling_players] = await Promise.all([
      listPlayersByTeam(match.team_a_id),
      listPlayersByTeam(match.team_b_id),
    ]);
  }

  const can_score = user ? await canScoreMatch(user, matchId) : false;

  return {
    match,
    innings,
    current,
    balls,
    recentBalls: balls.slice(-12).reverse(),
    free_hit,
    batting_players: batting_players.map(toPublicRosterPlayer),
    bowling_players: bowling_players.map(toPublicRosterPlayer),
    overs: current ? oversFromLegalBalls(current.legal_balls) : "0.0",
    can_score,
  };
}
