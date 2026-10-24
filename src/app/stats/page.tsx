import { StatsHub } from "@/components/stats/StatsHub";
import { buildTournamentLeaderboard } from "@/lib/stats/leaderboard";
import { buildPointsTable } from "@/lib/stats/points";
import {
  loadTournamentStatsBundle,
  tournamentPointsConfig,
} from "@/lib/stats/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Stats" };
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="page max-w-3xl">
        <h1 className="page-title hidden md:block">Statistics</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load the points table and leaderboards.
        </p>
      </div>
    );
  }

  const bundle = await loadTournamentStatsBundle();
  const points = bundle
    ? buildPointsTable({
        teams: bundle.teams.map((t) => ({
          id: t.id,
          name: t.name,
          short_name: t.short_name,
        })),
        matches: bundle.matches,
        innings: bundle.innings,
        config: tournamentPointsConfig(bundle.tournament),
      })
    : [];
  const board = bundle
    ? buildTournamentLeaderboard(bundle)
    : { batting: [], bowling: [], fielding: [], mvp: [] };

  return (
    <StatsHub
      tournamentName={bundle?.tournament.name ?? null}
      points={points}
      batting={board.batting}
      bowling={board.bowling}
      fielding={board.fielding}
      mvp={board.mvp}
    />
  );
}
