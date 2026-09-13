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
    });
  }

  views.sort((a, b) => {
    const ja = a.jersey_number ?? 9999;
    const jb = b.jersey_number ?? 9999;
    if (ja !== jb) return ja - jb;
    return a.name.localeCompare(b.name);
  });

  return views;
}

export async function listTournamentPlayers(
  tournamentId: string,
): Promise<PlayerRow[]> {
  if (!isSupabaseAdminConfigured()) return [];
  return withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&select=*&order=public_code.asc`,
    }),
  );
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

  type VerifiedUser = { id: string; name: string; mobile_number: string };
  let verifiedUsers: VerifiedUser[] = [];

  if (q) {
    const encoded = encodeURIComponent(`*${q}*`);
    verifiedUsers = await withRetry(() =>
      adminRest<VerifiedUser[]>("users", {
        query: `?verification_status=eq.verified&is_active=eq.true&role=neq.admin&or=(name.ilike.${encoded},mobile_number.ilike.${encoded})&select=id,name,mobile_number&limit=${limit}`,
      }),
    );

    // Also match Player ID (public_code) then keep only verified linked users
    const byCode = await withRetry(() =>
      adminRest<PlayerRow[]>("players", {
        query: `?tournament_id=eq.${encodeURIComponent(tournamentId)}&public_code=ilike.${encodeURIComponent(`*${q}*`)}&select=*&limit=${limit}`,
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

  // Missing player rows are provisioned by /api/players (server route), not here.
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

function preferPublicPlayerRow<
  T extends { team_id: string; team_status: TeamRegistrationStatus; locked_team_id: string | null },
>(candidate: T, current: T): T {
  const candidateApproved = candidate.team_status === "approved";
  const currentApproved = current.team_status === "approved";
  if (candidateApproved !== currentApproved) {
    return candidateApproved ? candidate : current;
  }
  if (candidate.locked_team_id) {
    if (candidate.team_id === candidate.locked_team_id) return candidate;
    if (current.team_id === current.locked_team_id) return current;
  }
  return current;
}

/** Players on pending + approved teams for the public players page. */
export async function listPublicPlayers(
  tournamentId?: string | null,
): Promise<
  Array<
    TeamPlayerView & {
      team_name: string;
      team_short_name: string;
      team_status: TeamRegistrationStatus;
      avatar_url: string | null;
    }
  >
> {
  if (!isSupabaseAdminConfigured() || !tournamentId) return [];
  const teams = await listPublicTeams(tournamentId);
  if (!teams.length) return [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  type PublicPlayerRow = TeamPlayerView & {
    team_name: string;
    team_short_name: string;
    team_status: TeamRegistrationStatus;
    avatar_url: string | null;
  };

  const byPlayerId = new Map<string, PublicPlayerRow>();
  for (const team of teams) {
    const players = await listPlayersByTeam(team.id);
    for (const p of players) {
      const t = teamMap.get(team.id);
      const row: PublicPlayerRow = {
        ...p,
        team_name: t?.name ?? "Team",
        team_short_name: t?.short_name ?? "T",
        team_status: t?.registration_status ?? "pending",
        avatar_url: null,
      };
      const existing = byPlayerId.get(p.id);
      if (!existing || preferPublicPlayerRow(row, existing) === row) {
        byPlayerId.set(p.id, row);
      }
    }
  }
  const results = [...byPlayerId.values()];

  const userIds = [
    ...new Set(
      results
        .map((p) => p.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (userIds.length) {
    const users = await withRetry(() =>
      adminRest<Array<{ id: string; avatar_url: string | null }>>("users", {
        query: `?id=in.(${userIds.join(",")})&select=id,avatar_url`,
      }),
    );
    const avatarByUser = new Map(users.map((u) => [u.id, u.avatar_url]));
    for (const row of results) {
      if (row.user_id) {
        row.avatar_url =
          avatarByUser.get(row.user_id) ?? row.photo_url ?? null;
      } else {
        row.avatar_url = row.photo_url;
      }
    }
  } else {
    for (const row of results) {
      row.avatar_url = row.photo_url;
    }
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
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
