import type {
  EligibilityIssue,
  EligibilityReport,
  TeamEligibility,
} from "@/lib/fixtures/types";

export type EligibilityMatch = {
  team_a_id: string;
  team_b_id: string;
  status: string;
  match_type?: string | null;
  stage?: string | null;
};

export function isLeagueMatch(match: EligibilityMatch): boolean {
  if (match.stage === "knockout") return false;
  if (match.match_type && match.match_type !== "league") return false;
  return true;
}

export function isFinalizedLeagueResult(status: string): boolean {
  return status === "completed";
}

export function evaluateLeagueEligibility(input: {
  teams: { id: string; name: string }[];
  matches: EligibilityMatch[];
  minMatches: number;
  qualifierCount: number;
  drawConfirmed: boolean;
  leagueFixturesConfirmed: boolean;
  leagueStageCompleted: boolean;
}): EligibilityReport {
  const issues: EligibilityIssue[] = [];
  const teams: TeamEligibility[] = input.teams.map((team) => ({
    team_id: team.id,
    team_name: team.name,
    completed_matches: 0,
    required_matches: input.minMatches,
    distinct_opponents: 0,
    remaining_matches: 0,
    ok: false,
  }));
  const byId = new Map(teams.map((row) => [row.team_id, row]));
  const opponents = new Map<string, Set<string>>();
  for (const team of input.teams) opponents.set(team.id, new Set());

  let pending = 0;
  for (const match of input.matches) {
    if (!isLeagueMatch(match)) continue;
    const rowA = byId.get(match.team_a_id);
    const rowB = byId.get(match.team_b_id);
    if (!rowA || !rowB) continue;

    if (isFinalizedLeagueResult(match.status)) {
      rowA.completed_matches += 1;
      rowB.completed_matches += 1;
      opponents.get(match.team_a_id)?.add(match.team_b_id);
      opponents.get(match.team_b_id)?.add(match.team_a_id);
    } else if (
      match.status !== "cancelled" &&
      match.status !== "abandoned"
    ) {
      pending += 1;
      rowA.remaining_matches += 1;
      rowB.remaining_matches += 1;
    }
  }

  for (const row of teams) {
    row.distinct_opponents = opponents.get(row.team_id)?.size ?? 0;
    row.ok =
      row.completed_matches >= input.minMatches &&
      row.distinct_opponents >= input.minMatches;
    if (!row.ok) {
      issues.push({
        code: "min_matches",
        message: `Knockout generation is blocked. ${row.team_name} has completed only ${row.completed_matches} of the required ${input.minMatches} league matches.`,
      });
    }
  }

  if (!input.drawConfirmed) {
    issues.push({
      code: "draw",
      message: "Knockout generation is blocked. The manual team draw has not been confirmed.",
    });
  }
  if (!input.leagueFixturesConfirmed) {
    issues.push({
      code: "fixtures",
      message: "Knockout generation is blocked. League fixtures have not been confirmed.",
    });
  }
  if (pending > 0) {
    issues.push({
      code: "pending",
      message: `Knockout generation is blocked. ${pending} league ${pending === 1 ? "match still has" : "matches still have"} no finalized result.`,
    });
  }
  if (!input.leagueStageCompleted) {
    issues.push({
      code: "league_complete",
      message: "Knockout generation is blocked. Mark the league stage complete after every required result is finalized.",
    });
  }
  if (input.qualifierCount > input.teams.length) {
    issues.push({
      code: "qualifiers",
      message: `Knockout generation is blocked. ${input.qualifierCount} qualifiers were configured but only ${input.teams.length} teams are registered.`,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    teams,
    draw_confirmed: input.drawConfirmed,
    league_fixtures_confirmed: input.leagueFixturesConfirmed,
    league_stage_completed: input.leagueStageCompleted,
    pending_league_matches: pending,
    qualifier_count: input.qualifierCount,
  };
}
