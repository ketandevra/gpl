export class FixtureError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FixtureError";
    this.status = status;
  }
}

export type DrawEntry = {
  team_id: string;
  draw_position: number;
};

export function allowedQualifierCounts(teamCount: number): number[] {
  return [2, 4, 8, 16].filter((count) => count <= teamCount);
}

export function validateTournamentConfig(input: {
  teamCount: number;
  minLeagueMatches: number;
  knockoutQualifiers: number;
}): void {
  const { teamCount, minLeagueMatches, knockoutQualifiers } = input;
  if (teamCount < 2) {
    throw new FixtureError("Select at least 2 registered teams.");
  }
  if (!Number.isInteger(minLeagueMatches) || minLeagueMatches < 1) {
    throw new FixtureError("Minimum league matches must be at least 1.");
  }
  if (minLeagueMatches > teamCount - 1) {
    throw new FixtureError(
      `Minimum league matches cannot exceed ${teamCount - 1} with ${teamCount} teams (only that many distinct opponents exist).`,
    );
  }
  if (![2, 4, 8, 16].includes(knockoutQualifiers)) {
    throw new FixtureError("Knockout qualifiers must be 2, 4, 8, or 16.");
  }
  if (knockoutQualifiers > teamCount) {
    throw new FixtureError(
      `Cannot qualify ${knockoutQualifiers} teams when only ${teamCount} are registered.`,
    );
  }
}

export function nextDrawPosition(entries: DrawEntry[]): number {
  if (!entries.length) return 1;
  return Math.max(...entries.map((entry) => entry.draw_position)) + 1;
}

export function placeDrawnTeam(
  entries: DrawEntry[],
  teamId: string,
  participantIds: string[],
): DrawEntry[] {
  if (!participantIds.includes(teamId)) {
    throw new FixtureError("That team is not in this tournament draw.");
  }
  if (entries.some((entry) => entry.team_id === teamId)) {
    throw new FixtureError("That team has already been drawn.");
  }
  const position = nextDrawPosition(entries);
  if (position > participantIds.length) {
    throw new FixtureError("All draw positions are already filled.");
  }
  return [...entries, { team_id: teamId, draw_position: position }].sort(
    (a, b) => a.draw_position - b.draw_position,
  );
}

export function removeDrawPosition(
  entries: DrawEntry[],
  position: number,
): DrawEntry[] {
  if (!entries.some((entry) => entry.draw_position === position)) {
    throw new FixtureError("That draw position is empty.");
  }
  return entries
    .filter((entry) => entry.draw_position !== position)
    .map((entry) =>
      entry.draw_position > position
        ? { ...entry, draw_position: entry.draw_position - 1 }
        : entry,
    )
    .sort((a, b) => a.draw_position - b.draw_position);
}

export function confirmDrawOrder(
  entries: DrawEntry[],
  participantIds: string[],
): string[] {
  if (participantIds.length < 2) {
    throw new FixtureError("Select at least 2 teams before confirming the draw.");
  }
  if (entries.length !== participantIds.length) {
    const remaining = participantIds.length - entries.length;
    throw new FixtureError(
      remaining === 1
        ? "1 team is still waiting to be drawn."
        : `${remaining} teams are still waiting to be drawn.`,
    );
  }

  const seenTeams = new Set<string>();
  const seenPositions = new Set<number>();
  const ordered = [...entries].sort((a, b) => a.draw_position - b.draw_position);

  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index]!;
    if (entry.draw_position !== index + 1) {
      throw new FixtureError("Draw positions must be contiguous starting at 1.");
    }
    if (seenTeams.has(entry.team_id)) {
      throw new FixtureError("A team can appear only once in the draw.");
    }
    if (seenPositions.has(entry.draw_position)) {
      throw new FixtureError("Each draw position can be used only once.");
    }
    if (!participantIds.includes(entry.team_id)) {
      throw new FixtureError("A drawn team is not in the selected participant list.");
    }
    seenTeams.add(entry.team_id);
    seenPositions.add(entry.draw_position);
  }

  return ordered.map((entry) => entry.team_id);
}

export function orderedTeamIds(entries: DrawEntry[]): string[] {
  return [...entries]
    .sort((a, b) => a.draw_position - b.draw_position)
    .map((entry) => entry.team_id);
}
