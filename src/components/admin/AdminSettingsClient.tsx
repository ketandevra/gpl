"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SQUAD_SIZE_MAX, SQUAD_SIZE_MIN } from "@/lib/constants";

type Props = {
  squadSize: number;
};

export function AdminSettingsClient({ squadSize: initial }: Props) {
  const router = useRouter();
  const [squadSize, setSquadSize] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(squadSize);
    if (!Number.isInteger(n) || n < SQUAD_SIZE_MIN || n > SQUAD_SIZE_MAX) {
      setError(
        `Players per team must be a whole number from ${SQUAD_SIZE_MIN} to ${SQUAD_SIZE_MAX}.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ squad_size: n }),
      });
      const data = (await res.json()) as { error?: string; squad_size?: number };
      if (!res.ok) {
        setError(data.error ?? "Could not save settings.");
        return;
      }
      if (typeof data.squad_size === "number") {
        setSquadSize(String(data.squad_size));
      }
      setMessage("Settings saved.");
      router.refresh();
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
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Settings</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        League rules used when captains build squads and when you approve a team.
      </p>

      <form
        onSubmit={(e) => void onSave(e)}
        className="mt-6 max-w-lg space-y-4 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-[#3e2723]">Team roster</h2>
        <label className="block">
          <span className="mb-1 block text-sm text-[#3e2723]/70">
            Players per team
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={SQUAD_SIZE_MIN}
            max={SQUAD_SIZE_MAX}
            step={1}
            value={squadSize}
            onChange={(e) => setSquadSize(e.target.value)}
            className="field"
          />
          <span className="mt-1.5 block text-xs text-[#3e2723]/50">
            A squad must have exactly this many players before it can be
            approved ({SQUAD_SIZE_MIN}–{SQUAD_SIZE_MAX}).
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="touch-target inline-flex items-center justify-center rounded-full bg-[#2aa7ad] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save settings"}
        </button>

        {message ? (
          <p className="text-sm text-[#1a7f84]" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-[#9f1239]" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
