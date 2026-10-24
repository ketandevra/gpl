import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveMatchPanel } from "@/components/matches/LiveMatchPanel";
import {
  formatMatchWhen,
  getMatchById,
  LIVE_MATCH_STATUSES,
  matchStatusLabel,
} from "@/lib/matches/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/auth/session";
import { canScoreMatch, getScoreboard } from "@/lib/scoring/queries";

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
      <div className="page max-w-3xl">
        <h1 className="page-title">Match</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load match details.
        </p>
      </div>
    );
  }

  const match = await getMatchById(id);
  if (!match) notFound();

  const isLive = LIVE_MATCH_STATUSES.includes(match.status);
  const user = await getCurrentUser();
  const [showScoreLink, board] = await Promise.all([
    user ? canScoreMatch(user, id) : Promise.resolve(false),
    getScoreboard(id, user),
  ]);

  return (
    <div className="page max-w-3xl">
      {showScoreLink &&
      (isLive ||
        (match.status === "completed" && !match.winner_team_id)) ? (
        <div className="flex justify-end">
          <Link
            href={`/score/${match.id}`}
            className="rounded-full bg-[#d81b60] px-4 py-2 text-xs font-bold text-white"
          >
            {match.status === "completed" && !match.winner_team_id
              ? "Super Over"
              : "Score"}
          </Link>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d81b60]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#d81b60]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d81b60]" />
            {match.result_text?.toLowerCase().includes("super over")
              ? "Super Over"
              : match.status === "innings_break"
                ? "Break"
                : "Live"}
          </span>
        ) : (
          <span className="rounded-full bg-[#2aa7ad]/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1a7f84]">
            {matchStatusLabel(match.status)}
          </span>
        )}
        {match.tournament?.name ? (
          <span className="rounded-full bg-[#2aa7ad]/12 px-2.5 py-1 text-[11px] font-semibold text-[#1a7f84]">
            {match.tournament.name}
          </span>
        ) : null}
        <span className="rounded-full bg-[#3e2723]/6 px-2.5 py-1 text-[11px] font-semibold capitalize text-[#3e2723]/55">
          {match.match_type} · {match.overs_per_innings} ov
        </span>
      </div>

      <h1 className="page-title mt-3">
        {match.team_a?.name ?? "Team A"}
        <span className="mx-2 align-middle text-sm font-semibold text-[#3e2723]/30">
          vs
        </span>
        {match.team_b?.name ?? "Team B"}
      </h1>
      <p className="mt-1.5 text-sm leading-5 text-[#3e2723]/50">
        {match.venue ? `${match.venue} · ` : ""}
        {formatMatchWhen(match.scheduled_at)}
      </p>

      <section className="mt-5">
        {board ? (
          <LiveMatchPanel matchId={match.id} initial={board} />
        ) : (
          <p className="rounded-2xl border border-[#f5b830]/40 bg-[#fff6df] px-4 py-4 text-sm text-[#3e2723]">
            Match not started yet.
          </p>
        )}
      </section>
    </div>
  );
}
