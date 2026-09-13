import { notFound, redirect } from "next/navigation";
import { ScorerConsole } from "@/components/scoring/ScorerConsole";
import { BackLink } from "@/components/ui/BackLink";
import { getCurrentUser } from "@/lib/auth/session";
import { getScoreboard } from "@/lib/scoring/queries";
import { LIVE_MATCH_STATUSES } from "@/lib/matches/queries";

type PageProps = { params: Promise<{ matchId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { matchId } = await params;
  const user = await getCurrentUser();
  const board = await getScoreboard(matchId, user);
  if (!board) return { title: "Score" };
  return {
    title: `Score · ${board.match.team_a?.short_name} vs ${board.match.team_b?.short_name}`,
  };
}

export default async function ScoreMatchPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/score/${(await params).matchId}`);
  }

  const { matchId } = await params;
  const board = await getScoreboard(matchId, user);
  if (!board) notFound();

  const scorable = LIVE_MATCH_STATUSES.includes(board.match.status);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24">
      <div className="mb-4 flex items-center justify-between gap-2">
        <BackLink href={`/matches/${matchId}`}>Match</BackLink>
        <span className="text-xs font-bold uppercase tracking-widest text-[#3e2723]/45">
          Scorer
        </span>
      </div>

      {!scorable ? (
        <div className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 text-sm text-[#3e2723]/70">
          This match is <strong>{board.match.status}</strong>. Start it from Admin →
          Matches before scoring.
          {board.match.result_text ? (
            <p className="mt-2 font-medium text-[#1a7f84]">{board.match.result_text}</p>
          ) : null}
        </div>
      ) : (
        <ScorerConsole matchId={matchId} initial={board} />
      )}
    </div>
  );
}
