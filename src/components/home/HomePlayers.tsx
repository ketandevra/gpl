import { BrandLogo } from "@/components/brand/BrandLogo";
import { HomePlayerIntro } from "@/components/home/HomePlayerIntro";
import { APP_NAME } from "@/lib/constants";
import type { ShowcasePlayer } from "@/lib/teams/queries";

type Props = {
  tournamentLabel: string;
  players: ShowcasePlayer[];
};

function uniquePlayers(players: ShowcasePlayer[]) {
  const byKey = new Map<string, ShowcasePlayer>();
  for (const player of players) {
    const key = player.user_id || player.id;
    const existing = byKey.get(key);
    if (!existing || (!existing.avatar_url && player.avatar_url)) {
      byKey.set(key, player);
    }
  }
  return [...byKey.values()];
}

export function HomePlayers({
  tournamentLabel,
  players,
}: Props) {
  const lineup = uniquePlayers(players);

  if (!lineup.length) {
    return (
      <div className="flex aspect-[4/5] min-h-[58dvh] w-full flex-1 flex-col items-center justify-center rounded-[1.75rem] bg-[#3e2723] px-6 py-16 text-center shadow-lg">
        <BrandLogo variant="full" href={null} priority />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f5b830]">
          {APP_NAME}
        </p>
        <p className="mt-2 max-w-xs text-sm leading-snug text-white/75">
          The next chapter of {tournamentLabel} is almost here.
        </p>
      </div>
    );
  }

  return (
    <HomePlayerIntro tournamentLabel={tournamentLabel} players={lineup} />
  );
}
