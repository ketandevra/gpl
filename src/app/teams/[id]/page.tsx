import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/teams/PlayerCard";
import { ManageSquadClient } from "@/components/teams/ManageSquadClient";
import { BackLink } from "@/components/ui/BackLink";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getSquadSize } from "@/lib/settings/app";
import {
  getManagerName,
  getTeamById,
  listPlayersByTeam,
  teamStatusLabel,
} from "@/lib/teams/queries";
import { canManageTeam } from "@/lib/teams/service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const team = await getTeamById(id);
  return { title: team?.name ?? "Team" };
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const team = await getTeamById(id);
  if (!team) notFound();

  const user = await getCurrentUser();
  const isCaptain = Boolean(user && team.manager_id === user.id);
  const canViewPrivate = canAccessAdmin(user) || isCaptain;

  const [players, captain_name, squadSize] = await Promise.all([
    listPlayersByTeam(id),
    getManagerName(team.manager_id),
    getSquadSize(),
  ]);
  const canEdit = canManageTeam(user, team);
  const captainCanEditSquad = canEdit && !team.approved;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackLink href="/teams">All teams</BackLink>

      {query.created ? (
        <p className="mt-4 rounded-xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-4 py-3 text-sm text-[#1a7f84]">
          Team created. Captain can add squad members; admin will approve when
          ready.
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2aa7ad]/15 text-lg font-bold text-[#1a7f84]">
          {team.short_name}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
            {teamStatusLabel(team.registration_status)}
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-[#3e2723]">
            {team.name}
          </h1>
          {captain_name ? (
            <p className="mt-1 text-sm text-[#3e2723]/60">
              Captain: {captain_name}
              {isCaptain ? " (you)" : ""}
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#3e2723]">Squad</h2>
          <span className="text-sm text-[#3e2723]/50">
            {players.length} / {squadSize} player
            {players.length === 1 ? "" : "s"}
          </span>
        </div>
        {players.length === 0 ? (
          <p className="mt-4 text-sm text-[#3e2723]/60">
            No players yet
            {isCaptain && !team.approved
              ? " — use Manage squad below to add members."
              : "."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {players.map((player) => {
              const conflict =
                Boolean(player.locked_team_id) &&
                player.locked_team_id !== team.id;
              const statusLine = canViewPrivate
                ? conflict
                  ? `Already in approved team${
                      player.locked_team_name
                        ? `: ${player.locked_team_name}`
                        : ""
                    }`
                  : player.pending_other_team_names.length
                    ? `Also in pending: ${player.pending_other_team_names.join(", ")}`
                    : "Available"
                : undefined;
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  href={`/players/${player.id}`}
                  statusLine={statusLine}
                />
              );
            })}
          </div>
        )}
      </section>

      {captainCanEditSquad || (canAccessAdmin(user) && !team.approved) ? (
        <ManageSquadClient
          teamId={team.id}
          initialPlayers={players}
          canEdit={Boolean(captainCanEditSquad || canAccessAdmin(user))}
          approved={team.approved}
          squadSize={squadSize}
        />
      ) : null}

      {canEdit && !team.approved ? (
        <p className="mt-8 rounded-xl border border-[#f5b830]/40 bg-[#fff6df] px-4 py-3 text-sm text-[#3e2723]">
          Pending squads can share players with other pending teams. Approval
          locks each player to one team for this tournament.
        </p>
      ) : null}

    </div>
  );
}
