import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { getPlayerById } from "@/lib/teams/queries";
import {
  computePlayerMatchStats,
  type PlayerMatchStats,
} from "@/lib/stats/leaders";
import type { StatsBallRow } from "@/lib/stats/queries";

export type CareerEdition = {
  tournament_id: string;
  tournament_name: string;
  player_id: string;
  public_code: string;
  stats: PlayerMatchStats;
};

export type CareerStats = {
  career: PlayerMatchStats;
  editions: CareerEdition[];
};

function emptyStats(): PlayerMatchStats {
  return computePlayerMatchStats("__none__", []);
}

function mergeStats(parts: PlayerMatchStats[]): PlayerMatchStats {
  const career = emptyStats();
  for (const part of parts) {
    career.batting.runs += part.batting.runs;
    career.batting.balls_faced += part.batting.balls_faced;
    career.batting.fours += part.batting.fours;
    career.batting.sixes += part.batting.sixes;
    career.bowling.wickets += part.bowling.wickets;
    career.bowling.runs_conceded += part.bowling.runs_conceded;
    career.bowling.legal_balls += part.bowling.legal_balls;
    career.has_batting = career.has_batting || part.has_batting;
    career.has_bowling = career.has_bowling || part.has_bowling;
  }
  career.batting.strike_rate =
    career.batting.balls_faced > 0
      ? Number(
          ((career.batting.runs / career.batting.balls_faced) * 100).toFixed(2),
        )
      : 0;
  const overs = career.bowling.legal_balls / 6;
  career.bowling.overs = Number(overs.toFixed(1));
  career.bowling.economy =
    overs > 0
      ? Number((career.bowling.runs_conceded / overs).toFixed(2))
      : 0;
  return career;
}

async function listBallsForPlayers(ids: string[]): Promise<StatsBallRow[]> {
  if (!ids.length) return [];
  const base =
    "id,innings_id,sequence_no,striker_id,non_striker_id,bowler_id,batsman_runs,extra_runs,total_runs,is_legal_delivery,extra_type,is_wicket,wicket_type,dismissed_player_id";
  try {
    return await withRetry(() =>
      adminRest<StatsBallRow[]>("balls", {
        query: `?or=(striker_id.in.(${ids.join(",")}),bowler_id.in.(${ids.join(",")}))&select=${base},fielder_id,assist_fielder_id,is_caught_behind`,
      }),
    );
  } catch {
    const rows = await withRetry(() =>
      adminRest<StatsBallRow[]>("balls", {
        query: `?or=(striker_id.in.(${ids.join(",")}),bowler_id.in.(${ids.join(",")}))&select=${base}`,
      }),
    );
    return rows.map((row) => ({
      ...row,
      fielder_id: null,
      assist_fielder_id: null,
      is_caught_behind: false,
    }));
  }
}

export async function getCareerStats(
  playerId: string,
): Promise<CareerStats | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const player = await getPlayerById(playerId);
  if (!player) return null;

  const userId = player.user_id;
  const rows = userId
    ? await withRetry(() =>
        adminRest<
          Array<{
            id: string;
            tournament_id: string;
            public_code: string;
          }>
        >("players", {
          query: `?user_id=eq.${encodeURIComponent(userId)}&select=id,tournament_id,public_code&order=created_at.desc`,
        }),
      )
    : [
        {
          id: player.id,
          tournament_id: player.tournament_id,
          public_code: player.public_code,
        },
      ];
  if (!rows.length) return { career: emptyStats(), editions: [] };

  const tournamentIds = [...new Set(rows.map((row) => row.tournament_id))];
  const tournaments = await withRetry(() =>
    adminRest<Array<{ id: string; name: string }>>("tournaments", {
      query: `?id=in.(${tournamentIds.join(",")})&select=id,name`,
    }),
  );
  const tournamentName = new Map(tournaments.map((row) => [row.id, row.name]));
  const balls = await listBallsForPlayers(rows.map((row) => row.id));

  const editions = rows.map((row) => ({
    tournament_id: row.tournament_id,
    tournament_name: tournamentName.get(row.tournament_id) ?? "Tournament",
    player_id: row.id,
    public_code: row.public_code,
    stats: computePlayerMatchStats(row.id, balls),
  }));

  return {
    career: mergeStats(editions.map((row) => row.stats)),
    editions,
  };
}
