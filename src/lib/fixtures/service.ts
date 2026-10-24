import "server-only";
import { writeAuditLog } from "@/lib/auth/audit";
import type { SessionUser } from "@/lib/auth/permissions";
import {
  confirmDrawOrder,
  FixtureError,
  placeDrawnTeam,
  removeDrawPosition,
  validateTournamentConfig,
} from "@/lib/fixtures/draw";
import { evaluateLeagueEligibility } from "@/lib/fixtures/eligibility";
import { generateLeaguePreview } from "@/lib/fixtures/league";
import {
  generateKnockoutPreview,
  parseFeedsKey,
  type QualifiedTeam,
} from "@/lib/fixtures/knockout";
import {
  getFixtureTournament,
  listApprovedTournamentTeams,
  listKnockoutSlots,
  listMatchInnings,
  listTournamentDraw,
  listTournamentMatches,
  type DrawRow,
  type FixtureTeam,
  type FixtureTournament,
} from "@/lib/fixtures/queries";
import type {
  DrawTeam,
  EligibilityReport,
  KnockoutPreview,
  LeaguePreview,
  UnlockImpact,
} from "@/lib/fixtures/types";
import type { MatchRow } from "@/lib/matches/types";
import { adminRest, adminRpc, RestError, withRetry } from "@/lib/supabase/rest";
import { buildPointsTable, type PointsRow } from "@/lib/stats/points";

export type LeagueStandingRow = PointsRow & {
  rank: number;
  remaining: number;
  distinct_opponents: number;
};

export type FixtureWorkspace = {
  tournament: FixtureTournament;
  teams: FixtureTeam[];
  participants: FixtureTeam[];
  draw: Array<DrawRow & { team: FixtureTeam | null }>;
  available_teams: FixtureTeam[];
  league_preview: LeaguePreview | null;
  league_matches: MatchRow[];
  standings: LeagueStandingRow[];
  eligibility: EligibilityReport;
  knockout_preview: KnockoutPreview | null;
  knockout_matches: MatchRow[];
  champion: FixtureTeam | null;
  unlock_impact: UnlockImpact;
};

function asError(err: unknown, fallback: string): FixtureError {
  if (err instanceof FixtureError) return err;
  if (err instanceof RestError) {
    return new FixtureError(err.message || fallback, err.status >= 400 ? err.status : 400);
  }
  return new FixtureError(fallback, 500);
}

function requireConfirmedDraw(tournament: FixtureTournament) {
  if (tournament.draw_status !== "confirmed") {
    throw new FixtureError("Confirm the manual team draw before generating fixtures.");
  }
}

function participantIds(tournament: FixtureTournament, teams: FixtureTeam[]): string[] {
  if (tournament.participant_team_ids?.length) {
    return tournament.participant_team_ids.filter((id) =>
      teams.some((team) => team.id === id),
    );
  }
  return teams.map((team) => team.id);
}

function teamsInDrawOrder(
  teams: FixtureTeam[],
  draw: DrawRow[],
  ids: string[],
): DrawTeam[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  return [...draw]
    .sort((a, b) => a.draw_position - b.draw_position)
    .filter((row) => ids.includes(row.team_id))
    .map((row) => {
      const team = byId.get(row.team_id);
      return {
        id: row.team_id,
        name: team?.name ?? row.team_id,
        short_name: team?.short_name ?? "",
        logo_url: team?.logo_url ?? null,
        draw_position: row.draw_position,
      };
    });
}

function unlockImpact(matches: MatchRow[]): UnlockImpact {
  const league = matches.filter(
    (match) => (match.stage ?? "league") === "league" && match.generated_batch_id,
  );
  const knockout = matches.filter(
    (match) => match.stage === "knockout" || Boolean(match.knockout_key),
  );
  const started = league.filter(
    (match) => !["scheduled", "cancelled", "postponed"].includes(match.status),
  );
  const scheduled = league.length - started.length;
  const canUnlock = started.length === 0 && knockout.every((match) =>
    ["scheduled", "cancelled", "postponed"].includes(match.status),
  );
  return {
    scheduled_league: scheduled,
    started_or_completed_league: started.length,
    knockout_matches: knockout.length,
    can_unlock: canUnlock,
    message: canUnlock
      ? scheduled || knockout.length
        ? `Unlocking the draw will delete ${scheduled} scheduled league ${scheduled === 1 ? "fixture" : "fixtures"}${knockout.length ? ` and ${knockout.length} knockout ${knockout.length === 1 ? "match" : "matches"}` : ""}. Results are not affected.`
        : "The draw can be unlocked. No generated fixtures will be lost."
      : "The draw is locked because league or knockout matches already have results. Unlocking would not delete those results; correct them individually instead.",
  };
}

function buildStandings(
  tournament: FixtureTournament,
  participants: FixtureTeam[],
  matches: MatchRow[],
  innings: Awaited<ReturnType<typeof listMatchInnings>>,
  draw: DrawRow[],
): LeagueStandingRow[] {
  const drawPositions = new Map(draw.map((row) => [row.team_id, row.draw_position]));
  const table = buildPointsTable({
    teams: participants.map((team) => ({
      id: team.id,
      name: team.name,
      short_name: team.short_name,
    })),
    matches: matches.map((match) => ({
      id: match.id,
      team_a_id: match.team_a_id,
      team_b_id: match.team_b_id,
      status: match.status,
      match_type: match.match_type,
      stage: match.stage ?? "league",
      winner_team_id: match.winner_team_id,
      overs_per_innings: match.overs_per_innings,
    })),
    innings,
    config: tournament,
    drawPositions,
  });

  const remaining = new Map(participants.map((team) => [team.id, 0]));
  const opponents = new Map(participants.map((team) => [team.id, new Set<string>()]));
  for (const match of matches) {
    if ((match.stage ?? "league") !== "league" || match.match_type !== "league") continue;
    if (match.status === "completed") {
      opponents.get(match.team_a_id)?.add(match.team_b_id);
      opponents.get(match.team_b_id)?.add(match.team_a_id);
    } else if (!["cancelled", "abandoned"].includes(match.status)) {
      remaining.set(match.team_a_id, (remaining.get(match.team_a_id) ?? 0) + 1);
      remaining.set(match.team_b_id, (remaining.get(match.team_b_id) ?? 0) + 1);
    }
  }

  return table.map((row, index) => ({
    ...row,
    rank: index + 1,
    remaining: remaining.get(row.team_id) ?? 0,
    distinct_opponents: opponents.get(row.team_id)?.size ?? 0,
  }));
}

async function loadTournamentOrThrow(tournamentId: string): Promise<{
  tournament: FixtureTournament;
  teams: FixtureTeam[];
  draw: DrawRow[];
  matches: MatchRow[];
}> {
  let tournament: FixtureTournament | null;
  try {
    tournament = await getFixtureTournament(tournamentId);
  } catch (err) {
    throw asError(
      err,
      "Could not load tournament fixture settings. Apply the fixture migrations in Supabase first.",
    );
  }
  if (!tournament) throw new FixtureError("Tournament not found.", 404);
  const [teams, draw, matches] = await Promise.all([
    listApprovedTournamentTeams(tournamentId),
    listTournamentDraw(tournamentId),
    listTournamentMatches(tournamentId),
  ]);
  return { tournament, teams, draw, matches };
}

function leaguePreviewFromDraw(
  tournament: FixtureTournament,
  teams: FixtureTeam[],
  draw: DrawRow[],
): LeaguePreview | null {
  if (tournament.draw_status !== "confirmed") return null;
  const ids = participantIds(tournament, teams);
  const ordered = teamsInDrawOrder(teams, draw, ids);
  if (ordered.length < 2) return null;
  return generateLeaguePreview({
    teams: ordered,
    method: tournament.league_method,
    minMatches: tournament.min_league_matches,
  });
}

function qualifiedFromStandings(
  standings: LeagueStandingRow[],
  count: number,
): QualifiedTeam[] {
  return standings.slice(0, count).map((row) => ({
    team_id: row.team_id,
    team_name: row.team_name,
    seed: row.rank,
  }));
}

export async function getFixtureWorkspace(
  tournamentId: string,
): Promise<FixtureWorkspace> {
  const { tournament, teams, draw, matches } = await loadTournamentOrThrow(tournamentId);
  const ids = participantIds(tournament, teams);
  const participants = teams.filter((team) => ids.includes(team.id));
  const drawnIds = new Set(draw.map((row) => row.team_id));
  const innings = await listMatchInnings(matches.map((match) => match.id));
  const standings = buildStandings(tournament, participants, matches, innings, draw);
  const eligibility = evaluateLeagueEligibility({
    teams: participants,
    matches,
    minMatches: tournament.min_league_matches,
    qualifierCount: tournament.knockout_qualifiers,
    drawConfirmed: tournament.draw_status === "confirmed",
    leagueFixturesConfirmed: tournament.league_fixtures_confirmed,
    leagueStageCompleted: tournament.league_stage_completed,
  });

  let leaguePreview: LeaguePreview | null = null;
  try {
    leaguePreview = leaguePreviewFromDraw(tournament, teams, draw);
  } catch (err) {
    if (!(err instanceof FixtureError)) throw err;
  }

  let knockoutPreview: KnockoutPreview | null = null;
  if (eligibility.ok || tournament.knockout_batch_id) {
    try {
      knockoutPreview = generateKnockoutPreview(
        qualifiedFromStandings(standings, tournament.knockout_qualifiers),
      );
    } catch {
      knockoutPreview = null;
    }
  }

  const champion =
    participants.find((team) => team.id === tournament.champion_team_id) ?? null;

  return {
    tournament,
    teams,
    participants,
    draw: draw.map((row) => ({
      ...row,
      team: teams.find((team) => team.id === row.team_id) ?? null,
    })),
    available_teams: participants.filter((team) => !drawnIds.has(team.id)),
    league_preview: leaguePreview,
    league_matches: matches.filter(
      (match) => (match.stage ?? "league") === "league" && match.match_type === "league",
    ),
    standings,
    eligibility,
    knockout_preview: knockoutPreview,
    knockout_matches: matches.filter(
      (match) => match.stage === "knockout" || Boolean(match.knockout_key),
    ),
    champion,
    unlock_impact: unlockImpact(matches),
  };
}

export async function saveFixtureConfig(
  adminUser: SessionUser,
  input: {
    tournament_id: string;
    team_ids: string[];
    min_league_matches: number;
    knockout_qualifiers: number;
    league_method: "minimum" | "round_robin";
  },
): Promise<FixtureWorkspace> {
  const { tournament, teams, draw } = await loadTournamentOrThrow(
    input.tournament_id,
  );
  if (tournament.draw_status === "confirmed") {
    throw new FixtureError(
      "The manual draw is locked. Unlock it with confirmation before changing teams or format settings.",
    );
  }
  if (tournament.league_fixtures_confirmed) {
    throw new FixtureError("Unlock the draw before changing fixture settings.");
  }

  const uniqueIds = [...new Set(input.team_ids)];
  const approved = teams.filter((team) => uniqueIds.includes(team.id));
  if (approved.length !== uniqueIds.length) {
    throw new FixtureError("Select only approved teams registered in this tournament.");
  }
  validateTournamentConfig({
    teamCount: approved.length,
    minLeagueMatches: input.min_league_matches,
    knockoutQualifiers: input.knockout_qualifiers,
  });

  const selected = new Set(uniqueIds);
  const stale = draw.filter((row) => !selected.has(row.team_id));
  if (stale.length) {
    await withRetry(() =>
      adminRest("tournament_draw", {
        method: "DELETE",
        query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&team_id=in.(${stale.map((row) => row.team_id).join(",")})`,
        prefer: "return=minimal",
      }),
    );
    const remaining = draw
      .filter((row) => selected.has(row.team_id))
      .sort((a, b) => a.draw_position - b.draw_position);
    for (let index = 0; index < remaining.length; index += 1) {
      const row = remaining[index]!;
      if (row.draw_position === index + 1) continue;
      await withRetry(() =>
        adminRest("tournament_draw", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(row.id)}`,
          prefer: "return=minimal",
          body: { draw_position: index + 1 },
        }),
      );
    }
  }

  await withRetry(() =>
    adminRest("tournaments", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(tournament.id)}`,
      prefer: "return=minimal",
      body: {
        format: "league_knockout",
        min_league_matches: input.min_league_matches,
        knockout_qualifiers: input.knockout_qualifiers,
        league_method: input.league_method,
        participant_team_ids: uniqueIds,
        draw_status: draw.length && stale.length < draw.length ? "in_progress" : "pending",
        current_stage: "draw",
        updated_at: new Date().toISOString(),
      },
    }),
  );

  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.config",
    entityType: "tournament",
    entityId: tournament.id,
    newValue: {
      team_count: uniqueIds.length,
      min_league_matches: input.min_league_matches,
      knockout_qualifiers: input.knockout_qualifiers,
      league_method: input.league_method,
    },
  });

  return getFixtureWorkspace(tournament.id);
}

export async function drawTeam(
  adminUser: SessionUser,
  tournamentId: string,
  teamId: string,
): Promise<FixtureWorkspace> {
  const { tournament, teams, draw } = await loadTournamentOrThrow(tournamentId);
  if (tournament.draw_status === "confirmed") {
    throw new FixtureError("The manual draw is locked.");
  }
  const ids = participantIds(tournament, teams);
  if (!ids.length) {
    throw new FixtureError("Select the participating teams before starting the draw.");
  }
  const next = placeDrawnTeam(
    draw.map((row) => ({ team_id: row.team_id, draw_position: row.draw_position })),
    teamId,
    ids,
  );
  const placed = next[next.length - 1];
  if (!placed || placed.team_id !== teamId) {
    const found = next.find((entry) => entry.team_id === teamId);
    if (!found) throw new FixtureError("Could not place that team in the draw.");
  }
  const entry = next.find((row) => row.team_id === teamId)!;

  await withRetry(() =>
    adminRest("tournament_draw", {
      method: "POST",
      prefer: "return=minimal",
      body: [
        {
          tournament_id: tournament.id,
          team_id: teamId,
          draw_position: entry.draw_position,
          drawn_by: adminUser.id,
        },
      ],
    }),
  );
  await withRetry(() =>
    adminRest("tournaments", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(tournament.id)}`,
      prefer: "return=minimal",
      body: {
        draw_status: "in_progress",
        current_stage: "draw",
        updated_at: new Date().toISOString(),
      },
    }),
  );
  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.draw_team",
    entityType: "tournament",
    entityId: tournament.id,
    newValue: { team_id: teamId, draw_position: entry.draw_position },
  });
  return getFixtureWorkspace(tournament.id);
}

export async function undrawPosition(
  adminUser: SessionUser,
  tournamentId: string,
  position: number,
): Promise<FixtureWorkspace> {
  const { tournament, draw } = await loadTournamentOrThrow(tournamentId);
  if (tournament.draw_status === "confirmed") {
    throw new FixtureError("The manual draw is locked.");
  }
  removeDrawPosition(
    draw.map((row) => ({ team_id: row.team_id, draw_position: row.draw_position })),
    position,
  );
  const removed = draw.find((row) => row.draw_position === position);
  if (!removed) throw new FixtureError("That draw position is empty.");
  await withRetry(() =>
    adminRest("tournament_draw", {
      method: "DELETE",
      query: `?id=eq.${encodeURIComponent(removed.id)}`,
      prefer: "return=minimal",
    }),
  );
  const higher = draw
    .filter((row) => row.draw_position > position)
    .sort((a, b) => a.draw_position - b.draw_position);
  for (const row of higher) {
    await withRetry(() =>
      adminRest("tournament_draw", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(row.id)}`,
        prefer: "return=minimal",
        body: { draw_position: row.draw_position - 1 },
      }),
    );
  }
  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.undraw",
    entityType: "tournament",
    entityId: tournament.id,
    previousValue: { draw_position: position },
  });
  return getFixtureWorkspace(tournament.id);
}

export async function confirmDraw(
  adminUser: SessionUser,
  tournamentId: string,
): Promise<FixtureWorkspace> {
  const { tournament, teams, draw } = await loadTournamentOrThrow(tournamentId);
  if (tournament.draw_status === "confirmed") {
    return getFixtureWorkspace(tournamentId);
  }
  const ids = participantIds(tournament, teams);
  const order = confirmDrawOrder(
    draw.map((row) => ({ team_id: row.team_id, draw_position: row.draw_position })),
    ids,
  );
  await withRetry(() =>
    adminRest("tournaments", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(tournament.id)}`,
      prefer: "return=minimal",
      body: {
        draw_status: "confirmed",
        draw_confirmed_at: new Date().toISOString(),
        draw_confirmed_by: adminUser.id,
        participant_team_ids: order,
        current_stage: "league",
        updated_at: new Date().toISOString(),
      },
    }),
  );
  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.confirm_draw",
    entityType: "tournament",
    entityId: tournament.id,
    newValue: { order },
  });
  return getFixtureWorkspace(tournament.id);
}

export async function unlockDraw(
  adminUser: SessionUser,
  tournamentId: string,
  confirm: boolean,
): Promise<FixtureWorkspace> {
  if (!confirm) throw new FixtureError("Confirm unlocking the draw.");
  const { tournament, matches } = await loadTournamentOrThrow(tournamentId);
  const impact = unlockImpact(matches);
  if (!impact.can_unlock) {
    throw new FixtureError(impact.message);
  }
  if (impact.scheduled_league || impact.knockout_matches) {
    try {
      await withRetry(() =>
        adminRest("matches", {
          method: "DELETE",
          query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&generated_batch_id=not.is.null&status=in.(scheduled,cancelled,postponed)`,
          prefer: "return=minimal",
        }),
      );
      await withRetry(() =>
        adminRest("tournament_knockout_slots", {
          method: "DELETE",
          query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}`,
          prefer: "return=minimal",
        }),
      );
    } catch (err) {
      throw asError(err, "Could not clear scheduled fixtures while unlocking the draw.");
    }
  }
  await withRetry(() =>
    adminRest("tournaments", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(tournament.id)}`,
      prefer: "return=minimal",
      body: {
        draw_status: "in_progress",
        draw_confirmed_at: null,
        draw_confirmed_by: null,
        league_fixtures_confirmed: false,
        league_fixtures_confirmed_at: null,
        league_stage_completed: false,
        league_stage_completed_at: null,
        league_batch_id: null,
        knockout_batch_id: null,
        champion_team_id: null,
        current_stage: "draw",
        updated_at: new Date().toISOString(),
      },
    }),
  );
  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.unlock_draw",
    entityType: "tournament",
    entityId: tournament.id,
    previousValue: impact,
  });
  return getFixtureWorkspace(tournament.id);
}

export async function previewLeague(tournamentId: string): Promise<LeaguePreview> {
  const { tournament, teams, draw } = await loadTournamentOrThrow(tournamentId);
  requireConfirmedDraw(tournament);
  const preview = leaguePreviewFromDraw(tournament, teams, draw);
  if (!preview) throw new FixtureError("Could not build a league preview from the draw.");
  return preview;
}

export async function confirmLeague(
  adminUser: SessionUser,
  tournamentId: string,
  replaceScheduled = false,
): Promise<FixtureWorkspace> {
  const { tournament, teams, draw, matches } = await loadTournamentOrThrow(tournamentId);
  requireConfirmedDraw(tournament);
  const preview = leaguePreviewFromDraw(tournament, teams, draw);
  if (!preview?.valid) {
    throw new FixtureError(preview?.errors[0] ?? "League schedule is not valid.");
  }

  const existing = matches.filter(
    (match) => (match.stage ?? "league") === "league" && match.generated_batch_id,
  );
  if (existing.length && !replaceScheduled) {
    const started = existing.some(
      (match) => !["scheduled", "cancelled", "postponed"].includes(match.status),
    );
    if (started) {
      throw new FixtureError(
        "League fixtures already have results. Regeneration will not overwrite completed matches.",
      );
    }
    throw new FixtureError(
      "League fixtures already exist. Confirm regeneration to replace scheduled matches only.",
    );
  }

  const batchId = crypto.randomUUID();
  try {
    await withRetry(() =>
      adminRpc<number>("replace_generated_league_fixtures", {
        p_tournament_id: tournament.id,
        p_batch_id: batchId,
        p_replace_scheduled: replaceScheduled || existing.length > 0,
        p_matches: preview.fixtures.map((fixture) => ({
          team_a_id: fixture.team_a_id,
          team_b_id: fixture.team_b_id,
          round_number: fixture.round_number,
          match_number: fixture.match_number,
          overs_per_innings: 20,
        })),
      }),
    );
  } catch (err) {
    throw asError(err, "Could not save league fixtures.");
  }

  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.confirm_league",
    entityType: "tournament",
    entityId: tournament.id,
    newValue: { batch_id: batchId, matches: preview.total_matches },
  });
  return getFixtureWorkspace(tournament.id);
}

export async function completeLeague(
  adminUser: SessionUser,
  tournamentId: string,
): Promise<FixtureWorkspace> {
  const workspace = await getFixtureWorkspace(tournamentId);
  const report = evaluateLeagueEligibility({
    teams: workspace.participants,
    matches: workspace.league_matches,
    minMatches: workspace.tournament.min_league_matches,
    qualifierCount: workspace.tournament.knockout_qualifiers,
    drawConfirmed: workspace.tournament.draw_status === "confirmed",
    leagueFixturesConfirmed: workspace.tournament.league_fixtures_confirmed,
    leagueStageCompleted: true,
  });
  const blocking = report.issues.filter((issue) => issue.code !== "league_complete");
  if (blocking.length) {
    throw new FixtureError(blocking[0]!.message);
  }
  await withRetry(() =>
    adminRest("tournaments", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(tournamentId)}`,
      prefer: "return=minimal",
      body: {
        league_stage_completed: true,
        league_stage_completed_at: new Date().toISOString(),
        current_stage: "knockout",
        updated_at: new Date().toISOString(),
      },
    }),
  );
  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.complete_league",
    entityType: "tournament",
    entityId: tournamentId,
  });
  return getFixtureWorkspace(tournamentId);
}

export async function previewKnockout(tournamentId: string): Promise<KnockoutPreview> {
  const workspace = await getFixtureWorkspace(tournamentId);
  if (!workspace.eligibility.ok) {
    throw new FixtureError(
      workspace.eligibility.issues[0]?.message ?? "Knockout generation is blocked.",
    );
  }
  return generateKnockoutPreview(
    qualifiedFromStandings(workspace.standings, workspace.tournament.knockout_qualifiers),
  );
}

export async function confirmKnockout(
  adminUser: SessionUser,
  tournamentId: string,
  replaceScheduled = false,
): Promise<FixtureWorkspace> {
  const workspace = await getFixtureWorkspace(tournamentId);
  if (!workspace.eligibility.ok) {
    throw new FixtureError(
      workspace.eligibility.issues[0]?.message ?? "Knockout generation is blocked.",
    );
  }
  const preview = generateKnockoutPreview(
    qualifiedFromStandings(workspace.standings, workspace.tournament.knockout_qualifiers),
  );
  if (!preview.playable_matches.length) {
    throw new FixtureError("Could not build any playable knockout matches.");
  }
  if (workspace.knockout_matches.length && !replaceScheduled) {
    const started = workspace.knockout_matches.some(
      (match) => !["scheduled", "cancelled", "postponed"].includes(match.status),
    );
    if (started) {
      throw new FixtureError(
        "Knockout matches already have results. Reset the bracket with confirmation before regenerating.",
      );
    }
    throw new FixtureError(
      "Knockout fixtures already exist. Confirm regeneration to replace scheduled matches only.",
    );
  }

  const batchId = crypto.randomUUID();
  try {
    await withRetry(() =>
      adminRpc<number>("replace_generated_knockout_fixtures", {
        p_tournament_id: tournamentId,
        p_batch_id: batchId,
        p_replace_scheduled: replaceScheduled || workspace.knockout_matches.length > 0,
        p_matches: preview.playable_matches.map((match) => ({
          team_a_id: match.team_a_id,
          team_b_id: match.team_b_id,
          match_type: match.match_type,
          round_number: match.round_number,
          match_number: match.match_number,
          knockout_key: match.knockout_key,
          feeds_key: match.feeds_key,
          overs_per_innings: 20,
        })),
        p_slots: preview.slots.map((slot) => ({
          slot_key: slot.slot_key,
          team_id: slot.team_id,
          source: slot.source,
          source_match_key: slot.source_match_key,
        })),
      }),
    );
  } catch (err) {
    throw asError(err, "Could not save knockout fixtures.");
  }

  await maybeCreateReadyKnockoutMatches(tournamentId, batchId);
  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.confirm_knockout",
    entityType: "tournament",
    entityId: tournamentId,
    newValue: { batch_id: batchId, matches: preview.playable_matches.length },
  });
  return getFixtureWorkspace(tournamentId);
}

export async function resetKnockout(
  adminUser: SessionUser,
  tournamentId: string,
  confirm: boolean,
): Promise<FixtureWorkspace> {
  if (!confirm) throw new FixtureError("Confirm resetting the knockout bracket.");
  const { tournament, matches } = await loadTournamentOrThrow(tournamentId);
  const knockout = matches.filter(
    (match) => match.stage === "knockout" || Boolean(match.knockout_key),
  );
  const started = knockout.filter(
    (match) => !["scheduled", "cancelled", "postponed"].includes(match.status),
  );
  await withRetry(() =>
    adminRest("matches", {
      method: "DELETE",
      query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&stage=eq.knockout`,
      prefer: "return=minimal",
    }),
  );
  await withRetry(() =>
    adminRest("tournament_knockout_slots", {
      method: "DELETE",
      query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}`,
      prefer: "return=minimal",
    }),
  );
  await withRetry(() =>
    adminRest("tournaments", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(tournament.id)}`,
      prefer: "return=minimal",
      body: {
        knockout_batch_id: null,
        champion_team_id: null,
        current_stage: "knockout",
        updated_at: new Date().toISOString(),
      },
    }),
  );
  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.reset_knockout",
    entityType: "tournament",
    entityId: tournament.id,
    previousValue: { deleted: knockout.length, had_results: started.length },
  });
  return getFixtureWorkspace(tournament.id);
}

export async function resetFixtures(
  adminUser: SessionUser,
  tournamentId: string,
  confirm: boolean,
): Promise<FixtureWorkspace> {
  if (!confirm) throw new FixtureError("Confirm resetting fixtures.");
  const { tournament, draw, matches } = await loadTournamentOrThrow(tournamentId);

  try {
    await withRetry(() =>
      adminRest("tournament_knockout_slots", {
        method: "DELETE",
        query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}`,
        prefer: "return=minimal",
      }),
    );
    await withRetry(() =>
      adminRest("matches", {
        method: "DELETE",
        query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}`,
        prefer: "return=minimal",
      }),
    );
    await withRetry(() =>
      adminRest("tournament_draw", {
        method: "DELETE",
        query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}`,
        prefer: "return=minimal",
      }),
    );
    await withRetry(() =>
      adminRest("tournaments", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(tournament.id)}`,
        prefer: "return=minimal",
        body: {
          draw_status: "pending",
          draw_confirmed_at: null,
          draw_confirmed_by: null,
          league_fixtures_confirmed: false,
          league_fixtures_confirmed_at: null,
          league_stage_completed: false,
          league_stage_completed_at: null,
          league_batch_id: null,
          knockout_batch_id: null,
          champion_team_id: null,
          current_stage: tournament.participant_team_ids.length ? "draw" : "setup",
          updated_at: new Date().toISOString(),
        },
      }),
    );
  } catch (err) {
    throw asError(err, "Could not reset fixtures.");
  }

  await writeAuditLog({
    actorId: adminUser.id,
    action: "fixtures.reset",
    entityType: "tournament",
    entityId: tournament.id,
    previousValue: {
      matches: matches.length,
      draw_positions: draw.length,
      draw_status: tournament.draw_status,
    },
  });
  return getFixtureWorkspace(tournament.id);
}

function feedsKeyForMatch(knockoutKey: string, hasSibling: boolean): string | null {
  if (!hasSibling) return null;
  const parsed = /^R(\d+)-M(\d+)$/.exec(knockoutKey);
  if (!parsed) return null;
  const round = Number(parsed[1]);
  const matchNumber = Number(parsed[2]);
  const side = matchNumber % 2 === 1 ? "A" : "B";
  return `R${round + 1}-M${Math.ceil(matchNumber / 2)}-${side}`;
}

async function maybeCreateReadyKnockoutMatches(
  tournamentId: string,
  batchId: string | null,
) {
  const [matches, slots, tournament] = await Promise.all([
    listTournamentMatches(tournamentId),
    listKnockoutSlots(tournamentId),
    getFixtureTournament(tournamentId),
  ]);
  if (!tournament) return;
  const existingKeys = new Set(
    matches.map((match) => match.knockout_key).filter((key): key is string => Boolean(key)),
  );
  const slotMap = new Map(slots.map((slot) => [slot.slot_key, slot]));
  const needed = new Set<string>();
  for (const slot of slots) {
    const parsed = parseFeedsKey(slot.slot_key);
    if (parsed) needed.add(parsed.knockout_key);
  }
  for (const key of needed) {
    if (existingKeys.has(key)) continue;
    const sideA = slotMap.get(`${key}-A`);
    const sideB = slotMap.get(`${key}-B`);
    if (!sideA?.team_id || !sideB?.team_id || sideA.team_id === sideB.team_id) continue;
    const roundNumber = Number(key.match(/^R(\d+)/)?.[1] ?? 0);
    const matchNumber = Number(key.match(/M(\d+)/)?.[1] ?? 0);
    const siblingExists = [...needed].some(
      (other) => other !== key && other.startsWith(`R${roundNumber}-`),
    );
    const matchType = siblingExists
      ? roundNumber <= 2
        ? "semi"
        : "quarter"
      : "final";
    try {
      await adminRest("matches", {
        method: "POST",
        prefer: "return=minimal",
        body: [
          {
            tournament_id: tournamentId,
            team_a_id: sideA.team_id,
            team_b_id: sideB.team_id,
            match_type: matchType,
            stage: "knockout",
            round_number: roundNumber,
            match_number: matchNumber,
            generated_batch_id: batchId ?? tournament.knockout_batch_id,
            knockout_key: key,
            feeds_key: feedsKeyForMatch(key, siblingExists),
            overs_per_innings: 20,
            status: "scheduled",
          },
        ],
      });
    } catch (err) {
      if (err instanceof RestError && /duplicate|unique/i.test(err.message)) {
        continue;
      }
      throw err;
    }
  }
}

export async function advanceKnockoutFromMatch(match: MatchRow): Promise<void> {
  const isKnockout =
    match.stage === "knockout" ||
    ["semi", "final", "quarter", "last16", "prelim"].includes(match.match_type);
  if (!isKnockout) return;
  if (match.status !== "completed" || !match.winner_team_id) return;

  if (!match.feeds_key) {
    await withRetry(() =>
      adminRest("tournaments", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(match.tournament_id)}`,
        prefer: "return=minimal",
        body: {
          champion_team_id: match.winner_team_id,
          current_stage: "completed",
          updated_at: new Date().toISOString(),
        },
      }),
    );
    return;
  }

  const parsed = parseFeedsKey(match.feeds_key);
  if (!parsed) return;

  try {
    await withRetry(() =>
      adminRest("tournament_knockout_slots", {
        method: "POST",
        query: "?on_conflict=tournament_id,slot_key",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: [
          {
            tournament_id: match.tournament_id,
            slot_key: match.feeds_key,
            team_id: match.winner_team_id,
            source: "winner",
            source_match_key: match.knockout_key,
          },
        ],
      }),
    );
  } catch {
    await withRetry(() =>
      adminRest("tournament_knockout_slots", {
        method: "PATCH",
        query: `?tournament_id=eq.${encodeURIComponent(match.tournament_id)}&slot_key=eq.${encodeURIComponent(match.feeds_key!)}`,
        prefer: "return=minimal",
        body: {
          team_id: match.winner_team_id,
          source: "winner",
          source_match_key: match.knockout_key,
          updated_at: new Date().toISOString(),
        },
      }),
    );
  }

  const [slots, matches] = await Promise.all([
    listKnockoutSlots(match.tournament_id),
    listTournamentMatches(match.tournament_id),
  ]);
  const existing = matches.find((row) => row.knockout_key === parsed.knockout_key);
  const sideA = slots.find((slot) => slot.slot_key === `${parsed.knockout_key}-A`);
  const sideB = slots.find((slot) => slot.slot_key === `${parsed.knockout_key}-B`);
  if (!sideA?.team_id || !sideB?.team_id) return;

  if (existing) {
    if (!["scheduled", "cancelled", "postponed"].includes(existing.status)) {
      return;
    }
    const patch: Record<string, string> = {};
    if (parsed.side === "A" && existing.team_a_id !== sideA.team_id) {
      patch.team_a_id = sideA.team_id;
    }
    if (parsed.side === "B" && existing.team_b_id !== sideB.team_id) {
      patch.team_b_id = sideB.team_id;
    }
    if (existing.team_a_id !== sideA.team_id) patch.team_a_id = sideA.team_id;
    if (existing.team_b_id !== sideB.team_id) patch.team_b_id = sideB.team_id;
    if (Object.keys(patch).length) {
      await withRetry(() =>
        adminRest("matches", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(existing.id)}`,
          prefer: "return=minimal",
          body: patch,
        }),
      );
    }
    return;
  }

  const roundNumber = Number(parsed.knockout_key.match(/^R(\d+)/)?.[1] ?? 0);
  const matchNumber = Number(parsed.knockout_key.match(/M(\d+)/)?.[1] ?? 0);
  const siblingExists = slots.some((slot) =>
    slot.slot_key.startsWith(`R${roundNumber}-M`) &&
    !slot.slot_key.startsWith(`${parsed.knockout_key}-`),
  );
  const matchType = siblingExists
    ? matchNumber <= 2 && roundNumber >= 2
      ? "semi"
      : "quarter"
    : "final";

  try {
    await withRetry(() =>
      adminRest("matches", {
        method: "POST",
        prefer: "return=minimal",
        body: [
          {
            tournament_id: match.tournament_id,
            team_a_id: sideA.team_id,
            team_b_id: sideB.team_id,
            match_type: matchType,
            stage: "knockout",
            round_number: roundNumber,
            match_number: matchNumber,
            generated_batch_id: match.generated_batch_id,
            knockout_key: parsed.knockout_key,
            feeds_key: feedsKeyForMatch(parsed.knockout_key, siblingExists),
            overs_per_innings: match.overs_per_innings ?? 20,
            status: "scheduled",
          },
        ],
      }),
    );
  } catch (err) {
    if (err instanceof RestError && /duplicate|unique/i.test(err.message)) return;
    throw err;
  }
}
