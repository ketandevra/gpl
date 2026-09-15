import "server-only";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { TeamRegistrationStatus } from "@/lib/types/database";
import {
  formatPlayerLabel,
  playerAvailabilityLabel,
  playerRoleLabel,
  teamStatusLabel,
} from "@/lib/teams/labels";
import type {
  ActiveTournament,
  PlayerAvailability,
  PlayerConflict,
  PlayerRow,
  TeamPlayerView,
  TeamRow,
} from "@/lib/teams/types";

export type {
  ActiveTournament,
  PlayerAvailability,
  PlayerConflict,
  PlayerRow,
  TeamPlayerView,
  TeamRow,
} from "@/lib/teams/types";

export {
  formatPlayerLabel,
  playerAvailabilityLabel,
  playerRoleLabel,
  teamStatusLabel,
};

export function formatApprovalConflicts(conflicts: PlayerConflict[]): string {
  const lines = conflicts.map(
    (c) => `${c.public_code} — ${c.name} → ${c.team_name}`,
  );
  return [
    "Cannot approve this team.",
    "",
    "The following player(s) are already registered in an approved team:",
    "",
    ...lines,
    "",
    "Please remove the conflicting player(s) before approving.",
  ].join("\n");
}

export async function getActiveTournament(): Promise<ActiveTournament | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<ActiveTournament[]>("tournaments", {
      query:
        "?is_active=eq.true&select=id,name,registration_open,status&limit=1",
    }),
  );
  return rows[0] ?? null;
}

/** Active tournament, or the most recently created one if none is marked active. */
export async function getPrimaryTournament(): Promise<ActiveTournament | null> {
  const active = await getActiveTournament();
  if (active) return active;
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<ActiveTournament[]>("tournaments", {
      query:
        "?select=id,name,registration_open,status&order=created_at.desc&limit=1",
    }),
  );
  return rows[0] ?? null;
}

async function attachUserAvatars<
  T extends { user_id: string | null; photo_url: string | null },
>(rows: T[]): Promise<Array<T & { avatar_url: string | null }>> {
  const withAvatars = rows.map((row) => ({
    ...row,
    avatar_url: row.photo_url,
  }));
  const userIds = [
    ...new Set(
      rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!userIds.length) return withAvatars;

  const users = await withRetry(() =>
    adminRest<Array<{ id: string; avatar_url: string | null }>>("users", {
      query: `?id=in.(${userIds.join(",")})&select=id,avatar_url`,
    }),
  );
  const avatarByUser = new Map(users.map((u) => [u.id, u.avatar_url]));
  for (const row of withAvatars) {
    if (row.user_id) {
      row.avatar_url = avatarByUser.get(row.user_id) ?? row.photo_url ?? null;
    }
  }
  return withAvatars;
}

export async function listApprovedTeams(): Promise<TeamRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query:
        "?approved=eq.true&registration_status=eq.approved&select=*&order=name.asc",
    }),
  );
}

/** Pending + approved teams for the public teams page (excludes rejected). */
export async function listPublicTeams(
  tournamentId?: string | null,
): Promise<TeamRow[]> {
  if (!isSupabaseAdminConfigured() || !tournamentId) return [];
  const tournamentFilter = `&tournament_id=eq.${encodeURIComponent(tournamentId)}`;
  return withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query: `?registration_status=in.(pending,approved)${tournamentFilter}&select=*&order=name.asc`,
    }),
  );
}

export async function listAllTeams(): Promise<TeamRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query: "?select=*&order=created_at.desc",
    }),
  );
}

/** Teams where this user is captain (manager_id). */
export async function listTeamsForCaptain(userId: string): Promise<TeamRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query: `?manager_id=eq.${encodeURIComponent(userId)}&registration_status=in.(pending,approved)&select=*&order=created_at.desc`,
    }),
  );
}

export async function getTeamById(id: string): Promise<TeamRow | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<TeamRow[]>("teams", {
      query: `?id=eq.${encodeURIComponent(id)}&select=*`,
    }),
  );
  return rows[0] ?? null;
}

async function loadTeamNameMap(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const teams = await withRetry(() =>
    adminRest<Array<{ id: string; name: string }>>("teams", {
      query: `?id=in.(${unique.join(",")})&select=id,name`,
    }),
  );
  return new Map(teams.map((t) => [t.id, t.name]));
}

type MembershipRow = {
  id: string;
  team_id: string;
  player_id: string;
  jersey_number: number | null;
};

export async function listPlayersByTeam(
  teamId: string,
): Promise<TeamPlayerView[]> {
  if (!isSupabaseAdminConfigured()) return [];

  const memberships = await withRetry(() =>
    adminRest<MembershipRow[]>("team_players", {
      query: `?team_id=eq.${encodeURIComponent(teamId)}&select=id,team_id,player_id,jersey_number`,
    }),
  );
  if (!memberships.length) return [];

  const playerIds = memberships.map((m) => m.player_id);
  const players = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?id=in.(${playerIds.join(",")})&select=*`,
    }),
  );
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const lockedIds = players
    .map((p) => p.locked_team_id)
    .filter((id): id is string => Boolean(id));
  const lockedNames = await loadTeamNameMap(lockedIds);

  // Pending elsewhere: other team_players for these players on non-approved teams
  const otherMemberships = await withRetry(() =>
    adminRest<Array<{ team_id: string; player_id: string }>>("team_players", {
      query: `?player_id=in.(${playerIds.join(",")})&team_id=neq.${encodeURIComponent(teamId)}&select=team_id,player_id`,
    }),
  );
  const otherTeamIds = [...new Set(otherMemberships.map((m) => m.team_id))];
  const otherTeams = otherTeamIds.length
    ? await withRetry(() =>
        adminRest<TeamRow[]>("teams", {
          query: `?id=in.(${otherTeamIds.join(",")})&select=*`,
        }),
      )
    : [];
  const otherTeamMap = new Map(otherTeams.map((t) => [t.id, t]));

  const pendingByPlayer = new Map<string, string[]>();
  for (const m of otherMemberships) {
    const team = otherTeamMap.get(m.team_id);
    if (!team || team.approved) continue;
    const list = pendingByPlayer.get(m.player_id) ?? [];
    list.push(team.name);
    pendingByPlayer.set(m.player_id, list);
  }

  const views: TeamPlayerView[] = [];
  for (const m of memberships) {
    const player = playerMap.get(m.player_id);
    if (!player) continue;
    views.push({
      ...player,
      team_id: teamId,
      jersey_number: m.jersey_number,
      membership_id: m.id,
      locked_team_name: player.locked_team_id
        ? lockedNames.get(player.locked_team_id) ?? null
        : null,
      pending_other_team_names: pendingByPlayer.get(player.id) ?? [],
      avatar_url: player.photo_url,
    });
  }

  views.sort((a, b) => {
    const ja = a.jersey_number ?? 9999;
    const jb = b.jersey_number ?? 9999;
    if (ja !== jb) return ja - jb;
    return a.name.localeCompare(b.name);
  });

  return attachUserAvatars(views);
}

export async function listTournamentPlayers(
  tournamentId: string,
): Promise<Array<PlayerRow & { avatar_url: string | null }>> {
  if (!isSupabaseAdminConfigured()) return [];
  const players = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=*&order=public_code.asc`,
    }),
  );
  return attachUserAvatars(players);
}

function postgrestIlike(value: string): string | null {
  const cleaned = value.replace(/[,()*]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return encodeURIComponent(`*${cleaned}*`);
}

/**
 * Server-side search of VERIFIED users only for team registration.
 * Never returns unverified / pending / rejected identities.
 */
export async function searchVerifiedPlayersForPicker(
  tournamentId: string,
  options?: { q?: string; excludeTeamId?: string; limit?: number },
): Promise<
  Array<
    PlayerRow & {
      availability: PlayerAvailability;
      locked_team_name: string | null;
      pending_other_team_names: string[];
    }
  >
> {
  if (!isSupabaseAdminConfigured()) return [];
  const limit = options?.limit ?? 40;
  const q = (options?.q ?? "").trim();
  const like = q ? postgrestIlike(q) : null;

  type VerifiedUser = { id: string; name: string; mobile_number: string };
  let verifiedUsers: VerifiedUser[] = [];

  if (like) {
    verifiedUsers = await withRetry(() =>
      adminRest<VerifiedUser[]>("users", {
        query: `?verification_status=eq.verified&is_active=eq.true&role=neq.admin&or=(name.ilike.${like},mobile_number.ilike.${like})&select=id,name,mobile_number&limit=${limit}`,
      }),
    );

    // Also match Player ID (public_code) then keep only verified linked users
    const byCode = await withRetry(() =>
      adminRest<PlayerRow[]>("players", {
        query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&public_code=ilike.${like}&select=*&limit=${limit}`,
      }),
    );
    const userIds = [
      ...new Set(
        byCode.map((p) => p.user_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    if (userIds.length) {
      const linked = await withRetry(() =>
        adminRest<VerifiedUser[]>("users", {
          query: `?id=in.(${userIds.join(",")})&verification_status=eq.verified&is_active=eq.true&role=neq.admin&select=id,name,mobile_number`,
        }),
      );
      const seen = new Set(verifiedUsers.map((u) => u.id));
      for (const u of linked) {
        if (!seen.has(u.id)) verifiedUsers.push(u);
      }
    }
  } else {
    verifiedUsers = await withRetry(() =>
      adminRest<VerifiedUser[]>("users", {
        query: `?verification_status=eq.verified&is_active=eq.true&role=neq.admin&select=id,name,mobile_number&order=name.asc&limit=${limit}`,
      }),
    );
  }

  if (!verifiedUsers.length) return [];

  const userIds = verifiedUsers.map((u) => u.id);
  let players = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&user_id=in.(${userIds.join(",")})&select=*`,
    }),
  );

  // Player rows are created when admin verifies the user.
  players = players.slice(0, limit);
  if (!players.length) return [];

  const lockedNames = await loadTeamNameMap(
    players.map((p) => p.locked_team_id).filter((id): id is string => Boolean(id)),
  );

  const memberships = await withRetry(() =>
    adminRest<Array<{ team_id: string; player_id: string }>>("team_players", {
      query: `?player_id=in.(${players.map((p) => p.id).join(",")})&select=team_id,player_id`,
    }),
  );
  const invitedHere = new Set<string>();
  const excludeTeamId = options?.excludeTeamId;
  if (excludeTeamId) {
    try {
      const pendingHere = await withRetry(() =>
        adminRest<Array<{ player_id: string }>>("team_invites", {
          query: `?team_id=eq.${encodeURIComponent(excludeTeamId)}&status=eq.pending&select=player_id`,
        }),
      );
      for (const row of pendingHere) invitedHere.add(row.player_id);
    } catch {
      // Table may not exist until the invite migration is applied.
    }
  }
  const teamIds = [...new Set(memberships.map((m) => m.team_id))];
  const teams = teamIds.length
    ? await withRetry(() =>
        adminRest<TeamRow[]>("teams", {
          query: `?id=in.(${teamIds.join(",")})&select=*`,
        }),
      )
    : [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const pendingByPlayer = new Map<string, string[]>();
  for (const m of memberships) {
    if (options?.excludeTeamId && m.team_id === options.excludeTeamId) continue;
    const team = teamMap.get(m.team_id);
    if (!team || team.approved) continue;
    const list = pendingByPlayer.get(m.player_id) ?? [];
    list.push(team.name);
    pendingByPlayer.set(m.player_id, list);
  }

  return players.map((p) => {
    const locked_team_name = p.locked_team_id
      ? lockedNames.get(p.locked_team_id) ?? null
      : null;
    const pending_other_team_names = pendingByPlayer.get(p.id) ?? [];
    let availability: PlayerAvailability;
    if (p.locked_team_id) {
      availability = {
        status: "locked",
        label: `Already in approved team${locked_team_name ? `: ${locked_team_name}` : ""}`,
        locked_team_name,
        pending_other_team_names,
      };
    } else if (invitedHere.has(p.id)) {
      availability = {
        status: "invited",
        label: "Invite already sent — waiting for them to accept",
        locked_team_name: null,
        pending_other_team_names,
      };
    } else if (pending_other_team_names.length) {
      availability = {
        status: "pending_elsewhere",
        label: `Also in pending: ${pending_other_team_names.join(", ")}`,
        locked_team_name: null,
        pending_other_team_names,
      };
    } else {
      availability = {
        status: "available",
        label: "Available",
        locked_team_name: null,
        pending_other_team_names: [],
      };
    }
    return {
      ...p,
      mobile_number: null,
      availability,
      locked_team_name,
      pending_other_team_names,
    };
  });
}

/** All verified players in the tournament, including those not yet in a squad. */
export async function listPublicPlayers(
  tournamentId?: string | null,
): Promise<
  Array<
    PlayerRow & {
      avatar_url: string | null;
      team_name?: string;
      team_status?: TeamRegistrationStatus;
    }
  >
> {
  if (!isSupabaseAdminConfigured() || !tournamentId) return [];

  const players = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&user_id=not.is.null&select=*&order=public_code.asc`,
    }),
  );
  if (!players.length) return [];

  const userIds = [
    ...new Set(
      players.map((p) => p.user_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const verified = await withRetry(() =>
    adminRest<Array<{ id: string }>>("users", {
      query: `?id=in.(${userIds.join(",")})&verification_status=eq.verified&is_active=eq.true&role=neq.admin&select=id`,
    }),
  );
  const verifiedIds = new Set(verified.map((u) => u.id));
  const verifiedPlayers = players.filter(
    (p) => p.user_id && verifiedIds.has(p.user_id),
  );
  if (!verifiedPlayers.length) return [];

  const memberships = await withRetry(() =>
    adminRest<Array<{ player_id: string; team_id: string }>>("team_players", {
      query: `?player_id=in.(${verifiedPlayers.map((p) => p.id).join(",")})&select=player_id,team_id`,
    }),
  );
  const teamIds = [...new Set(memberships.map((m) => m.team_id))];
  const teams = teamIds.length
    ? await withRetry(() =>
        adminRest<
          Array<{
            id: string;
            name: string;
            registration_status: TeamRegistrationStatus;
          }>
        >("teams", {
          query: `?id=in.(${teamIds.join(",")})&registration_status=in.(pending,approved)&select=id,name,registration_status`,
        }),
      )
    : [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const teamByPlayer = new Map<
    string,
    { name: string; status: TeamRegistrationStatus }
  >();
  for (const membership of memberships) {
    const team = teamMap.get(membership.team_id);
    if (!team) continue;
    const current = teamByPlayer.get(membership.player_id);
    if (
      !current ||
      (team.registration_status === "approved" &&
        current.status !== "approved")
    ) {
      teamByPlayer.set(membership.player_id, {
        name: team.name,
        status: team.registration_status,
      });
    }
  }

  const rows = verifiedPlayers.map((player) => {
    const team = teamByPlayer.get(player.id);
    return {
      ...player,
      team_name: team?.name,
      team_status: team?.status,
      avatar_url: player.photo_url,
    };
  });
  const withAvatars = await attachUserAvatars(rows);
  withAvatars.sort((a, b) => {
    const numA = Number(/^P(\d+)$/i.exec(a.public_code)?.[1] ?? NaN);
    const numB = Number(/^P(\d+)$/i.exec(b.public_code)?.[1] ?? NaN);
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.public_code.localeCompare(b.public_code, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
  return withAvatars;
}

export async function getPlayerById(id: string): Promise<PlayerRow | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?id=eq.${encodeURIComponent(id)}&select=*`,
    }),
  );
  return rows[0] ?? null;
}

export async function getManagerName(
  managerId: string | null,
): Promise<string | null> {
  if (!managerId || !isSupabaseAdminConfigured()) return null;
  const rows = await withRetry(() =>
    adminRest<Array<{ name: string }>>("users", {
      query: `?id=eq.${encodeURIComponent(managerId)}&select=name`,
    }),
  );
  return rows[0]?.name ?? null;
}
