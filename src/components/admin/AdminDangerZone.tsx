"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DANGER_SCOPES,
  type DangerScopeId,
} from "@/lib/admin/danger-scopes";

type Counts = {
  users: number;
  teams: number;
  players: number;
  matches: number;
};

type AdminDangerZoneProps = {
  counts: Counts;
};

export function AdminDangerZone({ counts }: AdminDangerZoneProps) {
  const router = useRouter();
  const [openId, setOpenId] = useState<DangerScopeId | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<DangerScopeId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = DANGER_SCOPES.find((s) => s.id === openId);

  async function run(scope: DangerScopeId, phrase: string) {
    if (confirm !== phrase) {
      setError(`Type ${phrase} exactly to confirm.`);
      return;
    }
    setBusy(scope);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, confirmation: confirm }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        sign_out?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not remove that data.");
        return;
      }
      setMessage(data.message ?? "Removed.");
      setOpenId(null);
      setConfirm("");
      if (data.sign_out) {
        router.replace("/login?next=/admin");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-[#d81b60]/30 bg-[#fff5f8] p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#9f1239]">Danger zone</h2>
      <p className="mt-2 text-sm text-[#3e2723]/70">
        Remove one kind of data, or wipe everything. These actions cannot be
        undone. GPL Admin (<code>9636933097</code>) is never deleted.
      </p>

      <ul className="mt-4 space-y-3">
        {DANGER_SCOPES.map((scope) => {
          const count =
            scope.countKey != null ? counts[scope.countKey] : null;
          const isOpen = openId === scope.id;
          const isAll = scope.id === "all";
          return (
            <li
              key={scope.id}
              className={`rounded-xl border bg-white p-4 ${
                isAll
                  ? "border-[#d81b60]/40"
                  : "border-[#3e2723]/10"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-[#3e2723]">
                    {scope.title}
                    {count != null ? (
                      <span className="ml-2 text-sm font-normal text-[#3e2723]/50">
                        ({count})
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[#3e2723]/60">{scope.detail}</p>
                </div>
                {!isOpen ? (
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => {
                      setOpenId(scope.id);
                      setConfirm("");
                      setError(null);
                      setMessage(null);
                    }}
                    className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                      isAll
                        ? "border border-[#d81b60]/50 text-[#d81b60]"
                        : "border border-[#3e2723]/20 text-[#3e2723]"
                    }`}
                  >
                    {isAll ? "Reset all data…" : "Remove…"}
                  </button>
                ) : null}
              </div>

              {isOpen ? (
                <div className="mt-4 space-y-3 border-t border-[#3e2723]/8 pt-4">
                  <label className="block">
                    <span className="mb-1 block text-sm text-[#3e2723]">
                      Type <strong>{scope.confirm}</strong> to confirm
                    </span>
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="field border-[#d81b60]/30 focus:[box-shadow:0_0_0_2px_#d81b60]"
                      placeholder={scope.confirm}
                      autoComplete="off"
                      disabled={busy != null}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy != null || confirm !== scope.confirm}
                      onClick={() => void run(scope.id, scope.confirm)}
                      className="rounded-full bg-[#d81b60] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === scope.id
                        ? "Deleting…"
                        : isAll
                          ? "Delete everything now"
                          : "Delete now"}
                    </button>
                    <button
                      type="button"
                      disabled={busy != null}
                      onClick={() => {
                        setOpenId(null);
                        setConfirm("");
                      }}
                      className="rounded-full border border-[#3e2723]/20 px-4 py-2.5 text-sm font-semibold text-[#3e2723]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {open ? null : message ? (
        <p className="mt-4 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
