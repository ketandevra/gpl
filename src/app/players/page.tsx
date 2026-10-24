import Link from "next/link";
import { PlayersDirectory } from "@/components/teams/PlayersDirectory";
import { listPublicPlayers } from "@/lib/teams/queries";
import { listAllTournaments } from "@/lib/tournaments/queries";
import { tournamentStatusLabel } from "@/lib/tournaments/labels";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Players" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tournament?: string }>;
};

export default async function PlayersPage({ searchParams }: PageProps) {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="page max-w-3xl">
        <h1 className="page-title hidden md:block">Players</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load players.
        </p>
      </div>
    );
  }

  const query = await searchParams;
  const tournaments = await listAllTournaments();
  const active =
    tournaments.find((row) => row.is_active) ?? tournaments[0] ?? null;
  const selected =
    tournaments.find((row) => row.id === query.tournament) ?? active;
  const players = await listPublicPlayers(selected?.id);

  return (
    <div className="page max-w-6xl">
      <h1 className="page-title hidden md:block">Players</h1>

      {tournaments.length > 1 ? (
        <div
          className={`seg-track mt-4 ${
            tournaments.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
          }`}
        >
          {tournaments.map((tournament) => {
            const href =
              tournament.id === active?.id
                ? "/players"
                : `/players?tournament=${tournament.id}`;
            const isSelected = tournament.id === selected?.id;
            return (
              <Link
                key={tournament.id}
                href={href}
                className={`seg-btn ${
                  isSelected ? "seg-btn-active" : "seg-btn-idle"
                }`}
              >
                <span className="block truncate">
                  {tournament.name.replace("Ghanchi Premier League", "GPL")}
                </span>
                <span
                  className={`block text-[10px] font-bold uppercase tracking-wide ${
                    isSelected ? "text-white/80" : "text-[#3e2723]/45"
                  }`}
                >
                  {tournamentStatusLabel(tournament.status)}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <PlayersDirectory players={players} />
    </div>
  );
}
