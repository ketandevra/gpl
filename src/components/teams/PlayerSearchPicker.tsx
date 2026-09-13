"use client";

import { useEffect, useRef, useState } from "react";
import { formatPlayerLabel } from "@/lib/teams/labels";
import type { PlayerAvailability, PlayerRow } from "@/lib/teams/types";

export type PickerPlayer = PlayerRow & {
  availability: PlayerAvailability;
  locked_team_name: string | null;
  pending_other_team_names: string[];
};

type Props = {
  selectedIds: string[];
  onAdd: (player: PickerPlayer) => void;
  disabled?: boolean;
  excludeTeamId?: string;
};

export function PlayerSearchPicker({
  selectedIds,
  onAdd,
  disabled,
  excludeTeamId,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<PickerPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = new Set(selectedIds);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams();
          if (query.trim()) params.set("q", query.trim());
          if (excludeTeamId) params.set("exclude_team_id", excludeTeamId);
          const res = await fetch(`/api/players?${params.toString()}`, {
            credentials: "same-origin",
          });
          const data = (await res.json()) as {
            players?: PickerPlayer[];
            error?: string;
          };
          if (!res.ok) {
            setError(data.error ?? "Search failed");
            setPlayers([]);
            return;
          }
          setPlayers(data.players ?? []);
        } catch {
          setError("Network error");
          setPlayers([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => clearTimeout(handle);
  }, [query, excludeTeamId]);

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[#3e2723]">
          Search verified players
        </span>
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Player ID, name, or mobile…"
          className="w-full rounded-xl border border-[#3e2723]/15 bg-[#fdf6e8] px-3 py-3 outline-none ring-[#2aa7ad] focus:ring-2 disabled:opacity-50"
        />
      </label>
      <p className="mt-1 text-xs text-[#3e2723]/45">
        Only admin-verified users appear. Search runs on the server.
      </p>

      {open ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#3e2723]/12 bg-white shadow-lg">
          {loading ? (
            <li className="px-3 py-3 text-sm text-[#3e2723]/55">Searching…</li>
          ) : error ? (
            <li className="px-3 py-3 text-sm text-[#9f1239]">{error}</li>
          ) : players.length === 0 ? (
            <li className="px-3 py-3 text-sm text-[#3e2723]/55">
              No verified players match
            </li>
          ) : (
            players.map((player) => {
              const already = selected.has(player.id);
              const locked = player.availability.status === "locked";
              const blocked = already || locked;
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    disabled={blocked || disabled}
                    onClick={() => {
                      onAdd(player);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-[#2aa7ad]/8 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="text-sm font-semibold text-[#3e2723]">
                      {formatPlayerLabel(player)}
                    </span>
                    <span className="text-xs text-[#3e2723]/55">
                      {already
                        ? "Already added to this team"
                        : player.availability.label}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
