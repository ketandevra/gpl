import { StatsHub } from "@/components/stats/StatsHub";
import { getFixtureWorkspace } from "@/lib/fixtures/service";
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

  let knockout = null;
  if (bundle?.tournament.id) {
    try {
      const workspace = await getFixtureWorkspace(bundle.tournament.id);
      knockout = {
        preview: workspace.knockout_preview,
        matches: workspace.knockout_matches,
        teams: workspace.participants.map((team) => ({
          id: team.id,
          name: team.name,
        })),
        championName: workspace.champion?.name ?? null,
        progress: {
          draw_status: workspace.tournament.draw_status,
          league_fixtures_confirmed: workspace.tournament.league_fixtures_confirmed,
          league_stage_completed: workspace.tournament.league_stage_completed,
          champion_team_id: workspace.tournament.champion_team_id,
          knockout_batch_id: workspace.tournament.knockout_batch_id,
        },
      };
    } catch {
      knockout = null;
    }
  }

  return (
    <StatsHub
      tournamentName={bundle?.tournament.name ?? null}
      points={points}
      batting={board.batting}
      bowling={board.bowling}
      fielding={board.fielding}
      mvp={board.mvp}
      knockout={knockout}
    />
  );
}
