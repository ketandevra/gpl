import { MatchCard } from "@/components/matches/MatchCard";
import {
  listMatches,
  LIVE_MATCH_STATUSES,
} from "@/lib/matches/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[#3e2723]">Matches</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load fixtures.
        </p>
      </div>
    );
  }

  const matches = await listMatches();
  const live = matches.filter((m) => LIVE_MATCH_STATUSES.includes(m.status));
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const completed = matches.filter((m) =>
    ["completed", "abandoned"].includes(m.status),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#3e2723]">Matches</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Fixtures, live games, and results
      </p>

      {live.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#d81b60]">
            Live now
          </h2>
          <div className="space-y-3">
            {live.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#8a6500]">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[#3e2723]/55">No upcoming matches.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#1a7f84]">
          Results
        </h2>
        {completed.length === 0 ? (
          <p className="text-sm text-[#3e2723]/55">No completed matches yet.</p>
        ) : (
          <div className="space-y-3">
            {completed.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
