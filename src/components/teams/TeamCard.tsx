import Link from "next/link";
import type { TeamRow } from "@/lib/teams/types";
import { teamStatusLabel } from "@/lib/teams/labels";

type TeamCardProps = {
  team: TeamRow & { manager_name?: string | null; player_count?: number };
  href?: string;
  showStatus?: boolean;
  highlight?: boolean;
  actionLabel?: string;
};

export function TeamCard({
  team,
  href,
  showStatus = false,
  highlight = false,
  actionLabel,
}: TeamCardProps) {
  const content = (
    <div
      className={`flex h-full flex-col rounded-2xl border p-3 shadow-sm transition active:scale-[0.99] sm:p-4 sm:hover:shadow-md ${
        highlight
          ? "border-[#2aa7ad]/40 bg-white sm:hover:border-[#2aa7ad]"
          : "border-[#3e2723]/10 bg-white sm:hover:border-[#2aa7ad]/35"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2aa7ad]/15 text-[11px] font-bold text-[#1a7f84] sm:h-12 sm:w-12 sm:text-sm">
            {team.short_name}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight text-[#3e2723] sm:text-base">
              {team.name}
            </h2>
            {team.manager_name ? (
              <p className="mt-0.5 truncate text-xs text-[#3e2723]/55">
                Captain: {team.manager_name}
              </p>
            ) : null}
          </div>
        </div>
        {showStatus ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              team.registration_status === "approved"
                ? "bg-[#2aa7ad]/15 text-[#1a7f84]"
                : team.registration_status === "pending"
                  ? "bg-[#f5b830]/20 text-[#8a6500]"
                  : "bg-[#d81b60]/10 text-[#9f1239]"
            }`}
          >
            {teamStatusLabel(team.registration_status)}
          </span>
        ) : null}
      </div>
      {typeof team.player_count === "number" ? (
        <p className="mt-2 text-xs text-[#3e2723]/60 sm:mt-3 sm:text-sm">
          {team.player_count} player{team.player_count === 1 ? "" : "s"}
        </p>
      ) : null}
      {actionLabel ? (
        <p className="mt-3 text-sm font-semibold text-[#1a7f84]">
          {actionLabel} →
        </p>
      ) : null}
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}
