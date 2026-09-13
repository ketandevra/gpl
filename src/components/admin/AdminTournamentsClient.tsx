"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import type { TournamentStatus } from "@/lib/types/database";

export type AdminTournament = {
  id: string;
  name: string;
  short_name: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_open: boolean;
  status: TournamentStatus;
  is_active: boolean;
  created_at: string;
};

type Props = {
  tournaments: AdminTournament[];
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AdminTournamentsClient({ tournaments: initial }: Props) {
  const router = useRouter();
  const [tournaments, setTournaments] = useState(initial);
  const [name, setName] = useState("Ghanchi Premier League");
  const [shortName, setShortName] = useState("GPL");
  const [location, setLocation] = useState("Pali, Rajasthan");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(plusDaysISO(14));
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [status, setStatus] = useState<TournamentStatus>("upcoming");
  const [makeActive, setMakeActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const active = useMemo(
    () => tournaments.find((t) => t.is_active) ?? null,
    [tournaments],
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          short_name: shortName.trim() || null,
          location: location.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          registration_open: registrationOpen,
          status,
          is_active: makeActive,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        tournament?: AdminTournament;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not create tournament.");
        return;
      }
      if (data.tournament) {
        setTournaments((prev) => {
          const next = makeActive
            ? prev.map((t) => ({ ...t, is_active: false }))
            : prev;
          return [data.tournament!, ...next];
        });
        setMessage(`Created “${data.tournament.name}”.`);
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function patchTournament(
    tournamentId: string,
    updates: Partial<
      Pick<
        AdminTournament,
        "is_active" | "registration_open" | "status"
      >
    >,
  ) {
    setActionId(tournamentId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/tournaments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: tournamentId, ...updates }),
      });
      const data = (await res.json()) as {
        error?: string;
        tournament?: AdminTournament;
      };
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      if (data.tournament) {
        setTournaments((prev) =>
          prev.map((t) => {
            if (t.id === data.tournament!.id) return data.tournament!;
            if (updates.is_active === true) return { ...t, is_active: false };
            return t;
          }),
        );
        setMessage("Tournament updated.");
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Tournaments</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Create the active season. Teams, players, and matches attach to the
        active tournament.
      </p>

      {active ? (
        <p className="mt-3 rounded-xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-3 py-2 text-sm text-[#1a7f84]">
          Active now: <strong>{active.name}</strong>
          {active.registration_open ? " · team registration open" : ""}
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-[#f5b830]/40 bg-[#fff6df] px-3 py-2 text-sm text-[#3e2723]">
          No active tournament. Create one below (or set an existing one
          active).
        </p>
      )}

      <form
        onSubmit={onCreate}
        className="mt-6 space-y-3 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-[#3e2723]">Create tournament</h2>

        <label className="block">
          <span className="mb-1 block text-sm text-[#3e2723]/70">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="field"
            placeholder="Ghanchi Premier League"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Short name
            </span>
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value.slice(0, 12))}
              className="field"
              placeholder="GPL"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Location
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="field"
              placeholder="Pali, Rajasthan"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Start date
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="field"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TournamentStatus)}
              className="field-select"
            >
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-[#3e2723]">
              <input
                type="checkbox"
                checked={registrationOpen}
                onChange={(e) => setRegistrationOpen(e.target.checked)}
              />
              Open team registration
            </label>
            <label className="flex items-center gap-2 text-sm text-[#3e2723]">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
              />
              Set as active tournament
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="w-full rounded-full bg-[#2aa7ad] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create tournament"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-8 space-y-3">
        {tournaments.length === 0 ? (
          <li className="rounded-xl border border-dashed border-[#3e2723]/15 px-4 py-6 text-sm text-[#3e2723]/55">
            No tournaments yet.
          </li>
        ) : (
          tournaments.map((t) => (
            <li
              key={t.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm ${
                t.is_active ? "border-[#2aa7ad]" : "border-[#3e2723]/10"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#3e2723]">{t.name}</p>
                  <p className="text-xs text-[#3e2723]/55">
                    {[t.short_name, t.location].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>
                  <p className="mt-1 text-xs text-[#3e2723]/50">
                    {t.start_date ?? "?"} → {t.end_date ?? "?"} ·{" "}
                    {t.status}
                    {t.is_active ? " · ACTIVE" : ""}
                    {t.registration_open ? " · reg open" : " · reg closed"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!t.is_active ? (
                  <button
                    type="button"
                    disabled={actionId === t.id}
                    onClick={() =>
                      void patchTournament(t.id, { is_active: true })
                    }
                    className="rounded-full bg-[#2aa7ad] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Make active
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={actionId === t.id}
                  onClick={() =>
                    void patchTournament(t.id, {
                      registration_open: !t.registration_open,
                    })
                  }
                  className="rounded-full border border-[#3e2723]/15 px-3 py-1.5 text-xs font-semibold text-[#3e2723] disabled:opacity-50"
                >
                  {t.registration_open ? "Close registration" : "Open registration"}
                </button>
                {t.status !== "ongoing" ? (
                  <button
                    type="button"
                    disabled={actionId === t.id}
                    onClick={() =>
                      void patchTournament(t.id, { status: "ongoing" })
                    }
                    className="rounded-full border border-[#3e2723]/15 px-3 py-1.5 text-xs font-semibold text-[#3e2723] disabled:opacity-50"
                  >
                    Mark ongoing
                  </button>
                ) : null}
                {t.status !== "completed" ? (
                  <button
                    type="button"
                    disabled={actionId === t.id}
                    onClick={() =>
                      void patchTournament(t.id, {
                        status: "completed",
                        registration_open: false,
                      })
                    }
                    className="rounded-full border border-[#d81b60]/30 px-3 py-1.5 text-xs font-semibold text-[#d81b60] disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      <BackLink href="/admin" className="mt-6">
        Back to dashboard
      </BackLink>
    </div>
  );
}
