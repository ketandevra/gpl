import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin, type SessionUser } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/auth/audit";
import { getSquadSize } from "@/lib/settings/app";
import { adminRest, adminRpc, RestError, withRetry } from "@/lib/supabase/rest";
import {
  formatApprovalConflicts,
  getActiveTournament,
  getTeamById,
  listPlayersByTeam,
  type PlayerConflict,
  type PlayerRow,
  type TeamPlayerView,
  type TeamRow,
} from "@/lib/teams/queries";
import { formatUnverifiedPlayers } from "@/lib/verification/helpers";

import type {
  adminCreateTeamSchema,
  setTeamRosterSchema,
} from "@/lib/validations/teams";
import type { z } from "zod";

type AdminCreateTeamInput = z.infer<typeof adminCreateTeamSchema>;
type SetRosterInput = z.infer<typeof setTeamRosterSchema>;

type ApproveRpcResult =
  | { ok: true; team_id: string }
  | {
      ok: false;
      error: string;
      conflicts?: PlayerConflict[];
      unverified?: Array<{
        player_id: string;
        public_code: string;
        name: string;
        reason?: string;
      }>;
    };

type RosterRpcResult =
  | { ok: true; team_id: string }
  | {
      ok: false;
      error: string;
      conflicts?: PlayerConflict[];
    };

export function canManageTeam(
  user: SessionUser | null | undefined,
  team: TeamRow,
): boolean {
  if (!user?.is_active) return false;
  if (canAccessAdmin(user)) return true;
  // Captain = manager_id
  return team.manager_id === user.id;
}

/** Admin creates team and assigns captain. Squad is filled by the captain. */
export async function createTeamByAdmin(
  adminUser: SessionUser,
  input: AdminCreateTeamInput,
): Promise<{ team: TeamRow } | { error: string; status: number }> {
  if (!canAccessAdmin(adminUser)) {
    return { error: "Only admins can create teams.", status: 403 };
  }

  const tournament = await getActiveTournament();
  if (!tournament) {
    return { error: "No active tournament found.", status: 400 };
  }

  const captains = await withRetry(() =>
    adminRest<
      Array<{
        id: string;
        name: string;
        role: string;
        is_active: boolean;
        verification_status: string;
      }>
    >("users", {
      query: `?id=eq.${encodeURIComponent(input.captain_id)}&select=id,name,role,is_active,verification_status&limit=1`,
    }),
  );
  const captain = captains[0];
  if (!captain || !captain.is_active) {
    return { error: "Captain user not found or inactive.", status: 400 };
  }
  if (captain.verification_status !== "verified") {
    return {
      error: "Only verified users can be assigned as captain.",
      status: 400,
    };
  }

  // One captaincy per tournament (pending/approved)
  const existing = await withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query: `?manager_id=eq.${encodeURIComponent(captain.id)}&tournament_id=eq.${encodeURIComponent(tournament.id)}&registration_status=in.(pending,approved)&select=id,name`,
    }),
  );
  if (existing.length > 0) {
    return {
      error: `${captain.name} is already captain of “${existing[0]!.name}”.`,
      status: 409,
    };
  }

  try {
    const created = await withRetry(() =>
      adminRest<TeamRow[]>("teams", {
        method: "POST",
        prefer: "return=representation",
        body: [
          {
            tournament_id: tournament.id,
            name: input.name,
            short_name: input.short_name,
            manager_id: captain.id,
            registration_status: "pending",
            approved: false,
          },
        ],
      }),
    );

    const team = created[0];
    if (!team) {
      return { error: "Could not create team.", status: 500 };
    }

    if (captain.role === "viewer") {
      await withRetry(() =>
        adminRest("users", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(captain.id)}`,
          prefer: "return=minimal",
          body: { role: "team_manager" },
        }),
      );
    }

    await writeAuditLog({
      actorId: adminUser.id,
      action: "team.create",
      entityType: "team",
      entityId: team.id,
      newValue: {
        name: team.name,
        captain_id: captain.id,
      },
    });

    return { team };
  } catch (err) {
    if (err instanceof RestError && err.status === 409) {
      return {
        error: "A team with that name or short name already exists.",
        status: 409,
      };
    }
    console.error("[teams] admin create failed:", err);
    return { error: "Could not create team.", status: 500 };
  }
}

export async function approveTeam(
  adminUser: SessionUser,
  teamId: string,
): Promise<{ team: TeamRow } | { error: string; status: number }> {
  const currentPlayers = await listPlayersByTeam(teamId);
  const squadSize = await getSquadSize();
  if (currentPlayers.length !== squadSize) {
    return {
      error: `Team must have exactly ${squadSize} players before approval (currently ${currentPlayers.length}).`,
      status: 400,
    };
  }

  try {
    const result = await withRetry(() =>
      adminRpc<ApproveRpcResult>("approve_team", { p_team_id: teamId }),
    );

    if (!result.ok) {
      if (result.error === "conflict" && result.conflicts?.length) {
        return {
          error: formatApprovalConflicts(result.conflicts),
          status: 409,
        };
      }
      if (result.error === "unverified" && "unverified" in result) {
        const rows = (result as { unverified?: Array<{ public_code: string; name: string; reason?: string }> }).unverified ?? [];
        return {
          error: formatUnverifiedPlayers(rows),
          status: 409,
        };
      }
      return { error: result.error || "Could not approve team.", status: 400 };
    }

    const team = await getTeamById(teamId);
    if (!team) {
      return { error: "Team not found after approval.", status: 500 };
    }

    await writeAuditLog({
      actorId: adminUser.id,
      action: "team.approve",
      entityType: "team",
      entityId: teamId,
      newValue: { approved: true, registration_status: "approved" },
    });

    return { team };
  } catch (err) {
    console.error("[teams] approve failed:", err);
    return { error: "Could not approve team.", status: 500 };
  }
}

export async function rejectTeam(
  adminUser: SessionUser,
  teamId: string,
): Promise<{ team: TeamRow } | { error: string; status: number }> {
  try {
    const updated = await withRetry(() =>
      adminRest<TeamRow[]>("teams", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(teamId)}`,
        prefer: "return=representation",
        body: { approved: false, registration_status: "rejected" },
      }),
    );
    const team = updated[0];
    if (!team) return { error: "Team not found.", status: 404 };

    await writeAuditLog({
      actorId: adminUser.id,
      action: "team.reject",
      entityType: "team",
      entityId: teamId,
      newValue: { approved: false, registration_status: "rejected" },
    });

    return { team };
  } catch (err) {
    console.error("[teams] reject failed:", err);
    return { error: "Could not reject team.", status: 500 };
  }
}

export async function setTeamRoster(
  actor: SessionUser,
  teamId: string,
  input: SetRosterInput,
): Promise<
  | { team: TeamRow; players: TeamPlayerView[] }
  | { error: string; status: number }
> {
  const team = await getTeamById(teamId);
  if (!team) return { error: "Team not found.", status: 404 };

  if (!canManageTeam(actor, team)) {
    return { error: "You can only manage your own team.", status: 403 };
  }

  // Non-admins cannot edit approved teams
  if (team.approved && !canAccessAdmin(actor)) {
    return {
      error: "Approved teams can only be edited by an admin.",
      status: 403,
    };
  }

  const playerIds = input.members.map((m) => m.player_id);
  if (new Set(playerIds).size !== playerIds.length) {
    return {
      error: "This player is already added to this team.",
      status: 400,
    };
  }

  const squadSize = await getSquadSize();
  if (playerIds.length > squadSize) {
    return {
      error: `A team can have at most ${squadSize} players.`,
      status: 400,
    };
  }

  // Soft check: only verified linked users
  if (playerIds.length) {
    const pool = await withRetry(() =>
      adminRest<PlayerRow[]>("players", {
        query: `?id=in.(${playerIds.join(",")})&select=*`,
      }),
    );
    if (pool.length !== playerIds.length) {
      return { error: "One or more players are invalid.", status: 400 };
    }
    const locked = pool.filter(
      (p) => p.locked_team_id && p.locked_team_id !== teamId,
    );
    if (locked.length) {
      return {
        error: `Cannot add player(s) already in an approved team: ${locked
          .map((p) => `${p.public_code} — ${p.name}`)
          .join(", ")}`,
        status: 409,
      };
    }
    const userIds = pool
      .map((p) => p.user_id)
      .filter((id): id is string => Boolean(id));
    if (userIds.length !== pool.length) {
      return {
        error: "Every player must be linked to a verified user.",
        status: 400,
      };
    }
    const verified = await withRetry(() =>
      adminRest<Array<{ id: string; role: string }>>("users", {
        query: `?id=in.(${userIds.join(",")})&verification_status=eq.verified&role=neq.admin&select=id,role`,
      }),
    );
    if (verified.length !== userIds.length) {
      return {
        error: "Only verified non-admin users can be added to a team.",
        status: 400,
      };
    }
  }

  const previous = await listPlayersByTeam(teamId);

  try {
    const result = await withRetry(() =>
      adminRpc<RosterRpcResult>("set_team_roster", {
        p_team_id: teamId,
        p_members: input.members,
      }),
    );

    if (!result.ok) {
      if (result.error === "conflict" && result.conflicts?.length) {
        return {
          error: formatApprovalConflicts(result.conflicts),
          status: 409,
        };
      }
      if (result.error.includes("already added")) {
        return { error: result.error, status: 400 };
      }
      return { error: result.error || "Could not update roster.", status: 400 };
    }

    await writeAuditLog({
      actorId: actor.id,
      action: team.approved ? "team.roster.edit_approved" : "team.roster.edit",
      entityType: "team",
      entityId: teamId,
      previousValue: {
        player_ids: previous.map((p) => p.id),
      },
      newValue: {
        player_ids: playerIds,
      },
    });

    const players = await listPlayersByTeam(teamId);
    const refreshed = await getTeamById(teamId);
    return { team: refreshed!, players };
  } catch (err) {
    console.error("[teams] set roster failed:", err);
    return { error: "Could not update roster.", status: 500 };
  }
}

export async function createTournamentPlayer(
  adminUser: SessionUser,
  input: {
    name: string;
    mobile_number?: string | null;
    role?: string;
    batting_style?: string | null;
    bowling_style?: string | null;
  },
): Promise<{ player: PlayerRow } | { error: string; status: number }> {
  if (!canAccessAdmin(adminUser)) {
    return { error: "Forbidden.", status: 403 };
  }
  const tournament = await getActiveTournament();
  if (!tournament) {
    return { error: "No active tournament.", status: 400 };
  }

  try {
    const existing = await withRetry(() =>
      adminRest<Array<{ public_code: string }>>("players", {
        query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&select=public_code&order=public_code.desc&limit=50`,
      }),
    );
    let max = 0;
    for (const row of existing) {
      const m = /^P(\d+)$/i.exec(row.public_code);
      if (m) max = Math.max(max, Number(m[1]));
    }
    const public_code = `P${String(max + 1).padStart(3, "0")}`;

    const created = await withRetry(() =>
      adminRest<PlayerRow[]>("players", {
        method: "POST",
        prefer: "return=representation",
        body: [
          {
            tournament_id: tournament.id,
            public_code,
            name: input.name,
            mobile_number: input.mobile_number ?? null,
            role: input.role ?? "batsman",
            batting_style: input.batting_style ?? null,
            bowling_style: input.bowling_style ?? null,
            locked_team_id: null,
          },
        ],
      }),
    );

    const player = created[0];
    if (!player) return { error: "Could not create player.", status: 500 };

    await writeAuditLog({
      actorId: adminUser.id,
      action: "player.create",
      entityType: "player",
      entityId: player.id,
      newValue: { public_code, name: player.name },
    });

    return { player };
  } catch (err) {
    console.error("[players] create failed:", err);
    return { error: "Could not create player.", status: 500 };
  }
}

export async function requireTeamManagerOrAdmin(teamId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in.", status: 401 as const };
  }
  const team = await getTeamById(teamId);
  if (!team) {
    return { error: "Team not found.", status: 404 as const };
  }
  if (!canManageTeam(user, team)) {
    return { error: "You can only manage your own team.", status: 403 as const };
  }
  return { user, team };
}

export async function removeTeamPlayer(
  actor: SessionUser,
  teamId: string,
  playerId: string,
): Promise<
  | { team: TeamRow; players: TeamPlayerView[] }
  | { error: string; status: number }
> {
  const team = await getTeamById(teamId);
  if (!team) return { error: "Team not found.", status: 404 };

  if (!canManageTeam(actor, team)) {
    return { error: "You can only manage your own team.", status: 403 };
  }

  if (team.approved && !canAccessAdmin(actor)) {
    return {
      error: "Approved teams can only be edited by an admin.",
      status: 403,
    };
  }

  await withRetry(() =>
    adminRest("team_players", {
      method: "DELETE",
      query: `?team_id=eq.${encodeURIComponent(teamId)}&player_id=eq.${encodeURIComponent(playerId)}`,
    }),
  );

  await writeAuditLog({
    actorId: actor.id,
    action: "team.roster.remove",
    entityType: "team",
    entityId: teamId,
    newValue: { removed_player_id: playerId },
  });

  const players = await listPlayersByTeam(teamId);
  const refreshed = await getTeamById(teamId);
  return { team: refreshed!, players };
}
