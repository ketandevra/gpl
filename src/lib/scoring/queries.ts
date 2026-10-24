import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { ExtraType, InningsStatus, WicketType } from "@/lib/types/database";
import type { InningsState } from "@/lib/scoring/types";
import { oversFromLegalBalls } from "@/lib/scoring/format";
import { buildInningsCard, type InningsCard } from "@/lib/scoring/scorecard";
import {
  isSuperOverInnings,
  superOverMaxWickets,
  superOverOvers,
} from "@/lib/scoring/sides";
import {
  getMatchById,
  listInningsForMatch,
  listMatchScorerIds,
  type MatchView,
} from "@/lib/matches/queries";
import { listPlayersByTeam, type TeamPlayerView } from "@/lib/teams/queries";
import type { SessionUser } from "@/lib/auth/permissions";
import { isAdmin } from "@/lib/auth/permissions";

function toPublicRosterPlayer(
  player: TeamPlayerView,
  captainUserId?: string | null,
): TeamPlayerView & { is_captain: boolean } {
  return {
    ...player,
    mobile_number: null,
    user_id: null,
    is_captain: Boolean(captainUserId && player.user_id === captainUserId),
  };
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
  fielder_id: string | null;
  assist_fielder_id: string | null;
  is_caught_behind: boolean;
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
    overs_per_innings: isSuperOverInnings(innings.innings_number)
      ? superOverOvers()
      : match.overs_per_innings,
    free_hit: freeHit,
    ball_count: ballCount,
    max_wickets: isSuperOverInnings(innings.innings_number)
      ? superOverMaxWickets()
      : 10,
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
  team_a_players: TeamPlayerView[];
  team_b_players: TeamPlayerView[];
  overs: string;
  can_score: boolean;
  cards: InningsCard[];
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

  const ballsByInnings = await Promise.all(
    innings.map(async (row) => ({
      id: row.id,
      balls: await listBallsForInnings(row.id),
    })),
  );
  const currentBalls =
    ballsByInnings.find((row) => row.id === current?.id)?.balls ?? [];
  const free_hit = deriveFreeHit(currentBalls);

  const [teamAPlayers, teamBPlayers, teamMeta] = await Promise.all([
    listPlayersByTeam(match.team_a_id),
    listPlayersByTeam(match.team_b_id),
    withRetry(() =>
      adminRest<Array<{ id: string; manager_id: string | null }>>("teams", {
        query: `?id=in.(${match.team_a_id},${match.team_b_id})&select=id,manager_id`,
      }),
    ),
  ]);
  const captainByTeam = new Map(
    teamMeta.map((row) => [row.id, row.manager_id]),
  );
  const squad = (teamId: string) =>
    (teamId === match.team_a_id ? teamAPlayers : teamBPlayers).map((player) =>
      toPublicRosterPlayer(player, captainByTeam.get(teamId)),
    );
  const teamName = (teamId: string) =>
    teamId === match.team_a_id
      ? (match.team_a?.name ?? "Team A")
      : (match.team_b?.name ?? "Team B");
  const teamShort = (teamId: string) =>
    teamId === match.team_a_id
      ? (match.team_a?.short_name ?? "A")
      : (match.team_b?.short_name ?? "B");

  const team_a_players = squad(match.team_a_id);
  const team_b_players = squad(match.team_b_id);
  const batting_players = current
    ? squad(current.batting_team_id)
    : team_a_players;
  const bowling_players = current
    ? squad(current.bowling_team_id)
    : team_b_players;

  const cards = innings.map((row) => {
    const balls =
      ballsByInnings.find((entry) => entry.id === row.id)?.balls ?? [];
    return buildInningsCard({
      innings: row,
      balls,
      batting: squad(row.batting_team_id),
      bowling: squad(row.bowling_team_id),
      battingName: teamName(row.batting_team_id),
      bowlingName: teamName(row.bowling_team_id),
      battingShort: teamShort(row.batting_team_id),
      bowlingShort: teamShort(row.bowling_team_id),
    });
  });

  const can_score = user ? await canScoreMatch(user, matchId) : false;

  return {
    match,
    innings,
    current,
    balls: currentBalls,
    recentBalls: currentBalls.slice(-12).reverse(),
    free_hit,
    batting_players,
    bowling_players,
    team_a_players,
    team_b_players,
    overs: current ? oversFromLegalBalls(current.legal_balls) : "0.0",
    can_score,
    cards,
  };
}
