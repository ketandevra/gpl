import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { PlayerRow, TeamPlayerView } from "@/lib/teams/types";
import { formatPlayerLabel, playerRoleLabel } from "@/lib/teams/labels";

type PlayerCardProps = {
  player: (PlayerRow | TeamPlayerView) & {
    team_name?: string;
    avatar_url?: string | null;
  };
  href?: string;
  statusLine?: string;
  statusTone?: "warning" | "available" | "default";
  hideTeamName?: boolean;
};

export function PlayerCard({
  player,
  href,
  statusLine,
  statusTone = "warning",
  hideTeamName = false,
}: PlayerCardProps) {
  const jersey =
    "jersey_number" in player ? (player.jersey_number as number | null) : null;
  const avatarSrc = player.avatar_url ?? player.photo_url ?? null;
  const statusClass =
    statusTone === "available"
      ? "mt-1 text-xs font-semibold text-[#15803d]"
      : statusTone === "default"
        ? "mt-1 text-xs font-medium text-[#3e2723]"
        : "mt-1 text-xs text-[#8a6500]";

  const content = (
    <div className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm transition active:scale-[0.99] sm:hover:border-[#2aa7ad]/35">
      <div className="flex items-center gap-3">
        <UserAvatar
          name={player.name}
          src={avatarSrc}
          size="card"
          className="border border-[#3e2723]/10"
        />
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-[#3e2723]">
            {formatPlayerLabel(player)}
          </h3>
          <p className="text-xs text-[#3e2723]/55">
            {playerRoleLabel(player.role)}
            {jersey != null ? ` · #${jersey}` : ""}
            {!hideTeamName && player.team_name ? ` · ${player.team_name}` : ""}
          </p>
          {statusLine ? (
            <p className={statusClass}>{statusLine}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
