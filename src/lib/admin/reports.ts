import "server-only";
import { roleLabel } from "@/lib/auth/permissions";
import { getSquadSize } from "@/lib/settings/app";
import { matchStatusLabel } from "@/lib/matches/labels";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { playerRoleLabel, teamStatusLabel } from "@/lib/teams/labels";
import type {
  MatchStatus,
  PlayerRole,
  TeamRegistrationStatus,
  TshirtSize,
  UserRole,
  VerificationStatus,
} from "@/lib/types/database";
import { verificationStatusLabel } from "@/lib/verification/helpers";
import type {
  AdminReports,
  ReportCount,
  ReportPerson,
} from "@/lib/admin/reports-types";

export type { AdminReports } from "@/lib/admin/reports-types";

const IST = { timeZone: "Asia/Kolkata" } as const;
const ATTENTION_LIMIT = 25;

type UserRow = {
  id: string;
  name: string;
  mobile_number: string;
  role: UserRole;
  verification_status: VerificationStatus;
  last_login_at: string | null;
  created_at: string;
  aadhaar_number: string | null;
  is_active: boolean;
};

type PlayerRow = {
  id: string;
  name: string;
  public_code: string;
  mobile_number: string | null;
  user_id: string | null;
  locked_team_id: string | null;
  photo_url: string | null;
  role: PlayerRole;
  tshirt_size: TshirtSize | null;
  tournament_id: string;
};

type TeamRow = {
  id: string;
  name: string;
  registration_status: TeamRegistrationStatus;
  tournament_id: string;
};

type TeamPlayerRow = {
  team_id: string;
  player_id: string;
};

type MatchRow = {
  status: MatchStatus;
  tournament_id: string;
};

type LoginRow = {
  actor_id: string | null;
  created_at: string;
};

function dateKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-CA", IST);
}

function lastSevenKeys() {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i -= 1) {
    keys.push(dateKey(new Date(now - i * 86_400_000).toISOString()));
  }
  return keys;
}

function formatDay(key: string) {
  const date = new Date(`${key}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...IST,
  });
}

function tally<T>(
  items: T[],
  key: (item: T) => string,
  order?: string[],
): ReportCount[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const label = key(item);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  if (order) {
    return order
      .filter((label) => map.has(label))
      .map((label) => ({ label, value: map.get(label) ?? 0 }));
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function take<T>(items: T[], limit = ATTENTION_LIMIT): T[] {
  return items.slice(0, limit);
}

function personFromUser(
  user: UserRow,
  extra?: { player_id?: string | null; detail?: string; href?: string },
): ReportPerson {
  return {
    name: user.name,
    mobile: user.mobile_number,
    player_id: extra?.player_id ?? null,
    detail: extra?.detail,
    href: extra?.href ?? "/admin/users",
  };
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getAdminReports(): Promise<AdminReports> {
  if (!isSupabaseAdminConfigured()) {
    return emptyReports();
  }

  const [tournamentRows, squad_size, users, allPlayers, allTeams, teamPlayers, allMatches, logins] =
    await Promise.all([
      withRetry(() =>
        adminRest<Array<{ id: string; name: string }>>("tournaments", {
          query: "?is_active=eq.true&select=id,name&limit=1",
        }),
      ),
      getSquadSize(),
      withRetry(() =>
        adminRest<UserRow[]>("users", {
          query:
            "?select=id,name,mobile_number,role,verification_status,last_login_at,created_at,aadhaar_number,is_active&order=created_at.desc&limit=1000",
        }),
      ),
      withRetry(() =>
        adminRest<PlayerRow[]>("players", {
          query:
            "?select=id,name,public_code,mobile_number,user_id,locked_team_id,photo_url,role,tshirt_size,tournament_id&order=public_code.asc&limit=1000",
        }),
      ),
      withRetry(() =>
        adminRest<TeamRow[]>("teams", {
          query:
            "?select=id,name,registration_status,tournament_id&order=name.asc&limit=500",
        }),
      ),
      withRetry(() =>
        adminRest<TeamPlayerRow[]>("team_players", {
          query: "?select=team_id,player_id&limit=2000",
        }),
      ),
      withRetry(() =>
        adminRest<MatchRow[]>("matches", {
          query: "?select=status,tournament_id&limit=1000",
        }),
      ),
      withRetry(() =>
        adminRest<LoginRow[]>("audit_logs", {
          query:
            "?action=eq.auth.login&select=actor_id,created_at&order=created_at.desc&limit=1000",
        }),
      ),
    ]);

  const tournament = tournamentRows[0] ?? null;
  const players = tournament
    ? allPlayers.filter((player) => player.tournament_id === tournament.id)
    : allPlayers;
  const teams = tournament
    ? allTeams.filter((team) => team.tournament_id === tournament.id)
    : allTeams;
  const matches = tournament
    ? allMatches.filter((match) => match.tournament_id === tournament.id)
    : allMatches;

  const userById = new Map(users.map((user) => [user.id, user]));
  const playerByUserSafe = new Map<string, PlayerRow>();
  for (const player of allPlayers) {
    if (!player.user_id || playerByUserSafe.has(player.user_id)) continue;
    playerByUserSafe.set(player.user_id, player);
  }
  if (tournament) {
    for (const player of players) {
      if (player.user_id) playerByUserSafe.set(player.user_id, player);
    }
  }

  const squadByTeam = new Map<string, PlayerRow[]>();
  const playerById = new Map(players.map((player) => [player.id, player]));
  for (const row of teamPlayers) {
    const player = playerById.get(row.player_id);
    if (!player) continue;
    const list = squadByTeam.get(row.team_id) ?? [];
    list.push(player);
    squadByTeam.set(row.team_id, list);
  }
  for (const player of players) {
    if (!player.locked_team_id) continue;
    const list = squadByTeam.get(player.locked_team_id) ?? [];
    if (!list.some((item) => item.id === player.id)) list.push(player);
    squadByTeam.set(player.locked_team_id, list);
  }

  const today = dateKey(new Date().toISOString());
  const weekKeys = lastSevenKeys();
  const weekSet = new Set(weekKeys);
  const loginsThisWeek = logins.filter((row) => weekSet.has(dateKey(row.created_at)));
  const uniqueLoginsToday = new Set(
    logins
      .filter((row) => dateKey(row.created_at) === today && row.actor_id)
      .map((row) => row.actor_id),
  );
  const uniqueLoginsWeek = new Set(
    loginsThisWeek.filter((row) => row.actor_id).map((row) => row.actor_id),
  );

  const verified = users.filter((user) => user.verification_status === "verified");
  const pending = users.filter((user) => user.verification_status === "pending");
  const inSquad = players.filter(
    (player) =>
      player.locked_team_id ||
      teamPlayers.some((row) => row.player_id === player.id),
  );

  const snapshot: ReportCount[] = [
    { label: "Users", value: users.length },
    { label: "Verified", value: verified.length },
    { label: "Pending", value: pending.length },
    { label: "Logged in today", value: uniqueLoginsToday.size },
    { label: "Active this week", value: uniqueLoginsWeek.size },
    { label: "Teams", value: teams.length },
    { label: "Players", value: players.length },
    { label: "In a squad", value: inSquad.length },
  ];

  const signups_7d = weekKeys.map((key) => ({
    label: formatDay(key),
    value: users.filter((user) => dateKey(user.created_at) === key).length,
  }));
  const logins_7d = weekKeys.map((key) => ({
    label: formatDay(key),
    value: new Set(
      logins
        .filter((row) => dateKey(row.created_at) === key && row.actor_id)
        .map((row) => row.actor_id),
    ).size,
  }));

  const neverLoggedIn = users.filter(
    (user) => !user.last_login_at && user.role !== "admin",
  );
  const verifiedNoPlayer = verified.filter((user) => !playerByUserSafe.has(user.id));
  const unlinked = players.filter((player) => !player.user_id);
  const noTeam = players.filter((player) => {
    if (player.locked_team_id) return false;
    return !teamPlayers.some((row) => row.player_id === player.id);
  });
  const noPhoto = players.filter((player) => !player.photo_url);

  const nameGroups = new Map<string, UserRow[]>();
  for (const user of users) {
    const key = normalizeName(user.name);
    if (key.length < 3) continue;
    const list = nameGroups.get(key) ?? [];
    list.push(user);
    nameGroups.set(key, list);
  }

  const short_squads = teams
    .filter((team) => team.registration_status !== "rejected")
    .map((team) => {
      const squad = squadByTeam.get(team.id) ?? [];
      const verifiedCount = squad.filter((player) => {
        if (!player.user_id) return false;
        return userById.get(player.user_id)?.verification_status === "verified";
      }).length;
      return {
        name: team.name,
        status: teamStatusLabel(team.registration_status),
        squad: squad.length,
        verified: verifiedCount,
        needed: squad_size,
        href: "/admin/teams",
      };
    })
    .filter((team) => team.squad < team.needed)
    .sort((a, b) => a.squad - b.squad);

  const unverified_in_squads: ReportPerson[] = [];
  for (const team of teams) {
    if (team.registration_status !== "approved") continue;
    for (const player of squadByTeam.get(team.id) ?? []) {
      const user = player.user_id ? userById.get(player.user_id) : null;
      if (user?.verification_status === "verified") continue;
      unverified_in_squads.push({
        name: player.name,
        mobile: player.mobile_number ?? user?.mobile_number ?? null,
        player_id: player.public_code,
        detail: `${team.name} · ${user ? verificationStatusLabel(user.verification_status) : "Not linked"}`,
        href: "/admin/verifications",
      });
    }
  }

  return {
    tournament_name: tournament?.name ?? null,
    squad_size,
    snapshot,
    verification: tally(
      users,
      (user) => verificationStatusLabel(user.verification_status),
      ["Verified", "Pending verification", "Unverified", "Rejected"],
    ),
    user_roles: tally(users, (user) => roleLabel(user.role)),
    team_status: tally(
      teams,
      (team) => teamStatusLabel(team.registration_status),
      ["Approved", "Pending approval", "Draft", "Rejected"],
    ),
    match_status: tally(matches, (match) => matchStatusLabel(match.status), [
      "Scheduled",
      "Live",
      "Innings break",
      "Completed",
      "Abandoned",
      "Postponed",
      "Cancelled",
    ]),
    player_roles: tally(players, (player) => playerRoleLabel(player.role), [
      "Batsman",
      "Bowler",
      "All-rounder",
      "Wicket-keeper",
    ]),
    tshirts: tally(players, (player) => player.tshirt_size ?? "Not set", [
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      "XXXL",
      "Not set",
    ]),
    signups_7d,
    logins_7d,
    attention: {
      pending_verification: take(
        pending.map((user) =>
          personFromUser(user, {
            player_id: playerByUserSafe.get(user.id)?.public_code ?? null,
            href: "/admin/verifications",
          }),
        ),
      ),
      never_logged_in: take(
        neverLoggedIn.map((user) =>
          personFromUser(user, {
            player_id: playerByUserSafe.get(user.id)?.public_code ?? null,
            detail: verificationStatusLabel(user.verification_status),
          }),
        ),
      ),
      verified_no_player: take(
        verifiedNoPlayer.map((user) =>
          personFromUser(user, { href: "/admin/players" }),
        ),
      ),
      players_unlinked: take(
        unlinked.map((player) => ({
          name: player.name,
          mobile: player.mobile_number,
          player_id: player.public_code,
          href: "/admin/players",
        })),
      ),
      players_no_team: take(
        noTeam.map((player) => ({
          name: player.name,
          mobile: player.mobile_number,
          player_id: player.public_code,
          href: "/admin/players",
        })),
      ),
      players_no_photo: take(
        noPhoto.map((player) => ({
          name: player.name,
          mobile: player.mobile_number,
          player_id: player.public_code,
          href: "/admin/players",
        })),
      ),
      duplicate_names: [...nameGroups.entries()]
        .filter(([, group]) => group.length > 1)
        .map(([, group]) => ({
          name: group[0]?.name ?? "",
          people: group.map((user) =>
            personFromUser(user, {
              player_id: playerByUserSafe.get(user.id)?.public_code ?? null,
              detail: `${user.mobile_number} · ${verificationStatusLabel(user.verification_status)}`,
            }),
          ),
        })),
      short_squads: take(short_squads),
      unverified_in_squads: take(unverified_in_squads),
    },
  };
}

function emptyReports(): AdminReports {
  return {
    tournament_name: null,
    squad_size: 6,
    snapshot: [],
    verification: [],
    user_roles: [],
    team_status: [],
    match_status: [],
    player_roles: [],
    tshirts: [],
    signups_7d: [],
    logins_7d: [],
    attention: {
      pending_verification: [],
      never_logged_in: [],
      verified_no_player: [],
      players_unlinked: [],
      players_no_team: [],
      players_no_photo: [],
      duplicate_names: [],
      short_squads: [],
      unverified_in_squads: [],
    },
  };
}
