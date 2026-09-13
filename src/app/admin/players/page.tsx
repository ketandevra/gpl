import { AdminPlayersClient } from "@/components/admin/AdminPlayersClient";
import {
  getActiveTournament,
  getTeamById,
  listTournamentPlayers,
} from "@/lib/teams/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Players" };
export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Players</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to manage players.
        </p>
      </div>
    );
  }

  const tournament = await getActiveTournament();
  if (!tournament) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Players</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">No active tournament.</p>
      </div>
    );
  }

  const players = await listTournamentPlayers(tournament.id);
  const withTeams = await Promise.all(
    players.map(async (p) => {
      if (!p.locked_team_id) return { ...p, team_name: undefined };
      const team = await getTeamById(p.locked_team_id);
      return { ...p, team_name: team?.name };
    }),
  );

  return <AdminPlayersClient players={withTeams} />;
}
