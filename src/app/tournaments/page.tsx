import { TournamentsHub } from "@/components/tournaments/TournamentsHub";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getPendingOwnerRequestForUser } from "@/lib/teams/owner-requests";
import { listPublicTeamCards, listTeamsForCaptain } from "@/lib/teams/queries";
import { listAllTournaments } from "@/lib/tournaments/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Tournaments" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tab?: string; requested?: string }>;
};

export default async function TournamentsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const initialTab = query.tab === "past" ? "past" : "current";

  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="page max-w-3xl">
        <h1 className="page-title">Tournaments</h1>
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

  const [cards, myTeams, pendingRequest] = await Promise.all([
    listPublicTeamCards(tournaments.map((row) => row.id)),
    user && !canAccessAdmin(user)
      ? listTeamsForCaptain(user.id)
      : Promise.resolve([]),
    user && active && !canAccessAdmin(user)
      ? getPendingOwnerRequestForUser(user.id, active.id)
      : Promise.resolve(null),
  ]);

  const cardsByTournament = new Map<string, typeof cards>();
  for (const card of cards) {
    const list = cardsByTournament.get(card.tournament_id) ?? [];
    list.push(card);
    cardsByTournament.set(card.tournament_id, list);
  }

  const myCards = myTeams.map((team) => {
    const match = cards.find((card) => card.id === team.id);
    return {
      ...team,
      manager_name: match?.manager_name ?? user?.name ?? null,
      player_count: match?.player_count,
    };
  });

  const current = tournaments
    .filter((tournament) => ["ongoing", "upcoming"].includes(tournament.status))
    .map((tournament) => ({
      tournament,
      teams: cardsByTournament.get(tournament.id) ?? [],
    }));
  const past = tournaments
    .filter((tournament) => tournament.status === "completed")
    .map((tournament) => ({
      tournament,
      teams: cardsByTournament.get(tournament.id) ?? [],
    }));

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
