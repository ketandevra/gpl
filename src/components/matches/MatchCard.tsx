import Link from "next/link";
import type { MatchView } from "@/lib/matches/types";
import {
  formatMatchWhen,
  LIVE_MATCH_STATUSES,
  matchStatusLabel,
} from "@/lib/matches/labels";

type MatchCardProps = {
  match: MatchView;
};

export function MatchCard({ match }: MatchCardProps) {
  const isLive = LIVE_MATCH_STATUSES.includes(match.status);
  const isDone = match.status === "completed" || match.status === "abandoned";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm transition active:scale-[0.99] sm:hover:border-[#2aa7ad]/35 sm:hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            isLive
              ? "bg-[#d81b60]/10 text-[#d81b60]"
              : isDone
                ? "bg-[#2aa7ad]/10 text-[#1a7f84]"
                : "bg-[#f5b830]/20 text-[#8a6500]"
          }`}
        >
          {isLive && match.status === "live" ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d81b60]" />
              Live
            </span>
          ) : (
            matchStatusLabel(match.status)
          )}
        </span>
        <span className="text-xs text-[#3e2723]/50">
          {formatMatchWhen(match.scheduled_at)}
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold text-[#3e2723]">
        {match.team_a?.name ?? "Team A"}{" "}
        <span className="font-normal text-[#3e2723]/40">vs</span>{" "}
        {match.team_b?.name ?? "Team B"}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#3e2723]/55">
        {match.venue ? <span>{match.venue}</span> : null}
        <span>{match.overs_per_innings} overs</span>
        <span className="capitalize">{match.match_type}</span>
      </div>

      {match.result_text ? (
        <p className="mt-3 text-sm font-medium text-[#1a7f84]">
          {match.result_text}
        </p>
      ) : null}
    </Link>
  );
}
