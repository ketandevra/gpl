import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { MatchStatus } from "@/lib/types/database";
import {
  getMatchById,
  listMatches,
  LIVE_MATCH_STATUSES,
  type MatchView,
} from "@/lib/matches/queries";

export { LIVE_MATCH_STATUSES };

export type LiveMatchSummary = {
  id: string;
  status: MatchStatus;
  venue: string | null;
  scheduled_at: string | null;
  team_a_name: string;
  team_b_name: string;
  team_a_short: string;
  team_b_short: string;
};

function toLiveSummary(m: MatchView): LiveMatchSummary {
  return {
    id: m.id,
    status: m.status,
    venue: m.venue,
    scheduled_at: m.scheduled_at,
    team_a_name: m.team_a?.name ?? "Team A",
    team_b_name: m.team_b?.name ?? "Team B",
    team_a_short: m.team_a?.short_name ?? "A",
    team_b_short: m.team_b?.short_name ?? "B",
  };
}

export async function hasLiveMatches(): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) return false;
  try {
    const rows = await withRetry(() =>
      adminRest<Array<{ id: string }>>("matches", {
        query: `?status=in.(${LIVE_MATCH_STATUSES.join(",")})&select=id&limit=1`,
      }),
    );
    return rows.length > 0;
  } catch (err) {
    // During static generation / edge cases, fail closed (no live badge).
    if (
      !(
        err instanceof Error &&
        /Dynamic server usage|DYNAMIC_SERVER_USAGE/i.test(err.message)
      )
    ) {
      console.error("[live] presence check error:", err);
    }
    return false;
  }
}

export async function getLiveMatches(): Promise<LiveMatchSummary[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const matches = await listMatches({ status: LIVE_MATCH_STATUSES });
    return matches.map(toLiveSummary);
  } catch (err) {
    console.error("[live] unexpected error:", err);
    return [];
  }
}

export async function getLiveMatchSummary(
  id: string,
): Promise<LiveMatchSummary | null> {
  const match = await getMatchById(id);
  if (!match || !LIVE_MATCH_STATUSES.includes(match.status)) return null;
  return toLiveSummary(match);
}
