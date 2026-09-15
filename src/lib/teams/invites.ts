import "server-only";
import { writeAuditLog } from "@/lib/auth/audit";
import { canAccessAdmin, type SessionUser } from "@/lib/auth/permissions";
import { getSquadSize } from "@/lib/settings/app";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { adminRest, RestError, withRetry } from "@/lib/supabase/rest";
import {
  getTeamById,
  listPlayersByTeam,
} from "@/lib/teams/queries";
import { canManageTeam } from "@/lib/teams/service";
import type { PlayerRow, TeamInviteView, TeamRow } from "@/lib/teams/types";

export type { TeamInviteView } from "@/lib/teams/types";

type InviteRow = {
  id: string;
  team_id: string;
  player_id: string;
  invited_by: string | null;
  status: TeamInviteView["status"];
  created_at: string;
  responded_at: string | null;
};

function inList(ids: string[]): string {
  return ids.join(",");
}

async function hydrateInvites(rows: InviteRow[]): Promise<TeamInviteView[]> {
  if (!rows.length) return [];

  const playerIds = [...new Set(rows.map((r) => r.player_id))];
  const teamIds = [...new Set(rows.map((r) => r.team_id))];
  const inviterIds = [
    ...new Set(
      rows.map((r) => r.invited_by).filter((id): id is string => Boolean(id)),
    ),
  ];

  const [players, teams, inviters] = await Promise.all([
    withRetry(() =>
      adminRest<Array<{ id: string; name: string; public_code: string }>>(
        "players",
        { query: `?id=in.(${inList(playerIds)})&select=id,name,public_code` },
      ),
    ),
    withRetry(() =>
      adminRest<Array<{ id: string; name: string; short_name: string }>>(
        "teams",
        { query: `?id=in.(${inList(teamIds)})&select=id,name,short_name` },
      ),
    ),
    inviterIds.length
      ? withRetry(() =>
          adminRest<Array<{ id: string; name: string }>>("users", {
            query: `?id=in.(${inList(inviterIds)})&select=id,name`,
          }),
        )
      : Promise.resolve([]),
  ]);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const inviterMap = new Map(inviters.map((u) => [u.id, u.name]));

  return rows.flatMap((row) => {
    const player = playerMap.get(row.player_id);
    const team = teamMap.get(row.team_id);
    if (!player || !team) return [];
    return [
      {
        id: row.id,
        team_id: row.team_id,
        team_name: team.name,
        team_short_name: team.short_name,
        player_id: row.player_id,
        player_name: player.name,
        player_code: player.public_code,
        status: row.status,
        created_at: row.created_at,
        invited_by_name: row.invited_by
          ? (inviterMap.get(row.invited_by) ?? null)
          : null,
      },
    ];
  });
}

export async function listPendingInvitesForTeam(
  teamId: string,
): Promise<TeamInviteView[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const rows = await withRetry(() =>
      adminRest<InviteRow[]>("team_invites", {
        query: `?team_id=eq.${encodeURIComponent(teamId)}&status=eq.pending&select=*&order=created_at.asc`,
      }),
    );
    return hydrateInvites(rows);
  } catch {
    return [];
  }
}

export async function listPendingInvitesForUser(
  userId: string,
): Promise<TeamInviteView[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    const players = await withRetry(() =>
      adminRest<Array<{ id: string }>>("players", {
        query: `?user_id=eq.${encodeURIComponent(userId)}&select=id`,
      }),
    );
    if (!players.length) return [];
    const rows = await withRetry(() =>
      adminRest<InviteRow[]>("team_invites", {
        query: `?player_id=in.(${inList(players.map((p) => p.id))})&status=eq.pending&select=*&order=created_at.desc`,
      }),
    );
    return hydrateInvites(rows);
  } catch {
    return [];
  }
}

export async function countPendingInvitesForUser(
  userId: string,
): Promise<number> {
  const invites = await listPendingInvitesForUser(userId);
  return invites.length;
}

async function loadPlayer(playerId: string): Promise<PlayerRow | null> {
  const rows = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?id=eq.${encodeURIComponent(playerId)}&select=*&limit=1`,
    }),
  );
  return rows[0] ?? null;
}

async function assertPlayerCanJoinTeam(
  team: TeamRow,
  player: PlayerRow,
): Promise<{ error: string; status: number } | null> {
  if (player.tournament_id !== team.tournament_id) {
    return { error: "Player is not in this tournament.", status: 400 };
  }
  if (player.locked_team_id && player.locked_team_id !== team.id) {
    return {
      error: "This player is already in an approved team.",
      status: 409,
    };
  }
  if (!player.user_id) {
    return {
      error: "Every player must be linked to a verified user.",
      status: 400,
    };
  }
  const linkedUserId = player.user_id;
  const users = await withRetry(() =>
    adminRest<
      Array<{
        id: string;
        verification_status: string;
        role: string;
        is_active: boolean;
      }>
    >("users", {
      query: `?id=eq.${encodeURIComponent(linkedUserId)}&select=id,verification_status,role,is_active&limit=1`,
    }),
  );
  const user = users[0];
  if (!user || !user.is_active) {
    return { error: "Player account is not active.", status: 400 };
  }
  if (user.verification_status !== "verified") {
    return { error: "Only verified players can join a team.", status: 400 };
  }
  if (user.role === "admin") {
    return { error: "Admin accounts cannot be added to a squad.", status: 400 };
  }
  return null;
}

async function insertMembership(
  teamId: string,
  playerId: string,
  jerseyNumber: number | null,
): Promise<{ error: string; status: number } | null> {
  try {
    await withRetry(() =>
      adminRest("team_players", {
        method: "POST",
        prefer: "return=minimal",
        body: [
          {
            team_id: teamId,
            player_id: playerId,
            jersey_number: jerseyNumber,
          },
        ],
      }),
    );
    return null;
  } catch (err) {
    if (err instanceof RestError && err.status === 409) {
      return {
        error: "This player is already added to this team.",
        status: 400,
      };
    }
    console.error("[invites] insert membership failed:", err);
    return { error: "Could not add player to the squad.", status: 500 };
  }
}

export async function invitePlayerToTeam(
  actor: SessionUser,
  teamId: string,
  playerId: string,
  jerseyNumber?: number | null,
): Promise<
  | {
      auto_joined: boolean;
      players: Awaited<ReturnType<typeof listPlayersByTeam>>;
      invites: TeamInviteView[];
    }
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
  if (team.registration_status === "rejected" && !canAccessAdmin(actor)) {
    return { error: "This team was rejected.", status: 400 };
  }

  const existing = await listPlayersByTeam(teamId);
  if (existing.some((p) => p.id === playerId)) {
    return { error: "This player is already on the squad.", status: 400 };
  }

  const pending = await listPendingInvitesForTeam(teamId);
  if (pending.some((i) => i.player_id === playerId) && !canAccessAdmin(actor)) {
    return {
      error: "An invite is already waiting for this player.",
      status: 400,
    };
  }

  const squadSize = await getSquadSize();
  const occupied = canAccessAdmin(actor)
    ? existing.length
    : existing.length + pending.length;
  if (occupied >= squadSize) {
    return {
      error: `Squad is full. A team can have at most ${squadSize} players${
        canAccessAdmin(actor) ? "" : " (including pending invites)"
      }.`,
      status: 400,
    };
  }

  const player = await loadPlayer(playerId);
  if (!player) return { error: "Player not found.", status: 404 };

  const blocked = await assertPlayerCanJoinTeam(team, player);
  if (blocked) return blocked;

  // Captain adding themselves, or an admin assigning a player, joins immediately.
  if (player.user_id === actor.id || canAccessAdmin(actor)) {
    const inserted = await insertMembership(
      teamId,
      playerId,
      jerseyNumber ?? null,
    );
    if (inserted) return inserted;
    const pendingInvite = pending.find((i) => i.player_id === playerId);
    if (pendingInvite) {
      try {
        await withRetry(() =>
          adminRest("team_invites", {
            method: "PATCH",
            query: `?id=eq.${encodeURIComponent(pendingInvite.id)}`,
            prefer: "return=minimal",
            body: {
              status: "accepted",
              responded_at: new Date().toISOString(),
            },
          }),
        );
      } catch {
        // Invite row is optional.
      }
    }
    await writeAuditLog({
      actorId: actor.id,
      action: "team.invite.auto_joined",
      entityType: "team",
      entityId: teamId,
      newValue: { player_id: playerId },
    });
    return {
      auto_joined: true,
      players: await listPlayersByTeam(teamId),
      invites: await listPendingInvitesForTeam(teamId),
    };
  }

  try {
    await withRetry(() =>
      adminRest("team_invites", {
        method: "POST",
        prefer: "return=minimal",
        body: [
          {
            team_id: teamId,
            player_id: playerId,
            invited_by: actor.id,
            status: "pending",
          },
        ],
      }),
    );
  } catch (err) {
    if (err instanceof RestError && err.status === 409) {
      return {
        error: "An invite is already waiting for this player.",
        status: 400,
      };
    }
    console.error("[invites] create failed:", err);
    if (err instanceof RestError && /team_invites|schema cache|does not exist/i.test(err.message)) {
      return {
        error: "Team invites are not set up yet. Apply the latest database migration and try again.",
        status: 500,
      };
    }
    return { error: "Could not send invite.", status: 500 };
  }

  await writeAuditLog({
    actorId: actor.id,
    action: "team.invite.sent",
    entityType: "team",
    entityId: teamId,
    newValue: { player_id: playerId },
  });

  return {
    auto_joined: false,
    players: existing,
    invites: await listPendingInvitesForTeam(teamId),
  };
}

export async function cancelTeamInvite(
  actor: SessionUser,
  teamId: string,
  inviteId: string,
): Promise<
  | {
      players: Awaited<ReturnType<typeof listPlayersByTeam>>;
      invites: TeamInviteView[];
    }
  | { error: string; status: number }
> {
  const team = await getTeamById(teamId);
  if (!team) return { error: "Team not found.", status: 404 };
  if (!canManageTeam(actor, team)) {
    return { error: "You can only manage your own team.", status: 403 };
  }

  const rows = await withRetry(() =>
    adminRest<InviteRow[]>("team_invites", {
      query: `?id=eq.${encodeURIComponent(inviteId)}&team_id=eq.${encodeURIComponent(teamId)}&select=*&limit=1`,
    }),
  );
  const invite = rows[0];
  if (!invite) return { error: "Invite not found.", status: 404 };
  if (invite.status !== "pending") {
    return { error: "This invite is no longer pending.", status: 400 };
  }

  await withRetry(() =>
    adminRest("team_invites", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(inviteId)}`,
      prefer: "return=minimal",
      body: { status: "cancelled", responded_at: new Date().toISOString() },
    }),
  );

  await writeAuditLog({
    actorId: actor.id,
    action: "team.invite.cancelled",
    entityType: "team",
    entityId: teamId,
    newValue: { invite_id: inviteId, player_id: invite.player_id },
  });

  return {
    players: await listPlayersByTeam(teamId),
    invites: await listPendingInvitesForTeam(teamId),
  };
}

export async function respondToTeamInvite(
  user: SessionUser,
  inviteId: string,
  decision: "accept" | "decline",
): Promise<
  { ok: true; invites: TeamInviteView[] } | { error: string; status: number }
> {
  const rows = await withRetry(() =>
    adminRest<InviteRow[]>("team_invites", {
      query: `?id=eq.${encodeURIComponent(inviteId)}&select=*&limit=1`,
    }),
  );
  const invite = rows[0];
  if (!invite) return { error: "Invite not found.", status: 404 };
  if (invite.status !== "pending") {
    return { error: "This invite is no longer pending.", status: 400 };
  }

  const player = await loadPlayer(invite.player_id);
  if (!player || player.user_id !== user.id) {
    return { error: "This invite is not for your account.", status: 403 };
  }

  if (decision === "decline") {
    await withRetry(() =>
      adminRest("team_invites", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(inviteId)}`,
        prefer: "return=minimal",
        body: { status: "declined", responded_at: new Date().toISOString() },
      }),
    );
    await writeAuditLog({
      actorId: user.id,
      action: "team.invite.declined",
      entityType: "team",
      entityId: invite.team_id,
      newValue: { invite_id: inviteId, player_id: invite.player_id },
    });
    return { ok: true, invites: await listPendingInvitesForUser(user.id) };
  }

  const team = await getTeamById(invite.team_id);
  if (!team) return { error: "Team not found.", status: 404 };
  if (team.registration_status === "rejected") {
    return { error: "This team was rejected.", status: 400 };
  }

  const blocked = await assertPlayerCanJoinTeam(team, player);
  if (blocked) return blocked;

  const roster = await listPlayersByTeam(team.id);
  if (roster.some((p) => p.id === player.id)) {
    await withRetry(() =>
      adminRest("team_invites", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(inviteId)}`,
        prefer: "return=minimal",
        body: { status: "accepted", responded_at: new Date().toISOString() },
      }),
    );
    return { ok: true, invites: await listPendingInvitesForUser(user.id) };
  }

  const squadSize = await getSquadSize();
  if (roster.length >= squadSize) {
    return {
      error:
        "This squad is now full. Ask the captain to send a new invite if a spot opens.",
      status: 409,
    };
  }

  const inserted = await insertMembership(team.id, player.id, null);
  if (inserted) return inserted;

  await withRetry(() =>
    adminRest("team_invites", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(inviteId)}`,
      prefer: "return=minimal",
      body: { status: "accepted", responded_at: new Date().toISOString() },
    }),
  );

  await writeAuditLog({
    actorId: user.id,
    action: "team.invite.accepted",
    entityType: "team",
    entityId: team.id,
    newValue: { invite_id: inviteId, player_id: player.id },
  });

  return { ok: true, invites: await listPendingInvitesForUser(user.id) };
}
