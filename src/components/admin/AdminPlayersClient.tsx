"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerCard } from "@/components/teams/PlayerCard";
import type { PlayerRow } from "@/lib/teams/types";
import { formatPlayerLabel } from "@/lib/teams/labels";

type Props = {
  players: Array<PlayerRow & { team_name?: string }>;
};

export function AdminPlayersClient({ players: initial }: Props) {
  const router = useRouter();
  const [players, setPlayers] = useState(initial);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mobile_number: mobile.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        player?: PlayerRow;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not create player.");
        return;
      }
      if (data.player) {
        setPlayers((prev) => [...prev, data.player!]);
        setMessage(`Added ${formatPlayerLabel(data.player)}`);
        setName("");
        setMobile("");
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Player pool</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Tournament-wide registry. Teams select from this list; approval locks a
        player to one team.
      </p>

      <form
        onSubmit={onCreate}
        className="mt-6 space-y-3 rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm"
      >
        <h2 className="font-semibold text-[#3e2723]">Add player</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="rounded-xl border border-[#3e2723]/15 px-3 py-2.5 text-sm"
            required
          />
          <input
            value={mobile}
            onChange={(e) =>
              setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="Mobile (optional)"
            className="rounded-xl border border-[#3e2723]/15 px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="rounded-full bg-[#2aa7ad] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create player"}
        </button>
        {message ? (
          <p className="text-sm text-[#1a7f84]">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-[#9f1239]">{error}</p> : null}
      </form>

      <p className="mt-6 text-sm text-[#3e2723]/60">
        {players.length} players in the active tournament
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            href={`/players/${player.id}`}
            statusLine={
              player.locked_team_id
                ? player.team_name
                  ? `Locked: ${player.team_name}`
                  : "Locked to approved team"
                : "Available"
            }
          />
        ))}
      </div>

      {players.length === 0 ? (
        <p className="mt-6 text-sm text-[#3e2723]/60">No players yet.</p>
      ) : null}

      <Link
        href="/admin/teams"
        className="mt-8 inline-flex text-sm font-semibold text-[#1a7f84]"
      >
        Manage team approvals →
      </Link>
    </div>
  );
}
