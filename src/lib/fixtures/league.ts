import { FixtureError } from "@/lib/fixtures/draw";
import type {
  DrawTeam,
  LeagueMethod,
  LeaguePreview,
  LeagueRoundPreview,
  TeamMatchCount,
} from "@/lib/fixtures/types";

const BYE = "__BYE__";

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Circle / polygon method. Teams stay in the supplied draw order.
 * Never shuffles or reorders the input list.
 */
export function generateCircleRounds(teamIds: string[]): LeagueRoundPreview[] {
  if (teamIds.length < 2) {
    throw new FixtureError("Need at least 2 teams to build league fixtures.");
  }

  const hasBye = teamIds.length % 2 === 1;
  const circle = hasBye ? [...teamIds, BYE] : [...teamIds];
  const size = circle.length;
  const rounds: LeagueRoundPreview[] = [];

  for (let round = 0; round < size - 1; round += 1) {
    const pairs: LeagueRoundPreview["pairs"] = [];
    const byes: string[] = [];

    for (let i = 0; i < size / 2; i += 1) {
      const left = circle[i]!;
      const right = circle[size - 1 - i]!;
      if (left === BYE && right !== BYE) {
        byes.push(right);
      } else if (right === BYE && left !== BYE) {
        byes.push(left);
      } else if (left !== BYE && right !== BYE) {
        const leftIndex = teamIds.indexOf(left);
        const rightIndex = teamIds.indexOf(right);
        pairs.push(
          leftIndex < rightIndex
            ? { team_a_id: left, team_b_id: right }
            : { team_a_id: right, team_b_id: left },
        );
      }
    }

    rounds.push({
      round_number: round + 1,
      pairs,
      byes,
    });

    const last = circle.pop()!;
    circle.splice(1, 0, last);
  }

  return rounds;
}

function countsFromRounds(
  teams: DrawTeam[],
  rounds: LeagueRoundPreview[],
): TeamMatchCount[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const counts = new Map<string, TeamMatchCount>();
  for (const team of teams) {
    counts.set(team.id, {
      team_id: team.id,
      team_name: team.name,
      matches: 0,
      opponents: [],
      byes: 0,
    });
  }

  for (const round of rounds) {
    for (const pair of round.pairs) {
      const a = counts.get(pair.team_a_id);
      const b = counts.get(pair.team_b_id);
      if (!a || !b) continue;
      a.matches += 1;
      b.matches += 1;
      a.opponents.push(byId.get(pair.team_b_id)?.name ?? pair.team_b_id);
      b.opponents.push(byId.get(pair.team_a_id)?.name ?? pair.team_a_id);
    }
    for (const teamId of round.byes) {
      const row = counts.get(teamId);
      if (row) row.byes += 1;
    }
  }

  return teams.map((team) => counts.get(team.id)!);
}

function validateRounds(
  teams: DrawTeam[],
  rounds: LeagueRoundPreview[],
  minMatches: number,
): string[] {
  const errors: string[] = [];
  const pairSeen = new Set<string>();
  const names = new Map(teams.map((team) => [team.id, team.name]));

  for (const round of rounds) {
    const inRound = new Set<string>();
    for (const pair of round.pairs) {
      if (pair.team_a_id === pair.team_b_id) {
        errors.push("A team cannot play itself.");
        continue;
      }
      const key = pairKey(pair.team_a_id, pair.team_b_id);
      if (pairSeen.has(key)) {
        errors.push(
          `Duplicate pairing: ${names.get(pair.team_a_id)} vs ${names.get(pair.team_b_id)}.`,
        );
      }
      pairSeen.add(key);
      if (inRound.has(pair.team_a_id) || inRound.has(pair.team_b_id)) {
        errors.push(`A team is scheduled twice in round ${round.round_number}.`);
      }
      inRound.add(pair.team_a_id);
      inRound.add(pair.team_b_id);
    }
    for (const bye of round.byes) {
      if (inRound.has(bye)) {
        errors.push(
          `${names.get(bye) ?? bye} has both a match and a bye in round ${round.round_number}.`,
        );
      }
    }
  }

  const counts = countsFromRounds(teams, rounds);
  for (const row of counts) {
    if (row.matches < minMatches) {
      errors.push(
        `${row.team_name} is scheduled for only ${row.matches} of the required ${minMatches} league matches.`,
      );
    }
    if (new Set(row.opponents).size < Math.min(minMatches, teams.length - 1)) {
      errors.push(
        `${row.team_name} does not face ${minMatches} different opponents.`,
      );
    }
  }

  return [...new Set(errors)];
}

export function generateLeaguePreview(input: {
  teams: DrawTeam[];
  method?: LeagueMethod;
  minMatches?: number;
}): LeaguePreview {
  const teams = input.teams;
  const method = input.method ?? "minimum";
  const minMatches = input.minMatches ?? 2;

  if (teams.length < 2) {
    throw new FixtureError("Need at least 2 teams in the confirmed draw.");
  }

  const ids = teams.map((team) => team.id);
  if (new Set(ids).size !== ids.length) {
    throw new FixtureError("Draw order contains a duplicate team.");
  }

  if (minMatches > teams.length - 1) {
    throw new FixtureError(
      `Cannot schedule ${minMatches} distinct opponents for each of ${teams.length} teams.`,
    );
  }

  const allRounds = generateCircleRounds(ids);
  let selected = allRounds;

  if (method === "minimum") {
    selected = [];
    const played = new Map(ids.map((id) => [id, 0]));
    const opponents = new Map(ids.map((id) => [id, new Set<string>()]));

    for (const round of allRounds) {
      selected.push(round);
      for (const pair of round.pairs) {
        played.set(pair.team_a_id, (played.get(pair.team_a_id) ?? 0) + 1);
        played.set(pair.team_b_id, (played.get(pair.team_b_id) ?? 0) + 1);
        opponents.get(pair.team_a_id)?.add(pair.team_b_id);
        opponents.get(pair.team_b_id)?.add(pair.team_a_id);
      }
      const done = ids.every(
        (id) =>
          (played.get(id) ?? 0) >= minMatches &&
          (opponents.get(id)?.size ?? 0) >= minMatches,
      );
      if (done) break;
    }
  }

  const errors = validateRounds(teams, selected, minMatches);
  const names = new Map(teams.map((team) => [team.id, team.name]));
  const fixtures = selected.flatMap((round, roundIndex) =>
    round.pairs.map((pair, pairIndex) => ({
      match_number: 0,
      round_number: round.round_number,
      team_a_id: pair.team_a_id,
      team_b_id: pair.team_b_id,
      team_a_name: names.get(pair.team_a_id) ?? pair.team_a_id,
      team_b_name: names.get(pair.team_b_id) ?? pair.team_b_id,
      status: "scheduled" as const,
      _order: roundIndex * 1000 + pairIndex,
    })),
  );

  const numbered = fixtures.map((fixture, index) => ({
    match_number: index + 1,
    round_number: fixture.round_number,
    team_a_id: fixture.team_a_id,
    team_b_id: fixture.team_b_id,
    team_a_name: fixture.team_a_name,
    team_b_name: fixture.team_b_name,
    status: fixture.status,
  }));

  if (errors.length) {
    throw new FixtureError(errors[0]!);
  }

  return {
    method,
    min_matches: minMatches,
    team_count: teams.length,
    rounds: selected,
    fixtures: numbered,
    total_matches: numbered.length,
    team_counts: countsFromRounds(teams, selected),
    bye_rounds: selected.flatMap((round) =>
      round.byes.map((teamId) => ({
        round_number: round.round_number,
        team_id: teamId,
        team_name: names.get(teamId) ?? teamId,
      })),
    ),
    duplicate_pairings: 0,
    valid: true,
    errors: [],
  };
}
