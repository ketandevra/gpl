import { AdminTeamsClient } from "@/components/admin/AdminTeamsClient";
import { getSquadSize } from "@/lib/settings/app";
import {
  getActiveTournament,
  getManagerName,
  listAllTeams,
  listPlayersByTeam,
} from "@/lib/teams/queries";
import { listPendingOwnerRequests } from "@/lib/teams/owner-requests";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Teams" };
export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Teams</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to manage teams.
        </p>
      </div>
    );
  }

  const [teams, tournament] = await Promise.all([
    listAllTeams(),
    getActiveTournament(),
  ]);
  const [enriched, ownerRequests] = await Promise.all([
    Promise.all(
      teams.map(async (team) => {
        const [manager_name, players] = await Promise.all([
          getManagerName(team.manager_id),
          listPlayersByTeam(team.id),
        ]);
        return {
          ...team,
          manager_name,
          player_count: players.length,
          players,
        };
      }),
    ),
    listPendingOwnerRequests(tournament?.id),
  ]);

  return (
    <AdminTeamsClient
      teams={enriched}
      ownerRequests={ownerRequests}
      squadSize={await getSquadSize()}
    />
  );
}
