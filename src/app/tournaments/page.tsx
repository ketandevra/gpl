import { TournamentsHub } from "@/components/tournaments/TournamentsHub";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getPendingOwnerRequestForUser } from "@/lib/teams/owner-requests";
import {
  getManagerName,
  listPlayersByTeam,
  listPublicTeams,
  listTeamsForCaptain,
} from "@/lib/teams/queries";
import { listAllTournaments } from "@/lib/tournaments/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Tournaments" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tab?: string; requested?: string }>;
};

async function enrichTeams(
  teams: Awaited<ReturnType<typeof listPublicTeams>>,
) {
  return Promise.all(
    teams.map(async (team) => {
      const approved = team.registration_status === "approved";
      const [manager_name, players] = await Promise.all([
        getManagerName(team.manager_id),
        approved ? listPlayersByTeam(team.id) : Promise.resolve([]),
      ]);
      return {
        ...team,
        manager_name,
        player_count: approved ? players.length : undefined,
      };
    }),
  );
}

export default async function TournamentsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const initialTab = query.tab === "past" ? "past" : "current";

  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[#3e2723]">Tournaments</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load tournaments.
        </p>
      </div>
    );
  }

  const [tournaments, user] = await Promise.all([
    listAllTournaments(),
    getCurrentUser(),
  ]);
  const active = tournaments.find((row) => row.is_active) ?? null;

  const [teamGroups, myTeams, pendingRequest] = await Promise.all([
    Promise.all(
      tournaments.map(async (tournament) => ({
        tournament,
        teams: await enrichTeams(await listPublicTeams(tournament.id)),
      })),
    ),
    user && !canAccessAdmin(user)
      ? listTeamsForCaptain(user.id)
      : Promise.resolve([]),
    user && active && !canAccessAdmin(user)
      ? getPendingOwnerRequestForUser(user.id, active.id)
      : Promise.resolve(null),
  ]);

  const myCards = await Promise.all(
    myTeams.map(async (team) => {
      const players = await listPlayersByTeam(team.id);
      return {
        ...team,
        manager_name: user?.name ?? null,
        player_count: players.length,
      };
    }),
  );

  const current = teamGroups.filter((block) =>
    ["ongoing", "upcoming"].includes(block.tournament.status),
  );
  const past = teamGroups.filter(
    (block) => block.tournament.status === "completed",
  );

  const canRequestOwner =
    Boolean(user) &&
    !canAccessAdmin(user) &&
    myTeams.length === 0 &&
    !pendingRequest;

  const requestedNotice =
    query.requested || pendingRequest
      ? `Your request${pendingRequest ? ` for “${pendingRequest.name}”` : ""} is waiting for admin approval.`
      : null;

  return (
    <TournamentsHub
      current={current}
      past={past}
      myTeams={myCards}
      canCreateAdmin={canAccessAdmin(user)}
      canRequestOwner={canRequestOwner}
      signedIn={Boolean(user)}
      verified={user?.verification_status === "verified"}
      requestedNotice={requestedNotice}
      initialTab={initialTab}
    />
  );
}
