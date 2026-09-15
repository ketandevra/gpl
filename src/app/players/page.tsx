import { PlayerCard } from "@/components/teams/PlayerCard";
import { getActiveTournament, listPublicPlayers } from "@/lib/teams/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Players" };
export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[#3e2723]">Players</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load players.
        </p>
      </div>
    );
  }

  const tournament = await getActiveTournament();
  const players = await listPublicPlayers(tournament?.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#3e2723]">Players</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        {tournament?.name
          ? `Verified players in ${tournament.name}`
          : "Verified GPL players"}
      </p>

      {players.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#2aa7ad]/35 bg-white/60 px-5 py-8 text-center text-sm text-[#3e2723]/65">
          No verified players to show yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              href={`/players/${player.id}`}
              hideTeamName
              statusLine={player.team_name ?? "Available"}
              statusTone={player.team_name ? "default" : "available"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
