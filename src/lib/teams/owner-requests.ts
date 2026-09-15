import "server-only";
import { canAccessAdmin, type SessionUser } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/auth/audit";
import { adminRest, RestError, withRetry } from "@/lib/supabase/rest";
import { getActiveTournament } from "@/lib/teams/queries";
import { createTeamByAdmin, uniqueShortName } from "@/lib/teams/service";
import type {
  TeamOwnerRequestRow,
  TeamOwnerRequestView,
  TeamRow,
} from "@/lib/teams/types";

const MIGRATION_HINT =
  "Team owner requests are not set up yet. Apply migration 20260313000015_team_owner_requests.sql in Supabase and try again.";

function isMissingTable(err: unknown): boolean {
  if (!(err instanceof RestError)) return false;
  return (
    err.status === 404 ||
    /team_owner_requests|schema cache|does not exist/i.test(err.message)
  );
}

async function attachRequesters(
  rows: TeamOwnerRequestRow[],
): Promise<TeamOwnerRequestView[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((row) => row.requester_id))];
  const users = await withRetry(() =>
    adminRest<Array<{ id: string; name: string; mobile_number: string }>>(
      "users",
      {
        query: `?id=in.(${ids.join(",")})&select=id,name,mobile_number`,
      },
    ),
  );
  const byId = new Map(users.map((user) => [user.id, user]));
  return rows.map((row) => {
    const user = byId.get(row.requester_id);
    return {
      ...row,
      requester_name: user?.name ?? "Unknown player",
      requester_mobile: user?.mobile_number ?? "",
    };
  });
}

export async function getPendingOwnerRequestForUser(
  userId: string,
  tournamentId: string,
): Promise<TeamOwnerRequestRow | null> {
  try {
    const rows = await withRetry(() =>
      adminRest<TeamOwnerRequestRow[]>("team_owner_requests", {
        query: `?requester_id=eq.${encodeURIComponent(userId)}&tournament_id=eq.${encodeURIComponent(tournamentId)}&status=eq.pending&select=*&limit=1`,
      }),
    );
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

export async function listPendingOwnerRequests(
  tournamentId?: string | null,
): Promise<TeamOwnerRequestView[]> {
  try {
    const tournamentFilter = tournamentId
      ? `&tournament_id=eq.${encodeURIComponent(tournamentId)}`
      : "";
    const rows = await withRetry(() =>
      adminRest<TeamOwnerRequestRow[]>("team_owner_requests", {
        query: `?status=eq.pending${tournamentFilter}&select=*&order=created_at.asc`,
      }),
    );
    return attachRequesters(rows);
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/** Verified player submits a name; no team row is created until admin approves. */
export async function requestTeamOwnership(
  user: SessionUser,
  input: { name: string },
): Promise<
  { request: TeamOwnerRequestRow } | { error: string; status: number }
> {
  if (!user.is_active) {
    return { error: "This account is disabled.", status: 403 };
  }
  if (canAccessAdmin(user)) {
    return {
      error: "Create teams from Admin → Teams.",
      status: 400,
    };
  }
  if (user.verification_status !== "verified") {
    return {
      error: "Verify as a player before requesting to own a team.",
      status: 403,
    };
  }

  const tournament = await getActiveTournament();
  if (!tournament) {
    return { error: "No active tournament found.", status: 400 };
  }

  const existingTeams = await withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query: `?manager_id=eq.${encodeURIComponent(user.id)}&tournament_id=eq.${encodeURIComponent(tournament.id)}&registration_status=in.(pending,approved)&select=id,name`,
    }),
  );
  if (existingTeams.length > 0) {
    return {
      error: `You are already captain of “${existingTeams[0]!.name}”.`,
      status: 409,
    };
  }

  const pending = await getPendingOwnerRequestForUser(user.id, tournament.id);
  if (pending) {
    return {
      error: `Your request for “${pending.name}” is already waiting for admin approval.`,
      status: 409,
    };
  }

  const nameClash = await withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&name=eq.${encodeURIComponent(input.name)}&select=id&limit=1`,
    }),
  );
  if (nameClash.length > 0) {
    return {
      error: "A team with that name already exists. Choose another name.",
      status: 409,
    };
  }

  try {
    const created = await withRetry(() =>
      adminRest<TeamOwnerRequestRow[]>("team_owner_requests", {
        method: "POST",
        prefer: "return=representation",
        body: [
          {
            tournament_id: tournament.id,
            requester_id: user.id,
            name: input.name,
            status: "pending",
          },
        ],
      }),
    );
    const request = created[0];
    if (!request) {
      return { error: "Could not submit your request.", status: 500 };
    }

    await writeAuditLog({
      actorId: user.id,
      action: "team.owner.request",
      entityType: "team_owner_request",
      entityId: request.id,
      newValue: { name: request.name },
    });

    return { request };
  } catch (err) {
    if (isMissingTable(err)) {
      return { error: MIGRATION_HINT, status: 500 };
    }
    if (err instanceof RestError && err.status === 409) {
      return {
        error:
          "That team name is already waiting for approval, or you already have a pending request.",
        status: 409,
      };
    }
    console.error("[teams] owner request failed:", err);
    return { error: "Could not submit your request. Try again.", status: 500 };
  }
}

export async function decideOwnerRequest(
  adminUser: SessionUser,
  input: {
    requestId: string;
    decision: "approve" | "reject";
    rejection_reason?: string;
  },
): Promise<
  | { request: TeamOwnerRequestRow; team: TeamRow | null }
  | { error: string; status: number }
> {
  if (!canAccessAdmin(adminUser)) {
    return { error: "Only admins can review owner requests.", status: 403 };
  }

  let rows: TeamOwnerRequestRow[];
  try {
    rows = await withRetry(() =>
      adminRest<TeamOwnerRequestRow[]>("team_owner_requests", {
        query: `?id=eq.${encodeURIComponent(input.requestId)}&select=*&limit=1`,
      }),
    );
  } catch (err) {
    if (isMissingTable(err)) {
      return { error: MIGRATION_HINT, status: 500 };
    }
    throw err;
  }

  const request = rows[0];
  if (!request) {
    return { error: "Owner request not found.", status: 404 };
  }
  if (request.status !== "pending") {
    return { error: "This request has already been reviewed.", status: 409 };
  }

  if (input.decision === "reject") {
    const updated = await withRetry(() =>
      adminRest<TeamOwnerRequestRow[]>("team_owner_requests", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(request.id)}`,
        prefer: "return=representation",
        body: {
          status: "rejected",
          rejection_reason: input.rejection_reason?.trim() || null,
          reviewed_by: adminUser.id,
          reviewed_at: new Date().toISOString(),
        },
      }),
    );
    await writeAuditLog({
      actorId: adminUser.id,
      action: "team.owner.request.reject",
      entityType: "team_owner_request",
      entityId: request.id,
      newValue: { name: request.name },
    });
    return { request: updated[0] ?? { ...request, status: "rejected" }, team: null };
  }

  const short_name = await uniqueShortName(request.tournament_id, request.name);
  const created = await createTeamByAdmin(adminUser, {
    name: request.name,
    short_name,
    captain_id: request.requester_id,
  });
  if ("error" in created) {
    return created;
  }

  const { ensureTournamentPlayerForUser } = await import(
    "@/lib/verification/service"
  );
  const player = await ensureTournamentPlayerForUser(request.requester_id);
  if (player) {
    try {
      await withRetry(() =>
        adminRest("team_players", {
          method: "POST",
          prefer: "return=minimal",
          body: [
            {
              team_id: created.team.id,
              player_id: player.id,
              jersey_number: null,
            },
          ],
        }),
      );
    } catch {
      // Already on another squad or duplicate — team still created.
    }
  }

  const updated = await withRetry(() =>
    adminRest<TeamOwnerRequestRow[]>("team_owner_requests", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(request.id)}`,
      prefer: "return=representation",
      body: {
        status: "approved",
        team_id: created.team.id,
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
      },
    }),
  );

  await writeAuditLog({
    actorId: adminUser.id,
    action: "team.owner.request.approve",
    entityType: "team",
    entityId: created.team.id,
    newValue: {
      request_id: request.id,
      name: request.name,
      captain_id: request.requester_id,
    },
  });

  return {
    request: updated[0] ?? { ...request, status: "approved", team_id: created.team.id },
    team: created.team,
  };
}
