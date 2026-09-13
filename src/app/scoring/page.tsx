import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin, isScorer } from "@/lib/auth/permissions";
import {
  listMatches,
  listMatchScorerIds,
  LIVE_MATCH_STATUSES,
} from "@/lib/matches/queries";

export const metadata = { title: "Scoring" };
export const dynamic = "force-dynamic";

export default async function ScoringHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/scoring");
  if (!isScorer(user) && !canAccessAdmin(user)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[#3e2723]">Scorers only</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          You need a scorer or admin role to open the scoring desk.
        </p>
        <Link href="/profile" className="mt-6 inline-flex text-sm font-semibold text-[#1a7f84]">
          Back to profile
        </Link>
      </div>
    );
  }

  const matches = await listMatches({ status: LIVE_MATCH_STATUSES });
  const withAccess = [];
  for (const m of matches) {
    if (canAccessAdmin(user)) {
      withAccess.push(m);
      continue;
    }
    const scorers = await listMatchScorerIds(m.id);
    if (scorers.includes(user.id)) withAccess.push(m);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#3e2723]">Scoring desk</h1>
      <p className="mt-1 text-sm text-[#3e2723]/65">
        Live matches you can score.
      </p>
      {withAccess.length === 0 ? (
        <p className="mt-6 rounded-xl border border-[#3e2723]/10 bg-white px-4 py-3 text-sm text-[#3e2723]/60">
          No live matches right now.
          {canAccessAdmin(user) ? (
            <>
              {" "}
              Start one from{" "}
              <Link href="/admin/matches" className="font-semibold text-[#1a7f84]">
                Admin → Matches
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {withAccess.map((m) => (
            <li key={m.id}>
              <Link
                href={`/score/${m.id}`}
                className="flex items-center justify-between rounded-2xl border border-[#d81b60]/25 bg-white px-4 py-4 shadow-sm"
              >
                <span className="font-semibold text-[#3e2723]">
                  {m.team_a?.short_name} vs {m.team_b?.short_name}
                </span>
                <span className="text-sm font-bold text-[#d81b60]">Score →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
