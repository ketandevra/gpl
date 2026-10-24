"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { FixtureWorkspace } from "@/lib/fixtures/service";

type Props = {
  workspace: FixtureWorkspace;
  busy: boolean;
  error: string | null;
  message: string | null;
  onDraw: (teamId: string) => void;
  onUndraw: (position: number) => void;
  onConfirm: () => void;
  onUnlock: () => void;
};

export function ManualTeamDraw({
  workspace,
  busy,
  error,
  message,
  onDraw,
  onUndraw,
  onConfirm,
  onUnlock,
}: Props) {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const total = workspace.participants.length;
  const drawn = workspace.draw.length;
  const remaining = Math.max(0, total - drawn);
  const locked = workspace.tournament.draw_status === "confirmed";
  const progress = total ? Math.round((drawn / total) * 100) : 0;
  const slots = useMemo(() => {
    const byPosition = new Map(
      workspace.draw.map((row) => [row.draw_position, row]),
    );
    return Array.from({ length: Math.max(total, drawn) }, (_, index) => {
      const position = index + 1;
      return { position, row: byPosition.get(position) ?? null };
    });
  }, [workspace.draw, drawn, total]);

  return (
    <section className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2aa7ad]">
            Manual Team Draw
          </p>
          <h2 className="mt-1 text-lg font-bold text-[#3e2723]">
            Enter the slip order
          </h2>
          <p className="mt-1 text-sm text-[#3e2723]/65">
            Draw team slips physically, then tap the matching team. The app
            never shuffles or reassigns positions.
          </p>
        </div>
        <p className="rounded-full bg-[#fdf6e8] px-3 py-1.5 text-xs font-semibold text-[#3e2723]">
          {drawn} drawn · {remaining} remaining
        </p>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#efe4cf]">
        <div
          className="h-full rounded-full bg-[#2aa7ad] transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-xl border border-[#3e2723]/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#fdf6e8] text-[11px] font-semibold uppercase tracking-wide text-[#3e2723]/55">
            <tr>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Status</th>
              {!locked ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {slots.map(({ position, row }) => (
              <tr key={position} className="border-t border-[#3e2723]/8">
                <td className="px-3 py-2.5 font-bold tabular-nums text-[#1a7f84]">
                  {position}
                </td>
                <td className="px-3 py-2.5">
                  {row?.team ? (
                    <span className="flex items-center gap-2">
                      {row.team.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.team.logo_url}
                          alt=""
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#efe4cf] text-xs font-bold">
                          {row.team.short_name.slice(0, 2)}
                        </span>
                      )}
                      <span className="font-semibold text-[#3e2723]">
                        {row.team.name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[#3e2723]/40">Waiting for slip</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs font-semibold">
                  {row ? (
                    <span className="text-[#1a7f84]">Drawn</span>
                  ) : (
                    <span className="text-[#3e2723]/40">Pending</span>
                  )}
                </td>
                {!locked ? (
                  <td className="px-3 py-2.5 text-right">
                    {row ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onUndraw(position)}
                        className="text-xs font-semibold text-[#9f1239] disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!locked ? (
        <>
          <h3 className="mt-5 text-sm font-bold text-[#3e2723]">
            Available team slips
          </h3>
          {workspace.available_teams.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {workspace.available_teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onDraw(team.id)}
                  className="flex items-center gap-2 rounded-xl border border-[#3e2723]/10 bg-[#fdf6e8] px-3 py-2.5 text-left disabled:opacity-50"
                >
                  {team.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.logo_url}
                      alt=""
                      className="h-8 w-8 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-bold">
                      {team.short_name.slice(0, 2)}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-[#3e2723]">
                    {team.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#3e2723]/60">
              Every selected team has a draw position.
            </p>
          )}

          <button
            type="button"
            disabled={busy || remaining > 0 || total < 2}
            onClick={onConfirm}
            className="mt-5 w-full rounded-full bg-[#2aa7ad] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {remaining > 0
              ? `Draw ${remaining} more ${remaining === 1 ? "team" : "teams"} to confirm`
              : "Confirm draw order"}
          </button>
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-[#2aa7ad]/30 bg-[#2aa7ad]/8 px-4 py-3">
          <p className="text-sm font-semibold text-[#1a7f84]">Draw locked</p>
          <p className="mt-1 text-sm text-[#3e2723]/65">
            {workspace.unlock_impact.message}
          </p>
          <button
            type="button"
            disabled={busy || !workspace.unlock_impact.can_unlock}
            onClick={() => setUnlockOpen(true)}
            className="mt-3 rounded-full border border-[#3e2723]/15 px-4 py-2 text-xs font-semibold text-[#3e2723] disabled:opacity-50"
          >
            Unlock draw
          </button>
        </div>
      )}

      {unlockOpen ? (
        <ConfirmDialog
          title="Unlock the confirmed draw?"
          body={workspace.unlock_impact.message}
          confirmLabel="Unlock draw"
          danger
          busy={busy}
          onCancel={() => setUnlockOpen(false)}
          onConfirm={() => {
            setUnlockOpen(false);
            onUnlock();
          }}
        />
      ) : null}
    </section>
  );
}
