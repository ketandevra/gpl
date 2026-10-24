import { writeAuditLog } from "@/lib/auth/audit";
import type { SessionUser } from "@/lib/auth/permissions";
import { adminRest, RestError, withRetry } from "@/lib/supabase/rest";
import { getTeamById } from "@/lib/teams/queries";
import { getTournamentById } from "@/lib/tournaments/queries";
import {
  getMatchById,
  listMatchScorerIds,
  type MatchRow,
  type MatchView,
} from "@/lib/matches/queries";
import type {
  createMatchSchema,
  matchActionSchema,
  updateMatchSchema,
} from "@/lib/validations/matches";
import type { z } from "zod";
import type { Json, MatchStatus } from "@/lib/types/database";

type CreateInput = z.infer<typeof createMatchSchema>;
type UpdateInput = z.infer<typeof updateMatchSchema>;
type ActionInput = z.infer<typeof matchActionSchema>;

async function setScorers(
  matchId: string,
  scorerIds: string[],
  assignedBy: string,
) {
  await adminRest("match_scorers", {
    method: "DELETE",
    query: `?match_id=eq.${encodeURIComponent(matchId)}`,
  });
  if (!scorerIds.length) return;
  await adminRest("match_scorers", {
    method: "POST",
    prefer: "return=minimal",
    body: scorerIds.map((user_id) => ({
      match_id: matchId,
      user_id,
      assigned_by: assignedBy,
    })),
  });
}

export async function createMatch(
  adminUser: SessionUser,
  input: CreateInput,
): Promise<{ match: MatchView } | { error: string; status: number }> {
  if (!input.tournament_id) {
    return { error: "Select a tournament. Matches cannot be created without one.", status: 400 };
  }

  const tournament = await getTournamentById(input.tournament_id);
  if (!tournament) {
    return { error: "Tournament not found.", status: 400 };
  }
  if (tournament.status === "completed") {
    return { error: "Cannot add matches to a completed tournament.", status: 400 };
  }

  const [teamA, teamB] = await Promise.all([
    getTeamById(input.team_a_id),
    getTeamById(input.team_b_id),
  ]);
  if (!teamA || !teamB) {
    return { error: "Both teams must exist.", status: 400 };
  }
  if (
    teamA.tournament_id !== tournament.id ||
    teamB.tournament_id !== tournament.id
  ) {
    return {
      error: "Both teams must belong to the selected tournament.",
      status: 400,
    };
  }

  try {
    const created = await withRetry(() =>
      adminRest<MatchRow[]>("matches", {
        method: "POST",
        prefer: "return=representation",
        body: [
          {
            tournament_id: tournament.id,
            team_a_id: input.team_a_id,
            team_b_id: input.team_b_id,
            scheduled_at: new Date(input.scheduled_at).toISOString(),
            venue: input.venue ?? null,
            match_type: input.match_type ?? "league",
            overs_per_innings: input.overs_per_innings ?? 20,
            status: "scheduled",
          },
        ],
      }),
    );

    const match = created[0];
    if (!match) return { error: "Could not create match.", status: 500 };

    if (input.scorer_ids?.length) {
      await setScorers(match.id, input.scorer_ids, adminUser.id);
    }

    await writeAuditLog({
      actorId: adminUser.id,
      action: "match.create",
      entityType: "match",
      entityId: match.id,
      newValue: {
        team_a_id: match.team_a_id,
        team_b_id: match.team_b_id,
        scheduled_at: match.scheduled_at,
      },
    });

    const view = await getMatchById(match.id);
    return { match: view! };
  } catch (err) {
    console.error("[matches] create failed:", err);
    if (err instanceof RestError) {
      return { error: "Could not create match. Check teams and schedule.", status: 400 };
    }
    return { error: "Could not create match.", status: 500 };
  }
}

export async function updateMatch(
  adminUser: SessionUser,
  matchId: string,
  input: UpdateInput,
): Promise<{ match: MatchView } | { error: string; status: number }> {
  const existing = await getMatchById(matchId);
  if (!existing) return { error: "Match not found.", status: 404 };

  if (
    existing.status !== "scheduled" &&
    (input.team_a_id || input.team_b_id)
  ) {
    return {
      error: "Teams can only be changed while the match is scheduled.",
      status: 400,
    };
  }

  const patch: Record<string, unknown> = {};
  if (input.team_a_id) patch.team_a_id = input.team_a_id;
  if (input.team_b_id) patch.team_b_id = input.team_b_id;
  if (input.scheduled_at !== undefined) {
    patch.scheduled_at = input.scheduled_at
      ? new Date(input.scheduled_at).toISOString()
      : null;
  }
  if (input.venue !== undefined) patch.venue = input.venue;
  if (input.match_type) patch.match_type = input.match_type;
  if (input.overs_per_innings) patch.overs_per_innings = input.overs_per_innings;
  if (input.toss_winner_id !== undefined) {
    patch.toss_winner_id = input.toss_winner_id;
  }
  if (input.toss_decision !== undefined) {
    patch.toss_decision = input.toss_decision;
  }
  if (input.winner_team_id !== undefined) {
    patch.winner_team_id = input.winner_team_id;
  }
  if (input.result_text !== undefined) patch.result_text = input.result_text;

  try {
    if (Object.keys(patch).length) {
      await withRetry(() =>
        adminRest("matches", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(matchId)}`,
          prefer: "return=minimal",
          body: patch,
        }),
      );
    }

    if (input.scorer_ids) {
      await setScorers(matchId, input.scorer_ids, adminUser.id);
    }

    await writeAuditLog({
      actorId: adminUser.id,
      action: "match.update",
      entityType: "match",
      entityId: matchId,
      previousValue: {
        scheduled_at: existing.scheduled_at,
        venue: existing.venue,
        status: existing.status,
      },
      newValue: patch as Json,
    });

    const view = await getMatchById(matchId);
    return { match: view! };
  } catch (err) {
    console.error("[matches] update failed:", err);
    return { error: "Could not update match.", status: 500 };
  }
}

export async function applyMatchAction(
  adminUser: SessionUser,
  matchId: string,
  input: ActionInput,
): Promise<{ match: MatchView } | { error: string; status: number }> {
  const existing = await getMatchById(matchId);
  if (!existing) return { error: "Match not found.", status: 404 };

  let nextStatus: MatchStatus | null = null;
  const patch: Record<string, unknown> = {};

  switch (input.action) {
    case "start":
      if (existing.status !== "scheduled") {
        return { error: "Only scheduled matches can be started.", status: 400 };
      }
      nextStatus = "live";
      if (input.toss_winner_id) patch.toss_winner_id = input.toss_winner_id;
      if (input.toss_decision) patch.toss_decision = input.toss_decision;
      break;
    case "innings_break":
      if (existing.status !== "live") {
        return { error: "Match must be live to enter innings break.", status: 400 };
      }
      nextStatus = "innings_break";
      break;
    case "resume":
      if (existing.status !== "innings_break") {
        return { error: "Match must be in innings break to resume.", status: 400 };
      }
      nextStatus = "live";
      break;
    case "complete":
      if (!["live", "innings_break", "scheduled"].includes(existing.status)) {
        return { error: "This match cannot be completed from its current status.", status: 400 };
      }
      nextStatus = "completed";
      if (input.winner_team_id !== undefined) {
        patch.winner_team_id = input.winner_team_id;
      }
      if (input.result_text !== undefined) {
        patch.result_text = input.result_text || (input.winner_team_id ? null : "Match tied");
      } else if (!input.winner_team_id) {
        patch.result_text = "Match tied";
      }
      break;
    case "draw":
      if (existing.status === "abandoned") {
        return { error: "An abandoned match cannot be marked as a draw.", status: 400 };
      }
      nextStatus = "completed";
      patch.winner_team_id = null;
      patch.result_text = input.result_text?.trim() || "Match tied";
      break;
    case "super_over": {
      const tied =
        existing.status === "completed" && !existing.winner_team_id;
      if (!tied) {
        return {
          error: "Super Over can only be awarded after a tied match.",
          status: 400,
        };
      }
      if (
        !input.winner_team_id ||
        (input.winner_team_id !== existing.team_a_id &&
          input.winner_team_id !== existing.team_b_id)
      ) {
        return { error: "Pick the Super Over winner.", status: 400 };
      }
      nextStatus = "completed";
      patch.winner_team_id = input.winner_team_id;
      const winnerName =
        input.winner_team_id === existing.team_a_id
          ? existing.team_a?.name
          : existing.team_b?.name;
      patch.result_text =
        input.result_text?.trim() || `${winnerName} won in Super Over`;
      break;
    }
    case "start_super_over": {
      const resultTied = (existing.result_text ?? "")
        .toLowerCase()
        .includes("tied");
      const tied =
        (!existing.winner_team_id && existing.status === "completed") ||
        resultTied;
      if (!tied) {
        return {
          error: "Only a tied match can start a Super Over.",
          status: 400,
        };
      }
      nextStatus = "live";
      patch.winner_team_id = null;
      patch.result_text = "Super Over";
      break;
    }
    case "abandon":
      if (["completed", "abandoned"].includes(existing.status)) {
        return { error: "Match is already finished.", status: 400 };
      }
      nextStatus = "abandoned";
      if (input.result_text) patch.result_text = input.result_text;
      else patch.result_text = "Match abandoned";
      break;
  }

  if (!nextStatus) {
    return { error: "Unknown action.", status: 400 };
  }

  patch.status = nextStatus;

  try {
    await withRetry(() =>
      adminRest("matches", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(matchId)}`,
        prefer: "return=minimal",
        body: patch,
      }),
    );

    await writeAuditLog({
      actorId: adminUser.id,
      action: `match.${input.action}`,
      entityType: "match",
      entityId: matchId,
      previousValue: { status: existing.status },
      newValue: patch as Json,
    });

    const view = await getMatchById(matchId);
    return { match: view! };
  } catch (err) {
    console.error("[matches] action failed:", err);
    return { error: "Could not update match status.", status: 500 };
  }
}

export async function getMatchAdminDetail(matchId: string) {
  const match = await getMatchById(matchId);
  if (!match) return null;
  const scorer_ids = await listMatchScorerIds(matchId);
  return { match, scorer_ids };
}
