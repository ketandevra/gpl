"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ManageSquadClient } from "@/components/teams/ManageSquadClient";
import type {
  TeamOwnerRequestView,
  TeamPlayerView,
  TeamRow,
} from "@/lib/teams/types";
import { teamStatusLabel } from "@/lib/teams/labels";

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

export function AdminTeamsClient({
  teams: initial,
  ownerRequests: initialRequests,
  squadSize,
}: {
  teams: AdminTeam[];
  ownerRequests: TeamOwnerRequestView[];
  squadSize: number;
}) {
  const router = useRouter();
  const [teams, setTeams] = useState(initial);
  const [ownerRequests, setOwnerRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "all",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [captainId, setCaptainId] = useState("");
  const [captainQuery, setCaptainQuery] = useState("");
  const [captains, setCaptains] = useState<CaptainOption[]>([]);
  const [creating, setCreating] = useState(false);

  const [editName, setEditName] = useState("");
  const [editShort, setEditShort] = useState("");
  const [editCaptainId, setEditCaptainId] = useState("");
  const [editCaptainQuery, setEditCaptainQuery] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);

  useEffect(() => {
    setTeams(initial);
  }, [initial]);

  useEffect(() => {
    setOwnerRequests(initialRequests);
  }, [initialRequests]);

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
  const selectedEditCaptain = captains.find((c) => c.id === editCaptainId);

  const editCaptainMatches = useMemo(() => {
    const q = editCaptainQuery.trim().toLowerCase();
    if (!q) return captains.slice(0, 20);
    return captains
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.mobile_number.includes(q) ||
          u.id === editCaptainId,
      )
      .slice(0, 20);
  }, [captains, editCaptainQuery, editCaptainId]);

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
          `Created “${data.team.name}”. Captain can now invite squad members.`,
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

  async function decideOwnerRequest(
    requestId: string,
    decision: "approve" | "reject",
  ) {
    setBusyId(requestId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "owner_request",
          request_id: requestId,
          decision,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        team?: TeamRow;
        captain_name?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update request.");
        return;
      }
      setOwnerRequests((prev) => prev.filter((row) => row.id !== requestId));
      if (data.team) {
        setTeams((prev) => [
          {
            ...data.team!,
            manager_name: data.captain_name ?? null,
            player_count: 0,
            players: [],
          },
          ...prev.filter((t) => t.id !== data.team!.id),
        ]);
        setMessage(
          `Approved “${data.team.name}”. The captain can now invite squad members.`,
        );
      } else {
        setMessage("Owner request rejected.");
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  function openEditor(team: AdminTeam) {
    setExpandedId((id) => {
      const next = id === team.id ? null : team.id;
      if (next) {
        setEditName(team.name);
        setEditShort(team.short_name);
        setEditCaptainId(team.manager_id ?? "");
        const cap = captains.find((c) => c.id === team.manager_id);
        setEditCaptainQuery(
          cap
            ? `${cap.name} · ${cap.mobile_number}`
            : team.manager_name ?? "",
        );
      }
      return next;
    });
  }

  async function saveTeam(teamId: string) {
    if (editName.trim().length < 2) {
      setError("Team name must be at least 2 characters.");
      return;
    }
    if (editShort.trim().length < 2) {
      setError("Short name must be at least 2 characters.");
      return;
    }
    if (!editCaptainId) {
      setError("Select a captain.");
      return;
    }
    setSavingTeam(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          team_id: teamId,
          name: editName.trim(),
          short_name: editShort.trim(),
          captain_id: editCaptainId,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        team?: TeamRow;
        captain_name?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update team.");
        return;
      }
      if (data.team) {
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  ...data.team!,
                  manager_name: data.captain_name ?? t.manager_name,
                }
              : t,
          ),
        );
      }
      setMessage("Team updated.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSavingTeam(false);
    }
  }

  async function deleteTeam(team: AdminTeam) {
    const ok = window.confirm(
      `Delete “${team.name}”? Squad membership is removed. This cannot be undone.`,
    );
    if (!ok) return;
    setBusyId(team.id);
    setDeletingId(team.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", team_id: team.id }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not delete team.");
        return;
      }
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      if (expandedId === team.id) setExpandedId(null);
      setMessage(`Deleted “${team.name}”.`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
      setDeletingId(null);
    }
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Teams</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Review owner requests, create teams, edit name/captain/squad, or delete
        a team. Captains can also invite players; admins add them directly.
      </p>

      {ownerRequests.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-[#c9a227]/40 bg-[#c9a227]/10 p-5">
          <h2 className="font-semibold text-[#3e2723]">Owner requests</h2>
          <p className="mt-1 text-sm text-[#3e2723]/65">
            Approving creates the team with this player as captain. Rejected
            players can submit a new request.
          </p>
          <ul className="mt-4 space-y-3">
            {ownerRequests.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-[#3e2723]/10 bg-white p-4"
              >
                <p className="font-semibold text-[#3e2723]">{row.name}</p>
                <p className="mt-1 text-sm text-[#3e2723]/60">
                  {row.requester_name}
                  {row.requester_mobile ? ` · ${row.requester_mobile}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void decideOwnerRequest(row.id, "approve")}
                    className="rounded-full bg-[#2aa7ad] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busyId === row.id ? "Saving…" : "Approve & create team"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void decideOwnerRequest(row.id, "reject")}
                    className="rounded-full border border-[#d81b60]/30 px-4 py-2 text-sm font-semibold text-[#9f1239] disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEditor(team)}
                className="rounded-full border border-[#2aa7ad]/40 px-3 py-1.5 text-sm font-semibold text-[#1a7f84]"
              >
                {expandedId === team.id ? "Close editor" : "Edit team"}
              </button>
              <button
                type="button"
                disabled={deletingId === team.id || busyId === team.id}
                onClick={() => void deleteTeam(team)}
                className="rounded-full border border-[#d81b60]/30 px-3 py-1.5 text-sm font-semibold text-[#9f1239] disabled:opacity-50"
              >
                {deletingId === team.id ? "Deleting…" : "Delete team"}
              </button>
            </div>

            {expandedId === team.id ? (
              <div className="mt-4 space-y-4 border-t border-[#3e2723]/8 pt-4">
                <div className="space-y-3 rounded-xl border border-[#3e2723]/10 bg-[#fdf6e8]/70 p-4">
                  <h3 className="text-sm font-semibold text-[#3e2723]">
                    Team details
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm text-[#3e2723]/70">
                        Team name
                      </span>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="field bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-[#3e2723]/70">
                        Short name
                      </span>
                      <input
                        value={editShort}
                        maxLength={6}
                        onChange={(e) =>
                          setEditShort(
                            e.target.value
                              .replace(/[^a-zA-Z0-9]/g, "")
                              .toUpperCase(),
                          )
                        }
                        className="field bg-white tracking-widest"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block">
                      <span className="mb-1 block text-sm text-[#3e2723]/70">
                        Captain
                      </span>
                      <input
                        value={editCaptainQuery}
                        onChange={(e) => {
                          setEditCaptainQuery(e.target.value);
                          if (selectedEditCaptain) setEditCaptainId("");
                        }}
                        placeholder="Search by name or mobile…"
                        className="field bg-white"
                      />
                    </label>
                    {selectedEditCaptain ? (
                      <p className="mt-2 text-sm text-[#1a7f84]">
                        Selected: {selectedEditCaptain.name} ·{" "}
                        {selectedEditCaptain.mobile_number}
                        <button
                          type="button"
                          className="ml-2 text-xs font-semibold text-[#9f1239]"
                          onClick={() => {
                            setEditCaptainId("");
                            setEditCaptainQuery("");
                          }}
                        >
                          Change
                        </button>
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-[#3e2723]/10 bg-white">
                        {editCaptainMatches.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-[#3e2723]/50">
                            No verified users found.
                          </li>
                        ) : (
                          editCaptainMatches.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditCaptainId(u.id);
                                  setEditCaptainQuery(
                                    `${u.name} · ${u.mobile_number}`,
                                  );
                                }}
                                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#2aa7ad]/8"
                              >
                                <span className="text-sm font-semibold text-[#3e2723]">
                                  {u.name}
                                </span>
                                <span className="text-xs text-[#3e2723]/55">
                                  {u.mobile_number}
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={savingTeam}
                    onClick={() => void saveTeam(team.id)}
                    className="rounded-full bg-[#2aa7ad] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingTeam ? "Saving…" : "Save name & captain"}
                  </button>
                </div>

                <ManageSquadClient
                  teamId={team.id}
                  initialPlayers={team.players ?? []}
                  initialInvites={[]}
                  canEdit
                  approved={team.approved}
                  squadSize={squadSize}
                  adminOverride
                  compact
                  onRosterChange={(players) =>
                    setTeams((prev) =>
                      prev.map((t) =>
                        t.id === team.id
                          ? { ...t, players, player_count: players.length }
                          : t,
                      ),
                    )
                  }
                />
              </div>
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
