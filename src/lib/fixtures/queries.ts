import "server-only";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { MatchRow } from "@/lib/matches/types";
import type {
  DrawStatus,
  LeagueMethod,
  TournamentFormat,
  TournamentStage,
} from "@/lib/fixtures/types";
import type { TournamentStatus } from "@/lib/types/database";

export type FixtureTournament = {
  id: string;
  name: string;
  short_name: string | null;
  status: TournamentStatus;
  is_active: boolean;
  format: TournamentFormat;
  min_league_matches: number;
  knockout_qualifiers: number;
  league_method: LeagueMethod;
  draw_status: DrawStatus;
  draw_confirmed_at: string | null;
  draw_confirmed_by: string | null;
  participant_team_ids: string[];
  league_fixtures_confirmed: boolean;
  league_fixtures_confirmed_at: string | null;
  league_stage_completed: boolean;
  league_stage_completed_at: string | null;
  current_stage: TournamentStage;
  league_batch_id: string | null;
  knockout_batch_id: string | null;
  champion_team_id: string | null;
  points_win: number;
  points_tie: number;
  points_nr: number;
  points_loss: number;
};

export type DrawRow = {
  id: string;
  tournament_id: string;
  team_id: string;
  draw_position: number;
  drawn_at: string;
  drawn_by: string | null;
};

export type KnockoutSlotRow = {
  id: string;
  tournament_id: string;
  slot_key: string;
  team_id: string | null;
  source: "seed" | "bye" | "winner";
  source_match_key: string | null;
};

export type FixtureTeam = {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  approved: boolean;
  registration_status: string;
};

export type InningsForFixtures = {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  innings_number: number;
  total_runs: number;
  wickets: number;
  legal_balls: number;
  status: string;
};

const TOURNAMENT_SELECT =
  "id,name,short_name,status,is_active,format,min_league_matches,knockout_qualifiers,league_method,draw_status,draw_confirmed_at,draw_confirmed_by,participant_team_ids,league_fixtures_confirmed,league_fixtures_confirmed_at,league_stage_completed,league_stage_completed_at,current_stage,league_batch_id,knockout_batch_id,champion_team_id,points_win,points_tie,points_nr,points_loss";

export async function getFixtureTournament(
  tournamentId: string,
): Promise<FixtureTournament | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<FixtureTournament[]>("tournaments", {
      query: `?id=eq.${encodeURIComponent(tournamentId)}&select=${TOURNAMENT_SELECT}&limit=1`,
    }),
  );
  return rows[0] ?? null;
}

export async function listFixtureTournaments(): Promise<
  Pick<FixtureTournament, "id" | "name" | "is_active" | "current_stage" | "draw_status">[]
> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<
      Pick<
        FixtureTournament,
        "id" | "name" | "is_active" | "current_stage" | "draw_status"
      >[]
    >("tournaments", {
      query:
        "?select=id,name,is_active,current_stage,draw_status&order=is_active.desc,created_at.desc",
    }),
  );
}

export async function listApprovedTournamentTeams(
  tournamentId: string,
): Promise<FixtureTeam[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<FixtureTeam[]>("teams", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&registration_status=eq.approved&approved=eq.true&select=id,tournament_id,name,short_name,logo_url,approved,registration_status&order=name.asc`,
    }),
  );
}

export async function listTournamentDraw(
  tournamentId: string,
): Promise<DrawRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<DrawRow[]>("tournament_draw", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=id,tournament_id,team_id,draw_position,drawn_at,drawn_by&order=draw_position.asc`,
    }),
  );
}

export async function listTournamentMatches(
  tournamentId: string,
): Promise<MatchRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<MatchRow[]>("matches", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=*&order=round_number.asc.nullslast,match_number.asc.nullslast,scheduled_at.asc.nullslast`,
    }),
  );
}

export async function listMatchInnings(
  matchIds: string[],
): Promise<InningsForFixtures[]> {
  if (!isSupabaseAdminConfigured() || !matchIds.length) return [];
  return withRetry(() =>
    adminRest<InningsForFixtures[]>("innings", {
      query: `?match_id=in.(${matchIds.join(",")})&select=id,match_id,batting_team_id,bowling_team_id,innings_number,total_runs,wickets,legal_balls,status`,
    }),
  );
}

export async function listKnockoutSlots(
  tournamentId: string,
): Promise<KnockoutSlotRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<KnockoutSlotRow[]>("tournament_knockout_slots", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=id,tournament_id,slot_key,team_id,source,source_match_key`,
    }),
  );
}
