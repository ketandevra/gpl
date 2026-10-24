import { MatchCard } from "@/components/matches/MatchCard";
import {
  listMatches,
  LIVE_MATCH_STATUSES,
} from "@/lib/matches/queries";
import { listAllTournaments } from "@/lib/tournaments/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="page max-w-3xl">
        <h1 className="page-title hidden md:block">Matches</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load fixtures.
        </p>
      </div>
    );
  }

  const [matches, tournaments] = await Promise.all([
    listMatches(),
    listAllTournaments(),
  ]);

  const groups = tournaments
    .map((tournament) => {
      const rows = matches.filter((m) => m.tournament_id === tournament.id);
      return {
        tournament,
        live: rows.filter((m) => LIVE_MATCH_STATUSES.includes(m.status)),
        upcoming: rows.filter((m) => m.status === "scheduled"),
        completed: rows.filter((m) =>
          ["completed", "abandoned"].includes(m.status),
        ),
      };
    })
    .filter(
      (group) =>
        group.live.length + group.upcoming.length + group.completed.length > 0,
    );

  return (
    <div className="page max-w-3xl">
      <h1 className="page-title hidden md:block">Matches</h1>
      <p className="page-lead">
        Fixtures and results by tournament
      </p>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-[#3e2723]/55">
          No tournament matches yet.
        </p>
      ) : (
        groups.map(({ tournament, live, upcoming, completed }) => (
          <section key={tournament.id} className="mt-6 sm:mt-8">
            <h2 className="text-[15px] font-bold text-[#3e2723] sm:text-lg">
              {tournament.name}
            </h2>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[#1a7f84]">
              {tournament.status === "ongoing"
                ? "Ongoing"
                : tournament.status === "upcoming"
                  ? "Upcoming"
                  : "Completed"}
            </p>

            {live.length > 0 ? (
              <div className="mt-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#d81b60]">
                  Live now
                </h3>
                <div className="space-y-3">
                  {live.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#8a6500]">
                Upcoming
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-[#3e2723]/55">No upcoming matches.</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#1a7f84]">
                Results
              </h3>
              {completed.length === 0 ? (
                <p className="text-sm text-[#3e2723]/55">No completed matches yet.</p>
              ) : (
                <div className="space-y-3">
                  {completed.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
