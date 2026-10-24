import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { HomeCountdown } from "@/components/home/HomeCountdown";
import { HomeJoin } from "@/components/home/HomeJoin";
import { HomePlayers } from "@/components/home/HomePlayers";
import { APP_SHORT_NAME } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { listPublicTeams, listShowcasePlayers } from "@/lib/teams/queries";
import { listAllTournaments } from "@/lib/tournaments/queries";
import type { PublicTournament } from "@/lib/tournaments/labels";

function pickGpl2(tournaments: PublicTournament[]) {
  return (
    tournaments.find((row) => row.short_name?.toUpperCase() === "GPL-2") ??
    tournaments.find((row) => /gpl-?\s*2/i.test(`${row.short_name} ${row.name}`)) ??
    tournaments.find((row) => row.is_active) ??
    tournaments.find((row) =>
      ["ongoing", "upcoming"].includes(row.status),
    ) ??
    null
  );
}

export const revalidate = 30;

export default async function HomePage() {
  const user = await getCurrentUser();
  const signedIn = Boolean(user);
  const allTournaments = isSupabaseAdminConfigured()
    ? await listAllTournaments().catch(() => [])
    : [];
  const gpl2 = pickGpl2(allTournaments);
  const [showcasePlayers, teams] = gpl2
    ? await Promise.all([
        listShowcasePlayers(gpl2.id).catch(() => []),
        listPublicTeams(gpl2.id).catch(() => []),
      ])
    : [[], []];
  const gpl2Label = gpl2?.short_name || "GPL-2";

  return (
    <div
      className="relative mx-auto flex min-h-full max-w-lg flex-col overflow-x-hidden px-3 pb-5 pt-3 sm:max-w-2xl sm:px-6 sm:pb-10 sm:pt-8"
    >
      <div
        className="pointer-events-none absolute -right-16 top-8 h-48 w-48 rounded-full bg-[#f5b830]/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 bottom-24 h-52 w-52 rounded-full bg-[#2aa7ad]/22 blur-3xl"
        aria-hidden
      />

      <header className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo variant="mark" href={null} priority />
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2aa7ad]">
              Players of {gpl2Label}
            </p>
            <p className="truncate text-sm font-bold tracking-tight text-[#3e2723] sm:text-base">
              {APP_SHORT_NAME}
            </p>
          </div>
        </div>
        {signedIn ? null : (
          <Link
            href="/login"
            className="touch-target inline-flex shrink-0 items-center justify-center rounded-full bg-[#f5b830] px-4 py-2 text-sm font-bold text-[#3e2723] shadow-sm transition hover:bg-[#ffcf5c] active:scale-[0.98]"
          >
            Login
          </Link>
        )}
      </header>

      <div className="relative mt-4">
        <HomeCountdown />
      </div>

      <div className="relative mt-4">
        <HomePlayers tournamentLabel={gpl2Label} players={showcasePlayers} />
      </div>

      <HomeJoin
        signedIn={signedIn}
        verificationStatus={user?.verification_status ?? null}
        tournamentLabel={gpl2Label}
        playerCount={showcasePlayers.length}
        teamCount={teams.length}
      />
    </div>
  );
}
