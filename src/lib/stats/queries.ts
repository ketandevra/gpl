import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type {
  ExtraType,
  InningsStatus,
  MatchStatus,
  MatchType,
  WicketType,
} from "@/lib/types/database";
import type { PointsConfig } from "@/lib/stats/points";

export type TournamentStatsMeta = {
  id: string;
  name: string;
  points_win: number;
  points_tie: number;
  points_nr: number;
  points_loss: number;
};

export type StatsTeamRow = {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  approved: boolean;
  registration_status: string;
};

export type StatsMatchRow = {
  id: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  status: MatchStatus;
  match_type: MatchType;
  winner_team_id: string | null;
  overs_per_innings: number;
  result_text: string | null;
};

export type StatsInningsRow = {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  innings_number: number;
  total_runs: number;
  wickets: number;
  legal_balls: number;
  status: InningsStatus;
};

export type StatsBallRow = {
  id: string;
  innings_id: string;
  sequence_no: number;
  striker_id: string | null;
  bowler_id: string | null;
  batsman_runs: number;
  extra_runs: number;
  total_runs: number;
  is_legal_delivery: boolean;
  extra_type: ExtraType | null;
  is_wicket: boolean;
  wicket_type: WicketType | null;
  dismissed_player_id: string | null;
};

export type StatsPlayerRow = {
  id: string;
  team_id: string;
  name: string;
};

export type TournamentStatsBundle = {
  tournament: TournamentStatsMeta;
  teams: StatsTeamRow[];
  matches: StatsMatchRow[];
  innings: StatsInningsRow[];
  balls: StatsBallRow[];
  players: StatsPlayerRow[];
};

export async function getActiveTournamentForStats(): Promise<TournamentStatsMeta | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<TournamentStatsMeta[]>("tournaments", {
      query:
        "?is_active=eq.true&select=id,name,points_win,points_tie,points_nr,points_loss&limit=1",
    }),
  );
  return rows[0] ?? null;
}

export async function listApprovedTeamsForTournament(
  tournamentId: string,
): Promise<StatsTeamRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<StatsTeamRow[]>("teams", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&approved=eq.true&registration_status=eq.approved&select=id,tournament_id,name,short_name,approved,registration_status&order=name.asc`,
    }),
  );
}

export async function listMatchesForTournament(
  tournamentId: string,
): Promise<StatsMatchRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<StatsMatchRow[]>("matches", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=id,tournament_id,team_a_id,team_b_id,status,match_type,winner_team_id,overs_per_innings,result_text&order=scheduled_at.asc.nullslast`,
    }),
  );
}

export async function listInningsForMatches(
  matchIds: string[],
): Promise<StatsInningsRow[]> {
  if (!isSupabaseAdminConfigured() || !matchIds.length) return [];
  return withRetry(() =>
    adminRest<StatsInningsRow[]>("innings", {
      query: `?match_id=in.(${matchIds.join(",")})&select=id,match_id,batting_team_id,bowling_team_id,innings_number,total_runs,wickets,legal_balls,status&order=innings_number.asc`,
    }),
  );
}

export async function listBallsForInnings(
  inningsIds: string[],
): Promise<StatsBallRow[]> {
  if (!isSupabaseAdminConfigured() || !inningsIds.length) return [];
  return withRetry(() =>
    adminRest<StatsBallRow[]>("balls", {
      query: `?innings_id=in.(${inningsIds.join(",")})&select=id,innings_id,sequence_no,striker_id,bowler_id,batsman_runs,extra_runs,total_runs,is_legal_delivery,extra_type,is_wicket,wicket_type,dismissed_player_id&order=sequence_no.asc`,
    }),
  );
}

export async function listPlayersByIds(
  playerIds: string[],
): Promise<StatsPlayerRow[]> {
  const unique = [...new Set(playerIds.filter(Boolean))];
  if (!isSupabaseAdminConfigured() || !unique.length) return [];
  const players = await withRetry(() =>
    adminRest<
      Array<{ id: string; name: string; locked_team_id: string | null }>
    >("players", {
      query: `?id=in.(${unique.join(",")})&select=id,name,locked_team_id`,
    }),
  );
  return players
    .filter((p) => p.locked_team_id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      team_id: p.locked_team_id as string,
    }));
}

export async function listPlayersForTeams(
  teamIds: string[],
): Promise<StatsPlayerRow[]> {
  if (!isSupabaseAdminConfigured() || !teamIds.length) return [];
  const memberships = await withRetry(() =>
    adminRest<Array<{ team_id: string; player_id: string }>>("team_players", {
      query: `?team_id=in.(${teamIds.join(",")})&select=team_id,player_id`,
    }),
  );
  if (!memberships.length) return [];
  const players = await withRetry(() =>
    adminRest<Array<{ id: string; name: string }>>("players", {
      query: `?id=in.(${[...new Set(memberships.map((m) => m.player_id))].join(",")})&select=id,name`,
    }),
  );
  const nameMap = new Map(players.map((p) => [p.id, p.name]));
  return memberships.map((m) => ({
    id: m.player_id,
    team_id: m.team_id,
    name: nameMap.get(m.player_id) ?? "Player",
  }));
}

/** Load everything needed for points + leaderboards for the active tournament. */
export async function loadTournamentStatsBundle(): Promise<TournamentStatsBundle | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const tournament = await getActiveTournamentForStats();
  if (!tournament) return null;

  const [teams, matches] = await Promise.all([
    listApprovedTeamsForTournament(tournament.id),
    listMatchesForTournament(tournament.id),
  ]);

  const matchIds = matches.map((m) => m.id);
  const innings = await listInningsForMatches(matchIds);
  const inningsIds = innings.map((i) => i.id);
  const [balls, players] = await Promise.all([
    listBallsForInnings(inningsIds),
    listPlayersForTeams(teams.map((t) => t.id)),
  ]);

  return { tournament, teams, matches, innings, balls, players };
}

export function tournamentPointsConfig(
  tournament: Pick<
    TournamentStatsMeta,
    "points_win" | "points_tie" | "points_nr" | "points_loss"
  >,
): PointsConfig {
  return {
    points_win: tournament.points_win,
    points_tie: tournament.points_tie,
    points_nr: tournament.points_nr,
    points_loss: tournament.points_loss,
  };
}
