"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MatchView } from "@/lib/matches/types";
import { formatMatchWhen, matchStatusLabel } from "@/lib/matches/labels";
import type { TeamRow } from "@/lib/teams/types";

type ScorerUser = {
  id: string;
  name: string;
  mobile_number: string;
  role: string;
};

type AdminMatchesClientProps = {
  initialMatches: MatchView[];
  teams: TeamRow[];
  scorers: ScorerUser[];
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminMatchesClient({
  initialMatches,
  teams,
  scorers,
}: AdminMatchesClientProps) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [venue, setVenue] = useState("GPL Ground, Pali");
  const [overs, setOvers] = useState("20");
  const [matchType, setMatchType] = useState("league");
  const [scorerIds, setScorerIds] = useState<string[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const editing = useMemo(
    () => matches.find((m) => m.id === editId) ?? null,
    [matches, editId],
  );

  function toggleScorer(id: string) {
    setScorerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function beginEdit(match: MatchView) {
    setEditId(match.id);
    setTeamA(match.team_a_id);
    setTeamB(match.team_b_id);
    setScheduledAt(toLocalInputValue(match.scheduled_at));
    setVenue(match.venue ?? "");
    setOvers(String(match.overs_per_innings));
    setMatchType(match.match_type);
    setScorerIds([]);
    setMessage(null);
    setError(null);
    // Load scorers for this match
    void fetch("/api/admin/matches", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: match.id }),
    })
      .then((r) => r.json())
      .then((data: { scorer_ids?: string[] }) => {
        setScorerIds(data.scorer_ids ?? []);
      })
      .catch(() => undefined);
  }

  function resetForm() {
    setEditId(null);
    setTeamA("");
    setTeamB("");
    setScheduledAt("");
    setVenue("GPL Ground, Pali");
    setOvers("20");
    setMatchType("league");
    setScorerIds([]);
  }

  async function saveMatch(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const payload = {
      team_a_id: teamA,
      team_b_id: teamB,
      scheduled_at: scheduledAt,
      venue: venue || null,
      overs_per_innings: Number(overs) || 20,
      match_type: matchType,
      scorer_ids: scorerIds,
      ...(editId ? { match_id: editId } : {}),
    };

    try {
      const res = await fetch("/api/admin/matches", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        match?: MatchView;
      };
      if (!res.ok) {
        setError(data.error ?? "Save failed.");
        return;
      }
      if (data.match) {
        setMatches((prev) => {
          const exists = prev.some((m) => m.id === data.match!.id);
          if (exists) {
            return prev.map((m) => (m.id === data.match!.id ? data.match! : m));
          }
          return [...prev, data.match!].sort((a, b) =>
            String(a.scheduled_at).localeCompare(String(b.scheduled_at)),
          );
        });
      }
      setMessage(editId ? "Match updated." : "Match created.");
      resetForm();
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(
    matchId: string,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, action, ...extra }),
      });
      const data = (await res.json()) as {
        error?: string;
        match?: MatchView;
      };
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      if (data.match) {
        setMatches((prev) =>
          prev.map((m) => (m.id === matchId ? data.match! : m)),
        );
      }
      setMessage(`Match ${action.replace("_", " ")} successful.`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function completeMatch(match: MatchView) {
    const result = window.prompt(
      "Result text (e.g. Pali Warriors won by 18 runs)",
      match.result_text ?? "",
    );
    if (result === null) return;
    const winner = window.prompt(
      `Winner team id (A=${match.team_a_id.slice(0, 8)}… or B=${match.team_b_id.slice(0, 8)}…)\nEnter A or B`,
      "A",
    );
    if (winner === null) return;
    const winner_team_id =
      winner.toUpperCase() === "B" ? match.team_b_id : match.team_a_id;
    void runAction(match.id, "complete", {
      result_text: result || null,
      winner_team_id,
    });
  }

  function startMatch(match: MatchView) {
    const toss = window.prompt(
      `Toss winner? Enter A (${match.team_a?.short_name}) or B (${match.team_b?.short_name})`,
      "A",
    );
    if (toss === null) return;
    const decision = window.prompt("Toss decision? bat or bowl", "bat");
    if (decision === null) return;
    const toss_winner_id =
      toss.toUpperCase() === "B" ? match.team_b_id : match.team_a_id;
    void runAction(match.id, "start", {
      toss_winner_id,
      toss_decision: decision.toLowerCase() === "bowl" ? "bowl" : "bat",
    });
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Matches</h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Create fixtures, assign scorers, and control match status.
      </p>

      {message ? (
        <p className="mt-3 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={saveMatch}
        className="mt-6 space-y-3 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-[#3e2723]">
          {editId ? "Edit match" : "Create match"}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[#3e2723]/65">Team A</span>
            <select
              required
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              disabled={Boolean(editId && editing?.status !== "scheduled")}
              className="field-select"
            >
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#3e2723]/65">Team B</span>
            <select
              required
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              disabled={Boolean(editId && editing?.status !== "scheduled")}
              className="field-select"
            >
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[#3e2723]/65">Date & time</span>
            <input
              required={!editId}
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="field"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#3e2723]/65">Venue</span>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="field"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[#3e2723]/65">Overs</span>
            <input
              type="number"
              min={1}
              max={50}
              value={overs}
              onChange={(e) => setOvers(e.target.value)}
              className="field"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#3e2723]/65">Type</span>
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value)}
              className="field-select"
            >
              <option value="league">League</option>
              <option value="semi">Semi</option>
              <option value="final">Final</option>
              <option value="friendly">Friendly</option>
            </select>
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm text-[#3e2723]/65">Assigned scorers</p>
          {scorers.length === 0 ? (
            <p className="text-xs text-[#3e2723]/45">
              No scorer/admin users found. Create scorers in Users first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scorers.map((s) => (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    scorerIds.includes(s.id)
                      ? "border-[#2aa7ad] bg-[#2aa7ad]/15 text-[#1a7f84]"
                      : "border-[#3e2723]/15 text-[#3e2723]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={scorerIds.includes(s.id)}
                    onChange={() => toggleScorer(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#2aa7ad] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : editId ? "Save changes" : "Create match"}
          </button>
          {editId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-[#3e2723]/15 px-4 py-2.5 text-sm font-medium text-[#3e2723]"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <ul className="mt-8 space-y-3">
        {matches.map((match) => (
          <li
            key={match.id}
            className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/matches/${match.id}`}
                  className="font-semibold text-[#3e2723] hover:text-[#1a7f84]"
                >
                  {match.team_a?.name} vs {match.team_b?.name}
                </Link>
                <p className="mt-1 text-sm text-[#3e2723]/60">
                  {formatMatchWhen(match.scheduled_at)}
                  {match.venue ? ` · ${match.venue}` : ""}
                </p>
                {match.result_text ? (
                  <p className="mt-1 text-sm text-[#1a7f84]">{match.result_text}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-[#3e2723]/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3e2723]/65">
                {matchStatusLabel(match.status)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => beginEdit(match)}
                className="rounded-full border border-[#3e2723]/15 px-3 py-1.5 text-xs font-semibold text-[#3e2723]"
              >
                Edit
              </button>
              {match.status === "scheduled" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startMatch(match)}
                  className="rounded-full bg-[#d81b60] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Start
                </button>
              ) : null}
              {match.status === "live" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(match.id, "innings_break")}
                  className="rounded-full border border-[#3e2723]/15 px-3 py-1.5 text-xs font-semibold text-[#3e2723]"
                >
                  Innings break
                </button>
              ) : null}
              {match.status === "innings_break" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(match.id, "resume")}
                  className="rounded-full bg-[#d81b60] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Resume
                </button>
              ) : null}
              {["live", "innings_break", "scheduled"].includes(match.status) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => completeMatch(match)}
                  className="rounded-full bg-[#2aa7ad] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Complete
                </button>
              ) : null}
              {!["completed", "abandoned"].includes(match.status) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(match.id, "abandon")}
                  className="rounded-full border border-[#d81b60]/30 px-3 py-1.5 text-xs font-semibold text-[#9f1239]"
                >
                  Cancel / Abandon
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {matches.length === 0 ? (
        <p className="mt-6 text-sm text-[#3e2723]/60">No matches yet.</p>
      ) : null}
    </div>
  );
}
