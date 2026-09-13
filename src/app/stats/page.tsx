import Link from "next/link";
import { PointsTable } from "@/components/stats/PointsTable";
import {
  getBattingLeaders,
  getBowlingLeaders,
  getPointsTable,
} from "@/lib/stats";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Stats" };
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[#3e2723]">Statistics</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load the points table and leaderboards.
        </p>
      </div>
    );
  }

  const [points, batting, bowling] = await Promise.all([
    getPointsTable(),
    getBattingLeaders(10),
    getBowlingLeaders(10),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Tournament
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Statistics</h1>
      <p className="mt-1 text-sm text-[#3e2723]/65">
        Points table, NRR, and batting / bowling leaders.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-[#3e2723]">Points table</h2>
        <PointsTable rows={points} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3e2723]">Top batters</h2>
        {batting.length === 0 ? (
          <p className="mt-3 text-sm text-[#3e2723]/60">No batting data yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {batting.map((p, i) => (
              <li
                key={p.player_id}
                className="flex items-center justify-between rounded-xl border border-[#3e2723]/08 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-[#3e2723]">
                    <span className="mr-2 text-[#3e2723]/40">{i + 1}</span>
                    <Link
                      href={`/players/${p.player_id}`}
                      className="hover:text-[#1a7f84]"
                    >
                      {p.player_name}
                    </Link>
                  </p>
                  <p className="text-xs text-[#3e2723]/50">{p.team_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-[#3e2723]">
                    {p.runs}
                  </p>
                  <p className="text-xs text-[#3e2723]/50">
                    SR {p.strike_rate.toFixed(1)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#3e2723]">Top bowlers</h2>
        {bowling.length === 0 ? (
          <p className="mt-3 text-sm text-[#3e2723]/60">No bowling data yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bowling.map((p, i) => (
              <li
                key={p.player_id}
                className="flex items-center justify-between rounded-xl border border-[#3e2723]/08 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-[#3e2723]">
                    <span className="mr-2 text-[#3e2723]/40">{i + 1}</span>
                    <Link
                      href={`/players/${p.player_id}`}
                      className="hover:text-[#1a7f84]"
                    >
                      {p.player_name}
                    </Link>
                  </p>
                  <p className="text-xs text-[#3e2723]/50">{p.team_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums text-[#3e2723]">
                    {p.wickets} wkts
                  </p>
                  <p className="text-xs text-[#3e2723]/50">
                    Econ {p.economy.toFixed(2)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
