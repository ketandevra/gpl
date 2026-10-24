type TossMatch = {
  team_a_id: string;
  team_b_id: string;
  toss_winner_id: string | null;
  toss_decision: "bat" | "bowl" | null;
};

type InningsSide = {
  batting_team_id: string;
  bowling_team_id: string;
  innings_number?: number;
  total_runs?: number;
};

export function otherTeamId(match: TossMatch, teamId: string): string {
  return teamId === match.team_a_id ? match.team_b_id : match.team_a_id;
}

export function isSuperOverInnings(inningsNumber: number): boolean {
  return inningsNumber >= 3;
}

export function superOverOvers(): number {
  return 1;
}

export function superOverMaxWickets(): number {
  return 2;
}

/** Who bats first from the toss. Falls back to team A if toss is missing. */
export function firstInningsBattingTeamId(match: TossMatch): string {
  if (match.toss_winner_id && match.toss_decision) {
    return match.toss_decision === "bat"
      ? match.toss_winner_id
      : otherTeamId(match, match.toss_winner_id);
  }
  return match.team_a_id;
}

function numbered(innings: InningsSide[]) {
  return innings.map((row, index) => ({
    ...row,
    innings_number: row.innings_number ?? index + 1,
  }));
}

/** Next batting side: toss, other team, then Super Over (side that batted second). */
export function battingTeamForNextInnings(
  match: TossMatch,
  innings: InningsSide[],
): string {
  const rows = numbered(innings);
  if (rows.length === 0) return firstInningsBattingTeamId(match);
  if (rows.length === 1) return rows[0].bowling_team_id;

  const second = rows.find((row) => row.innings_number === 2);
  const superOvers = rows.filter((row) => isSuperOverInnings(row.innings_number));
  if (superOvers.length % 2 === 0) {
    return second?.batting_team_id ?? rows[0].bowling_team_id;
  }
  return superOvers[superOvers.length - 1].bowling_team_id;
}

export function isBattingTeamLocked(
  match: TossMatch,
  innings: InningsSide[],
): boolean {
  return (
    innings.length > 0 ||
    Boolean(match.toss_winner_id && match.toss_decision)
  );
}

export function regulationScoresTied(innings: InningsSide[]): boolean {
  const rows = numbered(innings);
  const first = rows.find((row) => row.innings_number === 1);
  const second = rows.find((row) => row.innings_number === 2);
  if (!first || !second) return false;
  return (first.total_runs ?? 0) === (second.total_runs ?? 0);
}
