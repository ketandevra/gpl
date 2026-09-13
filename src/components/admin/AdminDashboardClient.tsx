"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminDangerZone } from "@/components/admin/AdminDangerZone";

type AdminDashboardClientProps = {
  totals: {
    users: number;
    teams: number;
    players: number;
    matches: number;
    live: number;
    upcoming: number;
    completed: number;
  };
  userRegistrationOpen: boolean;
  teamRegistrationOpen: boolean;
  tournamentName: string | null;
  configured: boolean;
};

export function AdminDashboardClient({
  totals,
  userRegistrationOpen,
  teamRegistrationOpen,
  tournamentName,
  configured,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [userOpen, setUserOpen] = useState(userRegistrationOpen);
  const [teamOpen, setTeamOpen] = useState(teamRegistrationOpen);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"user" | "team" | null>(null);

  async function toggle(kind: "user" | "team", next: boolean) {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      const body =
        kind === "user"
          ? { user_registration_open: next }
          : { team_registration_open: next };

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update settings.");
        return;
      }

      if (kind === "user") setUserOpen(next);
      else setTeamOpen(next);

      setMessage(
        kind === "user"
          ? next
            ? "User registration opened."
            : "User registration closed."
          : next
            ? "Team registration opened."
            : "Team registration closed.",
      );
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  if (!configured) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Admin dashboard</h1>
        <p className="mt-3 rounded-xl border border-[#f5b830]/40 bg-[#fff6df] px-4 py-3 text-sm text-[#3e2723]">
          Connect Supabase in <code>.env.local</code> (including{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>) to manage users and
          registration.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Users", value: totals.users },
    { label: "Teams", value: totals.teams },
    { label: "Players", value: totals.players },
    { label: "Matches", value: totals.matches },
    { label: "Live", value: totals.live },
    { label: "Upcoming", value: totals.upcoming },
    { label: "Completed", value: totals.completed },
  ];

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Dashboard</h1>
      {tournamentName ? (
        <p className="mt-1 text-sm text-[#3e2723]/60">{tournamentName}</p>
      ) : (
        <div className="mt-3 rounded-xl border border-[#f5b830]/40 bg-[#fff6df] px-4 py-3 text-sm text-[#3e2723]">
          No active tournament.{" "}
          <a
            href="/admin/tournaments"
            className="font-semibold text-[#1a7f84] underline"
          >
            Create one
          </a>{" "}
          to enable teams, players, and matches.
        </div>
      )}

      <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#3e2723]/8 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-[#3e2723]/50">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#3e2723]">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <nav className="mt-6 flex flex-wrap gap-2">
        {[
          ["/admin/tournaments", "Tournaments"],
          ["/admin/users", "Users"],
          ["/admin/verifications", "Verifications"],
          ["/admin/teams", "Teams"],
          ["/admin/players", "Players"],
          ["/admin/matches", "Matches"],
          ["/admin/scoring", "Scoring desk"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-[#3e2723]/15 bg-white px-3 py-1.5 text-sm font-semibold text-[#3e2723]"
          >
            {label}
          </a>
        ))}
      </nav>

      <section className="mt-8 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#3e2723]">Registration</h2>
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-[#3e2723]">User registration</p>
              <p className="text-sm text-[#3e2723]/60">
                Status:{" "}
                <span className={userOpen ? "text-[#1a7f84]" : "text-[#9f1239]"}>
                  {userOpen ? "OPEN" : "CLOSED"}
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={busy === "user"}
              onClick={() => toggle("user", !userOpen)}
              className="touch-target rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {userOpen ? "Close user registration" : "Open user registration"}
            </button>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#3e2723]/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-[#3e2723]">Team registration</p>
              <p className="text-sm text-[#3e2723]/60">
                Status:{" "}
                <span className={teamOpen ? "text-[#1a7f84]" : "text-[#9f1239]"}>
                  {teamOpen ? "OPEN" : "CLOSED"}
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={busy === "team" || !tournamentName}
              onClick={() => toggle("team", !teamOpen)}
              className="touch-target rounded-full border border-[#3e2723]/20 px-4 py-2.5 text-sm font-semibold text-[#3e2723] disabled:opacity-60"
            >
              {teamOpen ? "Close team registration" : "Open team registration"}
            </button>
          </div>
        </div>

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
      </section>

      <AdminDangerZone
        counts={{
          users: totals.users,
          teams: totals.teams,
          players: totals.players,
          matches: totals.matches,
        }}
      />
    </div>
  );
}
