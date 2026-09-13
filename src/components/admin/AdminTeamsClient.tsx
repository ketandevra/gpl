"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TeamPlayerView, TeamRow } from "@/lib/teams/types";
import { formatPlayerLabel, teamStatusLabel } from "@/lib/teams/labels";

type AdminTeam = TeamRow & {
  manager_name: string | null;
  player_count: number;
  players?: TeamPlayerView[];
};

type CaptainOption = {
  id: string;
  name: string;
  mobile_number: string;
  role: string;
  is_active: boolean;
  verification_status: string;
};

export function AdminTeamsClient({ teams: initial }: { teams: AdminTeam[] }) {
  const router = useRouter();
  const [teams, setTeams] = useState(initial);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "all",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [captainId, setCaptainId] = useState("");
  const [captainQuery, setCaptainQuery] = useState("");
  const [captains, setCaptains] = useState<CaptainOption[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/users");
        const data = (await res.json()) as { users?: CaptainOption[] };
        if (res.ok) {
          setCaptains(
            (data.users ?? []).filter(
              (u) => u.is_active && u.verification_status === "verified",
            ),
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return teams;
    return teams.filter((t) => t.registration_status === filter);
  }, [teams, filter]);

  const captainMatches = useMemo(() => {
    const q = captainQuery.trim().toLowerCase();
    if (!q) return captains.slice(0, 20);
    return captains
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.mobile_number.includes(q) ||
          u.id === captainId,
      )
      .slice(0, 20);
  }, [captains, captainQuery, captainId]);

  const selectedCaptain = captains.find((c) => c.id === captainId);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          short_name: shortName.trim(),
          captain_id: captainId,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        team?: TeamRow;
        captain_name?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not create team.");
        return;
      }
      if (data.team) {
        setTeams((prev) => [
          {
            ...data.team!,
            manager_name: data.captain_name ?? null,
            player_count: 0,
            players: [],
          },
          ...prev,
        ]);
        setMessage(
          `Created “${data.team.name}”. Captain can now add squad members.`,
        );
        setName("");
        setShortName("");
        setCaptainId("");
        setCaptainQuery("");
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  async function decide(teamId: string, decision: "approve" | "reject") {
    setBusyId(teamId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId, decision }),
      });
      const data = (await res.json()) as { error?: string; team?: TeamRow };
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      if (data.team) {
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  approved: data.team!.approved,
                  registration_status: data.team!.registration_status,
                }
              : t,
          ),
        );
      }
      setMessage(decision === "approve" ? "Team approved." : "Team rejected.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Teams</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Create teams and assign a verified captain. The captain adds verified
        players; you approve the squad when it is complete.
      </p>

      <form
        onSubmit={createTeam}
        className="mt-6 space-y-3 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-[#3e2723]">Create team</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Team name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="field"
              placeholder="Pali Warriors"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Short name
            </span>
            <input
              value={shortName}
              maxLength={6}
              onChange={(e) =>
                setShortName(
                  e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                )
              }
              required
              className="field tracking-widest"
              placeholder="PW"
            />
          </label>
        </div>

        <div>
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Assign captain
            </span>
            <input
              value={captainQuery}
              onChange={(e) => setCaptainQuery(e.target.value)}
              placeholder="Search by name or mobile…"
              className="field"
            />
          </label>
          {selectedCaptain ? (
            <p className="mt-2 text-sm text-[#1a7f84]">
              Selected: {selectedCaptain.name} · {selectedCaptain.mobile_number}
              <button
                type="button"
                className="ml-2 text-xs font-semibold text-[#9f1239]"
                onClick={() => setCaptainId("")}
              >
                Clear
              </button>
            </p>
          ) : (
            <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-[#3e2723]/10">
              {captainMatches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-[#3e2723]/50">
                  No verified users found. The captain must complete verification
                  first.
                </li>
              ) : (
                captainMatches.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCaptainId(u.id);
                        setCaptainQuery(`${u.name} · ${u.mobile_number}`);
                      }}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#2aa7ad]/8"
                    >
                      <span className="text-sm font-semibold text-[#3e2723]">
                        {u.name}
                      </span>
                      <span className="text-xs text-[#3e2723]/55">
                        {u.mobile_number} · {u.role}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={
            creating ||
            name.trim().length < 2 ||
            shortName.trim().length < 2 ||
            !captainId
          }
          className="w-full rounded-full bg-[#2aa7ad] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create team & assign captain"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === key
                ? "bg-[#2aa7ad] text-white"
                : "border border-[#3e2723]/15 text-[#3e2723]"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {message ? (
        <p className="mt-3 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <pre
          className="mt-3 whitespace-pre-wrap rounded-xl border border-[#d81b60]/25 bg-[#d81b60]/10 px-3 py-2 font-sans text-sm text-[#9f1239]"
          role="alert"
        >
          {error}
        </pre>
      ) : null}

      <ul className="mt-5 space-y-3">
        {filtered.map((team) => (
          <li
            key={team.id}
            className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/teams/${team.id}`}
                  className="font-semibold text-[#3e2723] hover:text-[#1a7f84]"
                >
                  {team.name}{" "}
                  <span className="text-[#3e2723]/45">({team.short_name})</span>
                </Link>
                <p className="mt-1 text-sm text-[#3e2723]/60">
                  Captain: {team.manager_name ?? "—"} · {team.player_count}{" "}
                  players
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  team.registration_status === "approved"
                    ? "bg-[#2aa7ad]/15 text-[#1a7f84]"
                    : team.registration_status === "pending"
                      ? "bg-[#f5b830]/20 text-[#8a6500]"
                      : "bg-[#d81b60]/10 text-[#9f1239]"
                }`}
              >
                {teamStatusLabel(team.registration_status)}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setExpandedId((id) => (id === team.id ? null : team.id))
              }
              className="mt-2 text-xs font-semibold text-[#1a7f84]"
            >
              {expandedId === team.id ? "Hide squad" : "Show squad"}
            </button>

            {expandedId === team.id && team.players?.length ? (
              <ul className="mt-3 space-y-2 border-t border-[#3e2723]/8 pt-3">
                {team.players.map((p) => {
                  const conflict =
                    Boolean(p.locked_team_id) && p.locked_team_id !== team.id;
                  return (
                    <li key={p.id} className="text-sm text-[#3e2723]">
                      <p className="font-medium">{formatPlayerLabel(p)}</p>
                      <p
                        className={`text-xs ${
                          conflict
                            ? "font-semibold text-[#9f1239]"
                            : "text-[#3e2723]/55"
                        }`}
                      >
                        Status:{" "}
                        {conflict
                          ? `Already in approved team${
                              p.locked_team_name
                                ? `: ${p.locked_team_name}`
                                : ""
                            }`
                          : p.pending_other_team_names.length
                            ? `Also in pending: ${p.pending_other_team_names.join(", ")}`
                            : "Available"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {team.registration_status === "pending" ||
            team.registration_status === "rejected" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === team.id}
                  onClick={() => decide(team.id, "approve")}
                  className="rounded-full bg-[#2aa7ad] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Approve
                </button>
                {team.registration_status === "pending" ? (
                  <button
                    type="button"
                    disabled={busyId === team.id}
                    onClick={() => decide(team.id, "reject")}
                    className="rounded-full border border-[#3e2723]/20 px-3 py-1.5 text-sm font-semibold text-[#3e2723] disabled:opacity-50"
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
