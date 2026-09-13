/**
 * Points table + Net Run Rate (NRR) for a tournament.
 *
 * NRR = (runs scored / overs faced) − (runs conceded / overs bowled)
 * Overs use legal balls as a decimal: legal_balls / 6.
 * All-out innings count as the full overs quota for NRR.
 */

export type PointsConfig = {
  points_win: number;
  points_tie: number;
  points_nr: number;
  points_loss: number;
};

export const DEFAULT_POINTS_CONFIG: PointsConfig = {
  points_win: 2,
  points_tie: 1,
  points_nr: 1,
  points_loss: 0,
};

export type TeamForPoints = {
  id: string;
  name: string;
  short_name: string;
};

export type MatchForPoints = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  status: string;
  match_type: string;
  winner_team_id: string | null;
  overs_per_innings: number;
};

export type InningsForPoints = {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  total_runs: number;
  wickets: number;
  legal_balls: number;
  status: string;
};

export type PointsRow = {
  team_id: string;
  team_name: string;
  short_name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  nr: number;
  points: number;
  nrr: number;
  runs_scored: number;
  overs_faced: number;
  runs_conceded: number;
  overs_bowled: number;
};

/** Decimal overs from legal balls (e.g. 75 → 12.5). */
export function oversFromLegalBallsDecimal(legalBalls: number): number {
  if (!Number.isFinite(legalBalls) || legalBalls <= 0) return 0;
  return legalBalls / 6;
}

export function resolvePointsConfig(
  tournament?: Partial<PointsConfig> | null,
): PointsConfig {
  return {
    points_win: tournament?.points_win ?? DEFAULT_POINTS_CONFIG.points_win,
    points_tie: tournament?.points_tie ?? DEFAULT_POINTS_CONFIG.points_tie,
    points_nr: tournament?.points_nr ?? DEFAULT_POINTS_CONFIG.points_nr,
    points_loss: tournament?.points_loss ?? DEFAULT_POINTS_CONFIG.points_loss,
  };
}

function emptyRow(team: TeamForPoints): PointsRow {
  return {
    team_id: team.id,
    team_name: team.name,
    short_name: team.short_name,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    nr: 0,
    points: 0,
    nrr: 0,
    runs_scored: 0,
    overs_faced: 0,
    runs_conceded: 0,
    overs_bowled: 0,
  };
}

/** Overs faced/bowled for NRR: all-out uses full quota. */
export function nrrOversForInnings(
  innings: Pick<InningsForPoints, "legal_balls" | "wickets">,
  oversPerInnings: number,
): number {
  const quotaBalls = Math.max(1, oversPerInnings) * 6;
  const balls =
    innings.wickets >= 10
      ? quotaBalls
      : Math.min(Math.max(0, innings.legal_balls), quotaBalls);
  return oversFromLegalBallsDecimal(balls);
}

function isStandingsMatch(match: MatchForPoints): boolean {
  // Friendlies never affect the table; knockout still can award points if completed.
  return match.match_type !== "friendly";
}

function isResultMatch(status: string): boolean {
  return status === "completed" || status === "abandoned";
}

/**
 * Build sorted points table (points desc, then NRR desc, then name).
 */
export function buildPointsTable(input: {
  teams: TeamForPoints[];
  matches: MatchForPoints[];
  innings: InningsForPoints[];
  config?: Partial<PointsConfig> | null;
}): PointsRow[] {
  const config = resolvePointsConfig(input.config);
  const rows = new Map<string, PointsRow>();

  for (const team of input.teams) {
    rows.set(team.id, emptyRow(team));
  }

  const inningsByMatch = new Map<string, InningsForPoints[]>();
  for (const inn of input.innings) {
    const list = inningsByMatch.get(inn.match_id) ?? [];
    list.push(inn);
    inningsByMatch.set(inn.match_id, list);
  }

  for (const match of input.matches) {
    if (!isStandingsMatch(match) || !isResultMatch(match.status)) continue;

    const teamA = rows.get(match.team_a_id);
    const teamB = rows.get(match.team_b_id);
    if (!teamA || !teamB) continue;

    teamA.played += 1;
    teamB.played += 1;

    if (match.status === "abandoned") {
      teamA.nr += 1;
      teamB.nr += 1;
      teamA.points += config.points_nr;
      teamB.points += config.points_nr;
      continue;
    }

    // completed
    if (match.winner_team_id === match.team_a_id) {
      teamA.won += 1;
      teamB.lost += 1;
      teamA.points += config.points_win;
      teamB.points += config.points_loss;
    } else if (match.winner_team_id === match.team_b_id) {
      teamB.won += 1;
      teamA.lost += 1;
      teamB.points += config.points_win;
      teamA.points += config.points_loss;
    } else {
      // No winner → treat as tie (equal scores / shared points)
      teamA.tied += 1;
      teamB.tied += 1;
      teamA.points += config.points_tie;
      teamB.points += config.points_tie;
    }

    const matchInnings = (inningsByMatch.get(match.id) ?? []).filter(
      (i) => i.status === "completed" || i.legal_balls > 0 || i.total_runs > 0,
    );

    for (const inn of matchInnings) {
      const batting = rows.get(inn.batting_team_id);
      const bowling = rows.get(inn.bowling_team_id);
      if (!batting || !bowling) continue;

      const overs = nrrOversForInnings(inn, match.overs_per_innings);
      batting.runs_scored += inn.total_runs;
      batting.overs_faced += overs;
      bowling.runs_conceded += inn.total_runs;
      bowling.overs_bowled += overs;
    }
  }

  const table = [...rows.values()].map((row) => {
    const forRate =
      row.overs_faced > 0 ? row.runs_scored / row.overs_faced : 0;
    const againstRate =
      row.overs_bowled > 0 ? row.runs_conceded / row.overs_bowled : 0;
    const nrr =
      row.overs_faced > 0 || row.overs_bowled > 0
        ? forRate - againstRate
        : 0;
    return { ...row, nrr: Number(nrr.toFixed(4)) };
  });

  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;
    return a.team_name.localeCompare(b.team_name);
  });

  return table;
}

export function formatNrr(nrr: number): string {
  if (!Number.isFinite(nrr)) return "0.000";
  const sign = nrr > 0 ? "+" : "";
  return `${sign}${nrr.toFixed(3)}`;
}
