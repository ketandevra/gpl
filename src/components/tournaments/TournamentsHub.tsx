"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TeamCard } from "@/components/teams/TeamCard";
import {
  formatTournamentDates,
  tournamentStatusLabel,
  type PublicTournament,
} from "@/lib/tournaments/labels";
import type { TeamRow } from "@/lib/teams/types";

export type TournamentTeamCard = TeamRow & {
  manager_name: string | null;
  player_count?: number;
};

type TournamentBlock = {
  tournament: PublicTournament;
  teams: TournamentTeamCard[];
};

type Props = {
  current: TournamentBlock[];
  past: TournamentBlock[];
  myTeams: TournamentTeamCard[];
  canCreateAdmin?: boolean;
  canRequestOwner?: boolean;
  signedIn?: boolean;
  verified?: boolean;
  requestedNotice?: string | null;
  initialTab?: "current" | "past";
};

export function TournamentsHub({
  current,
  past,
  myTeams,
  canCreateAdmin = false,
  canRequestOwner = false,
  signedIn = false,
  verified = false,
  requestedNotice,
  initialTab = "current",
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"current" | "past">(initialTab);

  function selectTab(next: "current" | "past") {
    setTab(next);
    const url = next === "past" ? "/tournaments?tab=past" : "/tournaments";
    router.replace(url, { scroll: false });
  }

  const blocks = tab === "past" ? past : current;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
      <h1 className="sr-only">Tournaments</h1>

      <div className="grid w-full grid-cols-2 rounded-full bg-[#3e2723]/6 p-1">
        <button
          type="button"
          onClick={() => selectTab("current")}
          className={`touch-target min-w-0 rounded-full px-2 py-2.5 text-center text-sm font-semibold ${
            tab === "current"
              ? "bg-[#2aa7ad] text-white shadow-sm"
              : "text-[#3e2723]/70"
          }`}
        >
          Upcoming / Ongoing
        </button>
        <button
          type="button"
          onClick={() => selectTab("past")}
          className={`touch-target min-w-0 rounded-full px-2 py-2.5 text-center text-sm font-semibold ${
            tab === "past"
              ? "bg-[#2aa7ad] text-white shadow-sm"
              : "text-[#3e2723]/70"
          }`}
        >
          Past
        </button>
      </div>

      {canCreateAdmin ? (
        <Link
          href="/admin/teams"
          className="touch-target mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
        >
          Manage teams
        </Link>
      ) : canRequestOwner ? (
        <Link
          href={verified ? "/teams/register" : "/verify"}
          className="touch-target mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
        >
          Become a team owner
        </Link>
      ) : !signedIn ? (
        <Link
          href="/login?next=/teams/register"
          className="touch-target mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#2aa7ad]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[#1a7f84] sm:w-auto"
        >
          Sign in to become a team owner
        </Link>
      ) : null}

      {requestedNotice && tab === "current" ? (
        <p className="mt-6 rounded-2xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-4 py-3 text-sm text-[#1a7f84]">
          {requestedNotice}
        </p>
      ) : null}

      {tab === "current" && myTeams.length > 0 ? (
        <section className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
            Captain
          </p>
          <h2 className="mt-1 text-lg font-bold text-[#3e2723]">
            {myTeams.length === 1 ? "Your team" : "Your teams"}
          </h2>
          <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                href={`/teams/${team.id}`}
                showStatus
                highlight
                actionLabel="Manage squad"
              />
            ))}
          </div>
        </section>
      ) : null}

      {blocks.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#2aa7ad]/35 bg-white/60 px-5 py-8 text-center">
          <p className="font-medium text-[#3e2723]">
            {tab === "past"
              ? "No past tournaments yet"
              : "No upcoming or ongoing tournament"}
          </p>
          <p className="mt-2 text-sm text-[#3e2723]/60">
            {tab === "past"
              ? "Completed editions will show here with their teams."
              : "When an edition is upcoming or live, its teams appear here."}
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {blocks.map(({ tournament, teams }) => {
            const dates = formatTournamentDates(
              tournament.start_date,
              tournament.end_date,
            );
            const statusTone =
              tournament.status === "ongoing"
                ? "bg-[#2aa7ad]/12 text-[#1a7f84]"
                : tournament.status === "upcoming"
                  ? "bg-[#f5b830]/20 text-[#8a6500]"
                  : "bg-[#3e2723]/8 text-[#3e2723]/70";
            return (
              <section key={tournament.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-[#3e2723]">
                      {tournament.name}
                      {tournament.short_name ? (
                        <span className="ml-1.5 font-medium text-[#3e2723]/45">
                          ({tournament.short_name})
                        </span>
                      ) : null}
                    </h2>
                    {dates || tournament.location ? (
                      <p className="mt-1 text-sm text-[#3e2723]/60">
                        {[dates, tournament.location].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone}`}
                  >
                    {tournamentStatusLabel(tournament.status)}
                  </span>
                </div>

                {teams.length === 0 ? (
                  <p className="mt-4 text-sm text-[#3e2723]/55">
                    No teams in this tournament yet.
                  </p>
                ) : (
                  <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {teams.map((team) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        href={`/teams/${team.id}`}
                        showStatus
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
