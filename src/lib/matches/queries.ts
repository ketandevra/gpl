import "server-only";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { MatchStatus } from "@/lib/types/database";
import { oversFromLegalBalls as formatOvers } from "@/lib/scoring/format";
import type {
  InningsBrief,
  MatchRow,
  MatchView,
  TeamBrief,
} from "@/lib/matches/types";

export type {
  InningsBrief,
  MatchRow,
  MatchView,
  TeamBrief,
} from "@/lib/matches/types";
export {
  LIVE_MATCH_STATUSES,
  formatMatchWhen,
  matchStatusLabel,
} from "@/lib/matches/labels";

export function oversFromLegalBalls(legalBalls: number): string {
  return formatOvers(legalBalls);
}

async function loadTeamMap(ids: string[]): Promise<Map<string, TeamBrief>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const teams = await withRetry(() =>
    adminRest<TeamBrief[]>("teams", {
      query: `?id=in.(${unique.join(",")})&select=id,name,short_name`,
    }),
  );
  return new Map(teams.map((t) => [t.id, t]));
}

function toMatchView(
  match: MatchRow,
  teamMap: Map<string, TeamBrief>,
): MatchView {
  return {
    ...match,
    team_a: teamMap.get(match.team_a_id) ?? null,
    team_b: teamMap.get(match.team_b_id) ?? null,
    toss_winner: match.toss_winner_id
      ? teamMap.get(match.toss_winner_id) ?? null
      : null,
    winner: match.winner_team_id
      ? teamMap.get(match.winner_team_id) ?? null
      : null,
  };
}

export async function listMatches(options?: {
  status?: MatchStatus | MatchStatus[];
}): Promise<MatchView[]> {
  if (!isSupabaseAdminConfigured()) return [];

  let query = "?select=*&order=scheduled_at.asc.nullslast";
  if (options?.status) {
    const statuses = Array.isArray(options.status)
      ? options.status
      : [options.status];
    query = `?status=in.(${statuses.join(",")})&select=*&order=scheduled_at.asc.nullslast`;
  }

  const matches = await withRetry(() =>
    adminRest<MatchRow[]>("matches", { query }),
  );
  if (!matches.length) return [];

  const teamMap = await loadTeamMap(
    matches.flatMap((m) => [
      m.team_a_id,
      m.team_b_id,
      m.toss_winner_id ?? "",
      m.winner_team_id ?? "",
    ]),
  );

  return matches.map((m) => toMatchView(m, teamMap));
}

export async function getMatchById(id: string): Promise<MatchView | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<MatchRow[]>("matches", {
      query: `?id=eq.${encodeURIComponent(id)}&select=*`,
    }),
  );
  const match = rows[0];
  if (!match) return null;
  const teamMap = await loadTeamMap([
    match.team_a_id,
    match.team_b_id,
    match.toss_winner_id ?? "",
    match.winner_team_id ?? "",
  ]);
  return toMatchView(match, teamMap);
}

export async function listInningsForMatch(
  matchId: string,
): Promise<InningsBrief[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<InningsBrief[]>("innings", {
      query: `?match_id=eq.${encodeURIComponent(matchId)}&select=*&order=innings_number.asc`,
    }),
  );
}

export async function listMatchScorerIds(matchId: string): Promise<string[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const rows = await withRetry(() =>
    adminRest<Array<{ user_id: string }>>("match_scorers", {
      query: `?match_id=eq.${encodeURIComponent(matchId)}&select=user_id`,
    }),
  );
  return rows.map((r) => r.user_id);
}

export async function listScorerUsers(): Promise<
  Array<{ id: string; name: string; mobile_number: string; role: string }>
> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest("users", {
      query:
        "?role=in.(scorer,admin)&is_active=eq.true&select=id,name,mobile_number,role&order=name.asc",
    }),
  );
}
