"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ManualTeamDraw } from "@/components/admin/ManualTeamDraw";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { FixtureWorkspace } from "@/lib/fixtures/service";

type Props = {
  initial: FixtureWorkspace;
  tournaments: { id: string; name: string; is_active: boolean }[];
  selectedId: string;
};

export function ManualTeamDrawClient({
  initial,
  tournaments,
  selectedId,
}: Props) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as FixtureWorkspace & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setWorkspace(data);
      setMessage(ok);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
      <Link
        href={`/admin/fixtures?tournament=${selectedId}`}
        className="text-sm font-semibold text-[#1a7f84]"
      >
        ← Fixtures
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[#3e2723]">Manual Team Draw</h1>
        <button
          type="button"
          disabled={busy}
          onClick={() => setResetOpen(true)}
          className="rounded-full border border-[#d81b60]/30 px-3 py-1.5 text-xs font-semibold text-[#9f1239] disabled:opacity-50"
        >
          Reset fixtures
        </button>
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm text-[#3e2723]/70">Tournament</span>
        <select
          value={selectedId}
          onChange={(event) => {
            router.push(`/admin/fixtures/draw?tournament=${event.target.value}`);
          }}
          className="field-select"
        >
          {tournaments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
              {row.is_active ? " (active)" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-5">
        <ManualTeamDraw
          workspace={workspace}
          busy={busy}
          error={error}
          message={message}
          onDraw={(teamId) =>
            void run(
              {
                action: "draw_team",
                tournament_id: workspace.tournament.id,
                team_id: teamId,
              },
              "Team added to the draw.",
            )
          }
          onUndraw={(position) =>
            void run(
              {
                action: "undraw_position",
                tournament_id: workspace.tournament.id,
                draw_position: position,
              },
              "Draw position cleared.",
            )
          }
          onConfirm={() =>
            void run(
              {
                action: "confirm_draw",
                tournament_id: workspace.tournament.id,
              },
              "Draw confirmed.",
            )
          }
          onUnlock={() =>
            void run(
              {
                action: "unlock_draw",
                tournament_id: workspace.tournament.id,
                confirm: true,
              },
              "Draw unlocked.",
            )
          }
        />
      </div>
      {resetOpen ? (
        <ConfirmDialog
          title="Reset fixtures for testing?"
          body="This deletes the draw, league fixtures, knockout matches, and results for this tournament. Teams and setup stay so you can start again."
          confirmLabel="Reset fixtures"
          danger
          busy={busy}
          onCancel={() => setResetOpen(false)}
          onConfirm={() => {
            setResetOpen(false);
            void run(
              {
                action: "reset_fixtures",
                tournament_id: workspace.tournament.id,
                confirm: true,
              },
              "Fixtures reset. You can start the draw again.",
            );
          }}
        />
      ) : null}
    </div>
  );
}
