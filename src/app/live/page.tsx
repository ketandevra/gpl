import Link from "next/link";
import { redirect } from "next/navigation";
import { getLiveMatches } from "@/lib/matches/live";

export const metadata = { title: "Live" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const liveMatches = await getLiveMatches();

  if (liveMatches.length === 0) {
    redirect("/matches");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#d81b60]" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d81b60]">
          Live
        </p>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Live matches</h1>
      <p className="mt-2 text-sm text-[#3e2723]/70">
        {liveMatches.length === 1
          ? "1 match in progress"
          : `${liveMatches.length} matches in progress`}
      </p>

      <ul className="mt-6 space-y-3">
        {liveMatches.map((match) => (
          <li key={match.id}>
            <Link
              href={`/matches/${match.id}`}
              className="block rounded-2xl border border-[#d81b60]/25 bg-white p-4 shadow-sm transition active:scale-[0.99]"
            >
              <span className="rounded-full bg-[#d81b60]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#d81b60]">
                {match.status === "innings_break" ? "Innings break" : "Live"}
              </span>
              <p className="mt-3 text-lg font-semibold text-[#3e2723]">
                {match.team_a_name}{" "}
                <span className="font-normal text-[#3e2723]/45">vs</span>{" "}
                {match.team_b_name}
              </p>
              {match.venue ? (
                <p className="mt-1 text-sm text-[#3e2723]/55">{match.venue}</p>
              ) : null}
              <p className="mt-2 text-sm text-[#2aa7ad]">Open match →</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
