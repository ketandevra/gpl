import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { HomeTournaments } from "@/components/home/HomeTournaments";
import { PointsTable } from "@/components/stats/PointsTable";
import { APP_NAME } from "@/lib/constants";
import { hasLiveMatches } from "@/lib/matches/live";
import { getPointsTable } from "@/lib/stats";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { listPublicTournaments } from "@/lib/tournaments/queries";

export const revalidate = 30;

export default async function HomePage() {
  const hasLive = await hasLiveMatches();

  const [pointsSnippet, tournaments] = isSupabaseAdminConfigured()
    ? await Promise.all([
        getPointsTable().catch(() => []),
        listPublicTournaments().catch(() => []),
      ])
    : [[], []];

  const featured =
    tournaments.find((t) => t.is_active) ?? tournaments[0] ?? null;

  const sections = [
    ...(hasLive
      ? [
          {
            href: "/live",
            title: "Live matches",
            body: "A match is in progress — watch ball-by-ball updates.",
            badge: "Live",
          },
        ]
      : []),
    {
      href: "/matches",
      title: "Fixtures & results",
      body: hasLive
        ? "Upcoming schedule and completed scorecards."
        : "No matches are live right now. Browse fixtures and results.",
    },
    {
      href: "/teams",
      title: "Teams",
      body: "Squads, managers, and team standings.",
    },
    {
      href: "/stats",
      title: "Stats & points",
      body: "Leaderboards, points table, and NRR.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3 pb-4 pt-4 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl border border-[#3e2723]/8 bg-gradient-to-b from-[#fff9ef] to-[#f3e6cf] px-4 pb-7 pt-5 text-center shadow-sm sm:px-10 sm:pb-10 sm:pt-8 sm:text-left">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#f5b830]/25 blur-2xl sm:h-64 sm:w-64"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-[#2aa7ad]/20 blur-2xl"
          aria-hidden
        />

        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="shrink-0 drop-shadow-sm">
            <BrandLogo variant="full" href={null} priority />
          </div>

          <div className="min-w-0 flex-1 sm:pt-1">
            {hasLive ? (
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d81b60] sm:text-xs">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d81b60]" />
                Live now
              </p>
            ) : featured ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2aa7ad] sm:text-xs">
                {featured.status === "ongoing" ? "Ongoing" : "Upcoming"}
              </p>
            ) : (
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2aa7ad] sm:text-xs">
                Tournament
              </p>
            )}
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#3e2723] sm:text-2xl">
              {APP_NAME}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-[#3e2723]/85 sm:mt-3 sm:text-lg">
              {hasLive
                ? "A match is live — follow the score on your phone."
                : featured
                  ? `${featured.name} is ${featured.status === "ongoing" ? "underway" : "coming up"}. Scores, teams, and stats — all in one place.`
                  : "Scores, teams, and stats for Ghanchi Premier League. Nothing is live right now."}
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap">
              {hasLive ? (
                <Link
                  href="/live"
                  className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-[#d81b60] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b01550] active:scale-[0.98]"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Watch live
                </Link>
              ) : null}
              <Link
                href="/matches"
                className={`touch-target inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                  hasLive
                    ? "border border-[#3e2723]/20 bg-white/70 text-[#3e2723] hover:bg-white"
                    : "bg-[#2aa7ad] text-white shadow-sm hover:bg-[#1a7f84]"
                }`}
              >
                View matches
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomeTournaments tournaments={tournaments} />

      <section className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {sections.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-[#3e2723]/8 bg-white/85 p-4 shadow-sm transition active:scale-[0.99] sm:p-5 sm:hover:-translate-y-0.5 sm:hover:border-[#2aa7ad]/35 sm:hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-[#3e2723] group-hover:text-[#1a7f84]">
                {item.title}
              </h2>
              {"badge" in item && item.badge ? (
                <span className="rounded-full bg-[#d81b60]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#d81b60]">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-snug text-[#3e2723]/65">
              {item.body}
            </p>
          </Link>
        ))}
      </section>

      {pointsSnippet.some((r) => r.played > 0) ? (
        <section className="mt-6 sm:mt-8">
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#3e2723]">Standings</h2>
            <Link
              href="/stats"
              className="text-sm font-semibold text-[#1a7f84] hover:underline"
            >
              All stats
            </Link>
          </div>
          <PointsTable
            rows={pointsSnippet}
            limit={4}
            compact
            showLinkToFull
          />
        </section>
      ) : null}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          { href: "/players", label: "Players" },
          { href: "/profile", label: "Profile" },
          { href: "/login", label: "Login" },
          { href: "/register", label: "Register" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-[#3e2723]/12 bg-white/80 px-4 py-2 text-xs font-semibold text-[#3e2723]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
