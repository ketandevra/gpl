import Link from "next/link";
import { TeamCard } from "@/components/teams/TeamCard";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getPendingOwnerRequestForUser } from "@/lib/teams/owner-requests";
import {
  getActiveTournament,
  getManagerName,
  listPlayersByTeam,
  listPublicTeams,
  listTeamsForCaptain,
} from "@/lib/teams/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

type PageProps = {
  searchParams: Promise<{ requested?: string }>;
};

export const metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsPage({ searchParams }: PageProps) {
  const query = await searchParams;

  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[#3e2723]">Teams</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load teams.
        </p>
      </div>
    );
  }

  const [tournament, user] = await Promise.all([
    getActiveTournament(),
    getCurrentUser(),
  ]);

  const [teams, myTeams, pendingRequest] = await Promise.all([
    listPublicTeams(tournament?.id),
    user && !canAccessAdmin(user)
      ? listTeamsForCaptain(user.id)
      : Promise.resolve([]),
    user && tournament && !canAccessAdmin(user)
      ? getPendingOwnerRequestForUser(user.id, tournament.id)
      : Promise.resolve(null),
  ]);

  const [cards, myCards] = await Promise.all([
    Promise.all(
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
    ),
    Promise.all(
      myTeams.map(async (team) => {
        const players = await listPlayersByTeam(team.id);
        return {
          ...team,
          manager_name: user?.name ?? null,
          player_count: players.length,
        };
      }),
    ),
  ]);

  const canRequestOwner =
    Boolean(user) &&
    !canAccessAdmin(user) &&
    myTeams.length === 0 &&
    !pendingRequest;

  const myIds = new Set(myCards.map((team) => team.id));
  const publicCards = cards.filter((team) => !myIds.has(team.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
            Tournament
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#3e2723]">Teams</h1>
          <p className="mt-1 text-sm text-[#3e2723]/60">
            {tournament?.name ?? "Ghanchi Premier League"}
          </p>
        </div>
        {canAccessAdmin(user) ? (
          <Link
            href="/admin/teams"
            className="touch-target inline-flex items-center justify-center rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Create team (Admin)
          </Link>
        ) : canRequestOwner ? (
          <Link
            href={
              user!.verification_status === "verified"
                ? "/teams/register"
                : "/verify"
            }
            className="touch-target inline-flex items-center justify-center rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Become a team owner
          </Link>
        ) : !user ? (
          <Link
            href="/login?next=/teams/register"
            className="touch-target inline-flex items-center justify-center rounded-full border border-[#2aa7ad]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[#1a7f84]"
          >
            Sign in to become a team owner
          </Link>
        ) : null}
      </div>

      {query.requested || pendingRequest ? (
        <p className="mt-6 rounded-2xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-4 py-3 text-sm text-[#1a7f84]">
          Your request
          {pendingRequest ? ` for “${pendingRequest.name}”` : ""} is waiting
          for admin approval. The team is created after they approve this
          request. Squad details stay private until the team itself is
          approved.
        </p>
      ) : null}

      {myCards.length > 0 ? (
        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
            Captain
          </p>
          <h2 className="mt-1 text-lg font-bold text-[#3e2723]">
            {myCards.length === 1 ? "Your team" : "Your teams"}
          </h2>
          <p className="mt-1 text-sm text-[#3e2723]/60">
            Invite players and manage the squad. Other players see the squad
            only after admin approval.
          </p>
          <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myCards.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                href={`/teams/${team.id}`}
                showStatus
                highlight
                actionLabel="Manage squad"
              />
            ))}
          </div>
        </section>
      ) : null}

      {publicCards.length === 0 && myCards.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#2aa7ad]/35 bg-white/60 px-5 py-8 text-center">
          <p className="font-medium text-[#3e2723]">No teams yet</p>
          <p className="mt-2 text-sm text-[#3e2723]/60">
            A verified player can request to become a team owner. Pending
            teams show the captain only; the squad is visible after approval.
          </p>
        </div>
      ) : publicCards.length > 0 ? (
        <section className="mt-8">
          {myCards.length > 0 ? (
            <h2 className="mb-4 text-lg font-bold text-[#3e2723]">All teams</h2>
          ) : null}
          <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicCards.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                href={`/teams/${team.id}`}
                showStatus
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
