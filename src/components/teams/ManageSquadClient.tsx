"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PlayerSearchPicker,
  type PickerPlayer,
} from "@/components/teams/PlayerSearchPicker";
import { formatPlayerLabel } from "@/lib/teams/labels";
import type { TeamPlayerView } from "@/lib/teams/types";

type Props = {
  teamId: string;
  initialPlayers: TeamPlayerView[];
  canEdit: boolean;
  approved: boolean;
  squadSize: number;
};

export function ManageSquadClient({
  teamId,
  initialPlayers,
  canEdit,
  approved,
  squadSize,
}: Props) {
  const router = useRouter();
  const [players, setPlayers] = useState(initialPlayers);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canEdit) return null;

  const spotsLeft = squadSize - players.length;
  const isFull = players.length >= squadSize;

  async function addPlayer(player: PickerPlayer) {
    if (isFull) {
      setError(`Squad is full (${squadSize}/${squadSize}).`);
      return;
    }
    if (players.some((p) => p.id === player.id)) {
      setError("This player is already on the squad.");
      return;
    }
    if (player.availability.status === "locked") {
      setError(
        `Cannot add ${formatPlayerLabel(player)} — already in an approved team.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ player_id: player.id }),
      });
      const data = (await res.json()) as {
        error?: string;
        players?: TeamPlayerView[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not add player.");
        return;
      }
      setPlayers(data.players ?? []);
      setMessage(`Added ${formatPlayerLabel(player)}.`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function removePlayer(playerId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ player_id: playerId }),
      });
      const data = (await res.json()) as {
        error?: string;
        players?: TeamPlayerView[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not remove player.");
        return;
      }
      setPlayers(data.players ?? []);
      setMessage("Player removed.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#3e2723]">Manage squad</h2>
        <p className="text-sm font-semibold text-[#1a7f84]">
          {players.length} / {squadSize} players
        </p>
      </div>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        {approved
          ? "This team is approved. Only an admin can change the roster."
          : `Add exactly ${squadSize} verified players. ${
              spotsLeft > 0
                ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.`
                : "Squad is complete — waiting for admin approval."
            }`}
      </p>

      {!approved && !isFull ? (
        <div className="mt-4">
          <PlayerSearchPicker
            selectedIds={players.map((p) => p.id)}
            onAdd={(p) => void addPlayer(p)}
            disabled={busy}
            excludeTeamId={teamId}
          />
        </div>
      ) : null}

      {!approved && isFull ? (
        <p className="mt-4 rounded-xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-3 py-2 text-sm text-[#1a7f84]">
          Squad complete ({squadSize}/{squadSize}). An admin can now
          approve this team.
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[#3e2723]/8 bg-[#fdf6e8]/70 px-3 py-2"
          >
            <span className="text-sm font-semibold text-[#3e2723]">
              {formatPlayerLabel(p)}
            </span>
            {!approved ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removePlayer(p.id)}
                className="text-xs font-medium text-[#9f1239] disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {players.length === 0 ? (
          <li className="text-sm text-[#3e2723]/50">No players yet.</li>
        ) : null}
      </ul>

      {message ? (
        <p className="mt-3 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-[#9f1239]">
          {error}
        </pre>
      ) : null}
    </section>
  );
}
