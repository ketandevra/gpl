"use client";

import Link from "next/link";
import { useNavigation } from "@/components/layout/NavigationProvider";
import {
  IconBat,
  IconPhone,
  IconTeam,
} from "@/components/ui/Icons";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { PlayerRow, TeamPlayerView } from "@/lib/teams/types";
import { playerRoleLabel } from "@/lib/teams/labels";

type PlayerCardProps = {
  player: (PlayerRow | TeamPlayerView) & {
    team_name?: string;
    avatar_url?: string | null;
  };
  href?: string;
  statusLine?: string;
  statusTone?: "warning" | "available" | "default";
  hideTeamName?: boolean;
  showMobile?: boolean;
};

export function PlayerCard({
  player,
  href,
  statusLine,
  statusTone = "warning",
  hideTeamName = false,
  showMobile = false,
}: PlayerCardProps) {
  const { pendingPath, setPendingPath } = useNavigation();
  const pending = Boolean(href && pendingPath === href);
  const jersey =
    "jersey_number" in player ? (player.jersey_number as number | null) : null;
  const avatarSrc = player.avatar_url ?? player.photo_url ?? null;
  const teamName = hideTeamName ? null : player.team_name;
  const statusClass =
    statusTone === "available"
      ? "text-[#15803d]"
      : statusTone === "default"
        ? "text-[#3e2723]/70"
        : "text-[#8a6500]";

  const content = (
    <div
      className={`flex items-center gap-2.5 rounded-[1.25rem] bg-white/95 p-2 shadow-[0_6px_18px_rgba(62,39,35,0.05)] ring-1 transition active:scale-[0.99] sm:hover:ring-[#2aa7ad]/30 ${
        pending
          ? "ring-[#2aa7ad]/45"
          : "ring-[#3e2723]/6"
      }`}
    >
      <span className="relative h-[6.75rem] w-[6.75rem] shrink-0 overflow-hidden rounded-[0.95rem] bg-gradient-to-br from-[#f5b830] via-[#2aa7ad] to-[#1a7f84] p-[2px]">
        <span className="relative block h-full w-full overflow-hidden rounded-[0.82rem] bg-[#f3e6cf]">
          <UserAvatar
            name={player.name}
            src={avatarSrc}
            size="fill"
            shape="rounded"
            className="absolute inset-0 h-full w-full rounded-[0.82rem]"
            backgroundColor="#f3e6cf"
          />
        </span>
      </span>
      <div className="min-w-0 flex-1 py-0.5 pr-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold text-[#3e2723]">
            {player.name}
          </h3>
          {jersey != null ? (
            <span className="shrink-0 rounded-full bg-[#f5b830]/18 px-1.5 py-0.5 text-[10px] font-bold text-[#8a6500]">
              #{jersey}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#3e2723]/60">
          <span className="inline-flex items-center rounded-full bg-[#2aa7ad]/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#1a7f84]">
            {player.public_code}
          </span>
          <span className="inline-flex items-center gap-1">
            <IconBat className="h-3.5 w-3.5 text-[#8a6500]" />
            {playerRoleLabel(player.role)}
          </span>
        </div>
        {teamName || statusLine || (showMobile && player.mobile_number) ? (
          <div className="mt-1.5 space-y-0.5 text-[12px]">
            {teamName ? (
              <p className="flex items-center gap-1.5 text-[#3e2723]/70">
                <IconTeam className="h-3.5 w-3.5 shrink-0 text-[#1a7f84]" />
                <span className="truncate">{teamName}</span>
              </p>
            ) : null}
            {showMobile && player.mobile_number ? (
              <p className="flex items-center gap-1.5 tabular-nums text-[#3e2723]/65">
                <IconPhone className="h-3.5 w-3.5 shrink-0 text-[#1a7f84]" />
                {player.mobile_number}
              </p>
            ) : null}
            {statusLine ? (
              statusTone === "available" ? (
                <p className="pt-0.5">
                  <span className="inline-flex items-center rounded-full bg-[#e8f8ee] px-2 py-0.5 text-[11px] font-semibold text-[#15803d]">
                    {statusLine}
                  </span>
                </p>
              ) : (
                <p className={`flex items-center gap-1.5 ${statusClass}`}>
                  <IconTeam className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{statusLine}</span>
                </p>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} prefetch onClick={() => setPendingPath(href)}>
      {content}
    </Link>
  );
}
