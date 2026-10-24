import { FixtureError } from "@/lib/fixtures/draw";
import type {
  KnockoutMatchPreview,
  KnockoutPreview,
  KnockoutSlotPreview,
} from "@/lib/fixtures/types";
import type { MatchType } from "@/lib/types/database";

export type QualifiedTeam = {
  team_id: string;
  team_name: string;
  seed: number;
};

export function nextPowerOfTwo(value: number): number {
  if (value < 1) return 1;
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

/** Standard bracket seed order: 1 vs last, 2 vs penultimate, etc. */
export function seedPositions(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) {
    throw new FixtureError("Bracket size must be a power of two.");
  }
  let positions = [1];
  while (positions.length < size) {
    const nextSize = positions.length * 2;
    const next: number[] = [];
    for (const seed of positions) {
      next.push(seed);
      next.push(nextSize + 1 - seed);
    }
    positions = next;
  }
  return positions;
}

export function matchTypeForRound(
  teamsInRound: number,
  firstRoundHasByes: boolean,
  isFirstRound: boolean,
): MatchType {
  if (teamsInRound <= 2) return "final";
  if (teamsInRound <= 4) return "semi";
  if (isFirstRound && firstRoundHasByes) return "prelim";
  if (teamsInRound <= 8) return "quarter";
  if (teamsInRound <= 16) return "last16";
  return "prelim";
}

export function roundName(matchType: MatchType, teamsInRound: number): string {
  switch (matchType) {
    case "final":
      return "Final";
    case "semi":
      return "Semi-finals";
    case "quarter":
      return "Quarter-finals";
    case "last16":
      return "Round of 16";
    case "prelim":
      return teamsInRound > 16 ? `Round of ${teamsInRound}` : "Preliminary";
    default:
      return `Round of ${teamsInRound}`;
  }
}

function feedsKey(nextRound: number, pairIndex: number): string {
  const nextMatch = Math.floor(pairIndex / 2) + 1;
  const side = pairIndex % 2 === 0 ? "A" : "B";
  return `R${nextRound}-M${nextMatch}-${side}`;
}

export function generateKnockoutPreview(qualified: QualifiedTeam[]): KnockoutPreview {
  const ordered = [...qualified].sort((a, b) => a.seed - b.seed);
  const qualifierCount = ordered.length;
  if (qualifierCount < 2) {
    throw new FixtureError("Need at least 2 qualified teams for a knockout bracket.");
  }
  if (new Set(ordered.map((row) => row.seed)).size !== qualifierCount) {
    throw new FixtureError("Knockout seeds must be unique.");
  }

  const bracketSize = nextPowerOfTwo(qualifierCount);
  const byeCount = bracketSize - qualifierCount;
  const positions = seedPositions(bracketSize);
  const bySeed = new Map(ordered.map((row) => [row.seed, row]));
  const firstRoundSlots: (QualifiedTeam | null)[] = positions.map(
    (seed) => bySeed.get(seed) ?? null,
  );
  const firstRoundHasByes = byeCount > 0;

  const slots: KnockoutSlotPreview[] = [];
  const rounds: KnockoutPreview["rounds"] = [];
  let teamsInRound = bracketSize;
  let roundNumber = 1;

  const firstMatches: KnockoutMatchPreview[] = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const pairIndex = i / 2;
    const teamA = firstRoundSlots[i];
    const teamB = firstRoundSlots[i + 1];
    const knockoutKey = `R${roundNumber}-M${pairIndex + 1}`;
    const nextFeeds =
      teamsInRound > 2 ? feedsKey(roundNumber + 1, pairIndex) : null;
    const playable = Boolean(teamA && teamB);

    if (playable) {
      firstMatches.push({
        knockout_key: knockoutKey,
        feeds_key: nextFeeds,
        round_number: roundNumber,
        match_number: pairIndex + 1,
        round_name: "",
        match_type: "prelim",
        team_a_id: teamA!.team_id,
        team_b_id: teamB!.team_id,
        team_a_name: teamA!.team_name,
        team_b_name: teamB!.team_name,
        playable: true,
      });
    } else if (nextFeeds) {
      const advancer = teamA ?? teamB;
      if (advancer) {
        slots.push({
          slot_key: nextFeeds,
          team_id: advancer.team_id,
          team_name: advancer.team_name,
          source: "bye",
          source_match_key: null,
        });
      }
    }
  }

  const firstType = matchTypeForRound(teamsInRound, firstRoundHasByes, true);
  const firstName = roundName(firstType, teamsInRound);
  for (const match of firstMatches) {
    match.match_type = firstType;
    match.round_name = firstName;
  }
  rounds.push({
    round_number: roundNumber,
    name: firstName,
    match_type: firstType,
    matches: firstMatches,
  });

  teamsInRound /= 2;
  roundNumber += 1;

  while (teamsInRound >= 2) {
    const matchType = matchTypeForRound(teamsInRound, false, false);
    const name = roundName(matchType, teamsInRound);
    const matches: KnockoutMatchPreview[] = [];
    const pairCount = teamsInRound / 2;
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const slotA = `R${roundNumber}-M${pairIndex + 1}-A`;
      const slotB = `R${roundNumber}-M${pairIndex + 1}-B`;
      const knownA = slots.find((slot) => slot.slot_key === slotA);
      const knownB = slots.find((slot) => slot.slot_key === slotB);
      matches.push({
        knockout_key: `R${roundNumber}-M${pairIndex + 1}`,
        feeds_key:
          teamsInRound > 2 ? feedsKey(roundNumber + 1, pairIndex) : null,
        round_number: roundNumber,
        match_number: pairIndex + 1,
        round_name: name,
        match_type: matchType,
        team_a_id: knownA?.team_id ?? null,
        team_b_id: knownB?.team_id ?? null,
        team_a_name: knownA?.team_name ?? null,
        team_b_name: knownB?.team_name ?? null,
        playable: Boolean(knownA?.team_id && knownB?.team_id),
      });
    }
    rounds.push({ round_number: roundNumber, name, match_type: matchType, matches });
    teamsInRound /= 2;
    roundNumber += 1;
  }

  return {
    qualifier_count: qualifierCount,
    bracket_size: bracketSize,
    bye_count: byeCount,
    rounds,
    playable_matches: rounds.flatMap((round) =>
      round.matches.filter((match) => match.playable),
    ),
    slots,
    seeded: ordered,
  };
}

export function parseFeedsKey(
  feedsKeyValue: string | null | undefined,
): { knockout_key: string; side: "A" | "B" } | null {
  if (!feedsKeyValue) return null;
  const match = /^R(\d+)-M(\d+)-(A|B)$/.exec(feedsKeyValue);
  if (!match) return null;
  return {
    knockout_key: `R${match[1]}-M${match[2]}`,
    side: match[3] as "A" | "B",
  };
}
