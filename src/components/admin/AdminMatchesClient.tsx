"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { MatchView } from "@/lib/matches/types";
import { formatMatchWhen, matchStatusLabel } from "@/lib/matches/labels";
import type { TeamRow } from "@/lib/teams/types";

type TournamentOption = {
  id: string;
  name: string;
  status: string;
  is_active: boolean;
};

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
  tournaments: TournamentOption[];
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
  tournaments,
}: AdminMatchesClientProps) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tournamentId, setTournamentId] = useState("");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [venue, setVenue] = useState("GPL Ground, Pali");
  const [overs, setOvers] = useState("20");
  const [matchType, setMatchType] = useState("league");
  const [scorerIds, setScorerIds] = useState<string[]>([]);

  const [drawFor, setDrawFor] = useState<MatchView | null>(null);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [resultPick, setResultPick] = useState<"a" | "b" | "tie">("a");
  const [resultMode, setResultMode] = useState<"complete" | "super_over">(
    "complete",
  );
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

  const tournamentTeams = useMemo(
    () =>
      tournamentId
        ? teams.filter((team) => team.tournament_id === tournamentId)
        : [],
    [teams, tournamentId],
  );
  const selectedTournament = tournaments.find((t) => t.id === tournamentId);
  const canCreateMatch =
    Boolean(tournamentId) && selectedTournament?.status !== "completed";
  const matchesByTournament = useMemo(() => {
    return tournaments
      .map((tournament) => ({
        tournament,
        matches: matches.filter((match) => match.tournament_id === tournament.id),
      }))
      .filter((group) => group.matches.length > 0);
  }, [matches, tournaments]);

  function beginEdit(match: MatchView) {
    setEditId(match.id);
    setTournamentId(match.tournament_id);
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
    if (!editId && !canCreateMatch) {
      setError("Select a tournament. Matches cannot be created without one.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);

    const payload = {
      tournament_id: tournamentId,
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

  function openResult(match: MatchView, mode: "complete" | "super_over") {
    setResultFor(match.id);
    setResultMode(mode);
    setResultPick(mode === "super_over" ? "a" : match.winner_team_id === match.team_b_id ? "b" : "a");
  }

  function submitResult(match: MatchView) {
    if (resultMode === "super_over") {
      const winner_team_id =
        resultPick === "b" ? match.team_b_id : match.team_a_id;
      const winnerName =
        resultPick === "b" ? match.team_b?.name : match.team_a?.name;
      void runAction(match.id, "super_over", {
        winner_team_id,
        result_text: `${winnerName} won in Super Over`,
      });
    } else if (resultPick === "tie") {
      void runAction(match.id, "complete", {
        winner_team_id: null,
        result_text: "Match tied",
      });
    } else {
      const winner_team_id =
        resultPick === "b" ? match.team_b_id : match.team_a_id;
      const winnerName =
        resultPick === "b" ? match.team_b?.name : match.team_a?.name;
      void runAction(match.id, "complete", {
        winner_team_id,
        result_text: `${winnerName} won`,
      });
    }
    setResultFor(null);
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
    <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
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
        {tournaments.length === 0 ? (
          <p className="text-sm text-[#9f1239]">
            Create a tournament in Admin → Tournaments first. Matches cannot be
            created without a tournament.
          </p>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block text-[#3e2723]/65">Tournament</span>
          <select
            required
            value={tournamentId}
            disabled={Boolean(editId)}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setTeamA("");
              setTeamB("");
            }}
            className="field-select"
          >
            <option value="">Select tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id} disabled={t.status === "completed"}>
                {t.name}
                {t.is_active ? " · Active" : ""}
                {t.status === "completed" ? " · Completed" : ""}
              </option>
            ))}
          </select>
        </label>
        {!tournamentId && tournaments.length > 0 ? (
          <p className="text-sm text-[#8a6500]">
            Select a tournament to create a match. Matches cannot be created
            without one.
          </p>
        ) : null}
        {selectedTournament?.status === "completed" ? (
          <p className="text-sm text-[#9f1239]">
            This tournament is completed. New matches cannot be added.
          </p>
        ) : null}
        {tournamentId && canCreateMatch && tournamentTeams.length === 0 ? (
          <p className="text-sm text-[#9f1239]">
            No teams in this tournament yet. Add teams in Admin → Teams first.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[#3e2723]/65">Team A</span>
            <select
              required
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              disabled={
                !tournamentId ||
                (!editId && selectedTournament?.status === "completed") ||
                Boolean(editId && editing?.status !== "scheduled")
              }
              className="field-select"
            >
              <option value="">Select team</option>
              {tournamentTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.registration_status !== "approved" ? " (pending)" : ""}
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
              disabled={
                !tournamentId ||
                (!editId && selectedTournament?.status === "completed") ||
                Boolean(editId && editing?.status !== "scheduled")
              }
              className="field-select"
            >
              <option value="">Select team</option>
              {tournamentTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.registration_status !== "approved" ? " (pending)" : ""}
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
            disabled={busy || (!editId && !canCreateMatch)}
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

      <div className="mt-8 space-y-8">
        {matchesByTournament.map(({ tournament, matches: group }) => (
          <section key={tournament.id}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#1a7f84]">
              {tournament.name}
            </h2>
            <ul className="space-y-3">
              {group.map((match) => (
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
                {match.status === "completed" && !match.winner_team_id
                  ? "Tied"
                  : matchStatusLabel(match.status)}
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
                  onClick={() => openResult(match, "complete")}
                  className="rounded-full bg-[#2aa7ad] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Complete
                </button>
              ) : null}
              {match.status !== "abandoned" &&
              !(match.status === "completed" && !match.winner_team_id) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDrawFor(match)}
                  className="rounded-full border border-[#2aa7ad]/35 bg-[#2aa7ad]/10 px-3 py-1.5 text-xs font-semibold text-[#1a7f84]"
                >
                  Draw / Tie
                </button>
              ) : null}
              {match.status === "completed" && !match.winner_team_id ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openResult(match, "super_over")}
                    className="rounded-full bg-[#2aa7ad] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Super Over winner
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(match.id, "start_super_over")}
                    className="rounded-full bg-[#d81b60] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Start Super Over
                  </button>
                </>
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
            {resultFor === match.id ? (
              <div className="mt-3 space-y-2 rounded-xl border border-[#2aa7ad]/25 bg-[#f4fbfb] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1a7f84]">
                  {resultMode === "super_over"
                    ? "Who won the Super Over?"
                    : "Match result"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["a", match.team_a?.short_name ?? "A"],
                      ["b", match.team_b?.short_name ?? "B"],
                      ...(resultMode === "complete"
                        ? ([["tie", "Draw / Tie"]] as const)
                        : []),
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setResultPick(id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        resultPick === id
                          ? "bg-[#2aa7ad] text-white"
                          : "bg-white text-[#3e2723]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#3e2723]/55">
                  {resultMode === "super_over"
                    ? "Same as international T20: Super Over decides the winner."
                    : resultPick === "tie"
                      ? "No winner. Both teams share tie points. You can still start a Super Over after this."
                      : "Award the match to this team."}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submitResult(match)}
                    className="rounded-full bg-[#2aa7ad] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Save result
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultFor(null)}
                    className="rounded-full border border-[#3e2723]/15 px-3 py-1.5 text-xs font-semibold text-[#3e2723]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {matches.length === 0 ? (
        <p className="mt-6 text-sm text-[#3e2723]/60">No matches yet.</p>
      ) : null}

      {drawFor ? (
        <ConfirmDialog
          title="Mark as draw / tie?"
          body={`${drawFor.team_a?.name ?? "Team A"} vs ${drawFor.team_b?.name ?? "Team B"} will finish with no winner. Both teams get tie points.`}
          confirmLabel="Save draw"
          busy={busy}
          onCancel={() => setDrawFor(null)}
          onConfirm={() => {
            const match = drawFor;
            setDrawFor(null);
            void runAction(match.id, "draw", {
              winner_team_id: null,
              result_text: "Match tied",
            });
          }}
        />
      ) : null}
    </div>
  );
}
