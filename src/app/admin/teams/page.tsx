import { AdminTeamsClient } from "@/components/admin/AdminTeamsClient";
import { getSquadSize } from "@/lib/settings/app";
import { getActiveTournament, listAdminTeamSummaries } from "@/lib/teams/queries";
import { listPendingOwnerRequests } from "@/lib/teams/owner-requests";
import { listAllTournaments } from "@/lib/tournaments/queries";
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

  try {
    const [teams, tournament, squadSize, tournaments] = await Promise.all([
      listAdminTeamSummaries(),
      getActiveTournament(),
      getSquadSize(),
      listAllTournaments(),
    ]);
    const ownerRequests = await listPendingOwnerRequests();

    return (
      <AdminTeamsClient
        teams={teams}
        ownerRequests={ownerRequests}
        squadSize={squadSize}
        tournaments={tournaments.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          is_active: row.is_active,
        }))}
        defaultTournamentId={tournament?.id ?? tournaments[0]?.id ?? ""}
      />
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load teams.";
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Teams</h1>
        <p className="mt-3 text-sm text-[#9f1239]">{message}</p>
      </div>
    );
  }
}
