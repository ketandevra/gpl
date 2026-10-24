"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerCard } from "@/components/teams/PlayerCard";
import { IconSearch } from "@/components/ui/Icons";
import type { PlayerRow } from "@/lib/teams/types";
import type { TeamRegistrationStatus } from "@/lib/types/database";

export type DirectoryPlayer = PlayerRow & {
  avatar_url: string | null;
  team_name?: string;
  team_status?: TeamRegistrationStatus;
};

type Props = {
  players: DirectoryPlayer[];
};

export function PlayersDirectory({ players }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    for (const player of players.slice(0, 24)) {
      router.prefetch(`/players/${player.id}`);
    }
  }, [players, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    const qDigits = q.replace(/\D/g, "");
    return players.filter((player) => {
      const nameMatch = player.name.toLowerCase().includes(q);
      const idMatch = player.public_code.toLowerCase().includes(q);
      const mobileMatch = Boolean(
        player.mobile_number &&
          (player.mobile_number.includes(q) ||
            (qDigits.length > 0 &&
              player.mobile_number.replace(/\D/g, "").includes(qDigits))),
      );
      const teamMatch = Boolean(player.team_name?.toLowerCase().includes(q));
      return nameMatch || idMatch || mobileMatch || teamMatch;
    });
  }, [players, query]);

  return (
    <>
      <label className="relative mt-3 block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3e2723]/35">
          <IconSearch className="h-[18px] w-[18px]" />
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, ID, team, or mobile"
          className="h-12 w-full rounded-2xl bg-white pl-11 pr-4 text-base text-[#3e2723] outline-none ring-1 ring-[#3e2723]/10 placeholder:text-[#3e2723]/40 focus:ring-2 focus:ring-[#2aa7ad]"
          aria-label="Search players"
          type="search"
          inputMode="search"
        />
      </label>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-[1.35rem] bg-white/70 px-5 py-10 text-center text-sm text-[#3e2723]/65 ring-1 ring-dashed ring-[#2aa7ad]/35">
          {query.trim()
            ? "No players match that search."
            : "No verified players to show yet."}
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player) => {
            const accepted =
              player.team_status === "approved" || Boolean(player.locked_team_id);
            return (
              <PlayerCard
                key={player.id}
                player={player}
                href={`/players/${player.id}`}
                hideTeamName
                showMobile
                statusLine={
                  accepted && player.team_name ? player.team_name : "Available"
                }
                statusTone={accepted && player.team_name ? "default" : "available"}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
