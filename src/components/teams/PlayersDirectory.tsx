"use client";

import { useMemo, useState } from "react";
import { PlayerCard } from "@/components/teams/PlayerCard";
import type { PlayerRow } from "@/lib/teams/types";

export type DirectoryPlayer = PlayerRow & {
  avatar_url: string | null;
  team_name?: string;
};

type Props = {
  players: DirectoryPlayer[];
};

export function PlayersDirectory({ players }: Props) {
  const [query, setQuery] = useState("");

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
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, player ID, or mobile"
        className="mt-5 w-full rounded-xl border border-[#3e2723]/15 bg-white px-3 py-3 text-base outline-none ring-[#2aa7ad] focus:ring-2 sm:text-sm"
        aria-label="Search players"
        type="search"
        inputMode="search"
      />

      <p className="mt-3 text-sm text-[#3e2723]/60">
        {query.trim()
          ? `${filtered.length} of ${players.length} players`
          : `${players.length} player${players.length === 1 ? "" : "s"}`}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#2aa7ad]/35 bg-white/60 px-5 py-8 text-center text-sm text-[#3e2723]/65">
          {query.trim()
            ? "No players match that search."
            : "No verified players to show yet."}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              href={`/players/${player.id}`}
              hideTeamName
              showMobile
              statusLine={player.team_name ?? "Available"}
              statusTone={player.team_name ? "default" : "available"}
            />
          ))}
        </div>
      )}
    </>
  );
}
