import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveMatchPanel } from "@/components/matches/LiveMatchPanel";
import { BackLink } from "@/components/ui/BackLink";
import {
  formatMatchWhen,
  getMatchById,
  listInningsForMatch,
  LIVE_MATCH_STATUSES,
  matchStatusLabel,
} from "@/lib/matches/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/auth/session";
import { canScoreMatch } from "@/lib/scoring/queries";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) return { title: "Match" };
  return {
    title: `${match.team_a?.short_name ?? "A"} vs ${match.team_b?.short_name ?? "B"}`,
  };
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[#3e2723]">Match</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load match details.
        </p>
      </div>
    );
  }

  const match = await getMatchById(id);
  if (!match) notFound();

  const innings = await listInningsForMatch(id);
  const isLive = LIVE_MATCH_STATUSES.includes(match.status);
  const user = await getCurrentUser();
  const showScoreLink = user ? await canScoreMatch(user, id) : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-20">
      <BackLink href={isLive ? "/live" : "/matches"}>
        {isLive ? "All live matches" : "All matches"}
      </BackLink>

      {isLive ? (
        <p className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#d81b60]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#d81b60]" />
          {match.status === "innings_break" ? "Innings break" : "Live"}
        </p>
      ) : (
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
          {matchStatusLabel(match.status)}
        </p>
      )}

      <h1 className="mt-2 text-2xl font-bold text-[#3e2723] sm:text-3xl">
        {match.team_a?.name ?? "Team A"} vs {match.team_b?.name ?? "Team B"}
      </h1>

      <div className="mt-3 space-y-1 text-sm text-[#3e2723]/65">
        <p>{formatMatchWhen(match.scheduled_at)}</p>
        {match.venue ? <p>{match.venue}</p> : null}
        <p>
          {match.overs_per_innings} overs ·{" "}
          <span className="capitalize">{match.match_type}</span>
        </p>
      </div>

      {match.toss_winner ? (
        <p className="mt-4 text-sm text-[#3e2723]/70">
          Toss: {match.toss_winner.name} elected to {match.toss_decision}
        </p>
      ) : null}

      {showScoreLink && isLive ? (
        <Link
          href={`/score/${match.id}`}
          className="mt-5 inline-flex rounded-full bg-[#d81b60] px-5 py-2.5 text-sm font-bold text-white"
        >
          Open scorer
        </Link>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-[#3e2723]">Score</h2>
        {isLive || innings.length > 0 ? (
          <LiveMatchPanel
            matchId={match.id}
            initialInnings={innings}
            teamAId={match.team_a_id}
            teamAName={match.team_a?.name ?? "Team A"}
            teamBName={match.team_b?.name ?? "Team B"}
            status={match.status}
            resultText={match.result_text}
          />
        ) : (
          <p className="rounded-xl border border-[#f5b830]/40 bg-[#fff6df] px-4 py-3 text-sm text-[#3e2723]">
            Match not started yet.
          </p>
        )}
      </section>

    </div>
  );
}
