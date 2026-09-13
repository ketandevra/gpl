import {
  buildPointsTable,
  formatNrr,
  type PointsRow,
} from "@/lib/stats/points";
import {
  aggregateBattingLeaders,
  aggregateBowlingLeaders,
  computePlayerMatchStats,
  type BattingLeader,
  type BowlingLeader,
  type PlayerMatchStats,
} from "@/lib/stats/leaders";
import {
  loadTournamentStatsBundle,
  tournamentPointsConfig,
} from "@/lib/stats/queries";

export type { PointsRow, BattingLeader, BowlingLeader, PlayerMatchStats };
export { formatNrr };

export async function getPointsTable(): Promise<PointsRow[]> {
  const bundle = await loadTournamentStatsBundle();
  if (!bundle) return [];
  return buildPointsTable({
    teams: bundle.teams.map((t) => ({
      id: t.id,
      name: t.name,
      short_name: t.short_name,
    })),
    matches: bundle.matches,
    innings: bundle.innings,
    config: tournamentPointsConfig(bundle.tournament),
  });
}

export async function getBattingLeaders(limit = 10): Promise<BattingLeader[]> {
  const bundle = await loadTournamentStatsBundle();
  if (!bundle) return [];
  return aggregateBattingLeaders({
    balls: bundle.balls,
    players: bundle.players,
    teams: bundle.teams,
    limit,
  });
}

export async function getBowlingLeaders(limit = 10): Promise<BowlingLeader[]> {
  const bundle = await loadTournamentStatsBundle();
  if (!bundle) return [];
  return aggregateBowlingLeaders({
    balls: bundle.balls,
    players: bundle.players,
    teams: bundle.teams,
    limit,
  });
}

export async function getPlayerStats(
  playerId: string,
): Promise<PlayerMatchStats | null> {
  const bundle = await loadTournamentStatsBundle();
  if (!bundle) return null;
  return computePlayerMatchStats(playerId, bundle.balls);
}
