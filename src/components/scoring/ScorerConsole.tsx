"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScoreboardPayload } from "@/lib/scoring/queries";
import {
  battingTeamForNextInnings,
  isBattingTeamLocked,
  isSuperOverInnings,
  otherTeamId,
  regulationScoresTied,
  superOverMaxWickets,
} from "@/lib/scoring/sides";
import type { ExtraType, WicketType } from "@/lib/types/database";

type Props = {
  matchId: string;
  initial: ScoreboardPayload;
};

const BAT_RUNS = [0, 1, 2, 3, 4, 6, 5, 7] as const;
const EXTRA_RUNS = [0, 1, 2, 3, 4] as const;
const WICKETS: { type: WicketType; label: string }[] = [
  { type: "bowled", label: "Bowled" },
  { type: "caught", label: "Caught" },
  { type: "lbw", label: "LBW" },
  { type: "run_out", label: "Run out" },
  { type: "stumped", label: "Stumped" },
  { type: "hit_wicket", label: "Hit wicket" },
  { type: "retired_hurt", label: "Retired hurt" },
];

function wicketsForExtra(
  extra: ExtraType | null,
  freeHit: boolean,
): typeof WICKETS {
  if (extra === "wide") {
    return WICKETS.filter((w) =>
      ["run_out", "stumped", "hit_wicket", "retired_hurt"].includes(w.type),
    );
  }
  if (extra === "no_ball" || freeHit) {
    return WICKETS.filter((w) =>
      ["run_out", "retired_hurt"].includes(w.type),
    );
  }
  return WICKETS;
}

function extraHint(
  extra: ExtraType | null,
  secondary: "bye" | "leg_bye" | null,
  runs: number,
): string {
  if (extra === "wide") {
    return runs === 0
      ? "Wide = 1 extra, ball not counted"
      : `Wide + ${runs} = ${1 + runs} extras, ball not counted`;
  }
  if (extra === "no_ball" && secondary) {
    const label = secondary === "bye" ? "bye" : "leg bye";
    return `No ball + ${runs} ${label} = ${1 + runs} extras (bowler +1)`;
  }
  if (extra === "no_ball") {
    return runs === 0
      ? "No ball = 1 extra + free hit"
      : `No ball + ${runs} bat = ${1 + runs} runs, free hit`;
  }
  if (extra === "bye") return `${runs} bye${runs === 1 ? "" : "s"}, legal ball`;
  if (extra === "leg_bye") {
    return `${runs} leg bye${runs === 1 ? "" : "s"}, legal ball`;
  }
  return "";
}

function playerName(
  players: ScoreboardPayload["batting_players"],
  id: string | null,
) {
  if (!id) return "—";
  return players.find((p) => p.id === id)?.name ?? "Player";
}

function squadForTeam(board: ScoreboardPayload, teamId: string) {
  if (teamId === board.match.team_a_id) return board.team_a_players;
  if (teamId === board.match.team_b_id) return board.team_b_players;
  return [];
}

function teamName(board: ScoreboardPayload, teamId: string) {
  if (teamId === board.match.team_a_id) return board.match.team_a?.name ?? "Team A";
  if (teamId === board.match.team_b_id) return board.match.team_b?.name ?? "Team B";
  return "Team";
}

function ballLabel(b: ScoreboardPayload["balls"][number]): string {
  if (b.is_wicket) return "W";
  if (b.extra_type === "wide") return `Wd${b.extra_runs > 1 ? b.extra_runs : ""}`;
  if (b.extra_type === "no_ball") return `Nb${b.batsman_runs || ""}`;
  if (b.extra_type === "bye") return `B${b.extra_runs}`;
  if (b.extra_type === "leg_bye") return `Lb${b.extra_runs}`;
  if (b.batsman_runs === 0) return "·";
  return String(b.batsman_runs);
}

export function ScorerConsole({ matchId, initial }: Props) {
  const [board, setBoard] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<ExtraType | null>(null);
  const [secondaryExtra, setSecondaryExtra] = useState<"bye" | "leg_bye" | null>(
    null,
  );
  const [wicketMode, setWicketMode] = useState(false);
  const [wicketType, setWicketType] = useState<WicketType>("bowled");
  const [dismissedId, setDismissedId] = useState("");
  const [newBatsmanId, setNewBatsmanId] = useState("");
  const [fielderId, setFielderId] = useState("");
  const [assistFielderId, setAssistFielderId] = useState("");
  const [caughtBehind, setCaughtBehind] = useState(false);
  const [startForm, setStartForm] = useState({
    batting_team_id: battingTeamForNextInnings(initial.match, initial.innings),
    striker_id: "",
    non_striker_id: "",
    bowler_id: "",
  });

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/scoring/${matchId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Request failed");
          return;
        }
        setBoard(data as ScoreboardPayload);
        setExtra(null);
        setSecondaryExtra(null);
        setWicketMode(false);
        setDismissedId("");
        setNewBatsmanId("");
        setFielderId("");
        setAssistFielderId("");
        setCaughtBehind(false);
      } catch {
        setError("Network error");
      } finally {
        setBusy(false);
      }
    },
    [matchId],
  );

  const strikerId = board.current?.striker_id;
  const nonStrikerId = board.current?.non_striker_id;
  const dismissedPool = useMemo(() => {
    const out = new Set(
      board.balls.filter((b) => b.is_wicket && b.dismissed_player_id).map((b) => b.dismissed_player_id!),
    );
    return board.batting_players.filter(
      (p) => !out.has(p.id) && p.id !== strikerId && p.id !== nonStrikerId,
    );
  }, [board.balls, board.batting_players, strikerId, nonStrikerId]);

  const nextBattingTeamId = battingTeamForNextInnings(board.match, board.innings);
  const battingLocked = isBattingTeamLocked(board.match, board.innings);

  useEffect(() => {
    setStartForm({
      batting_team_id: nextBattingTeamId,
      striker_id: "",
      non_striker_id: "",
      bowler_id: "",
    });
  }, [nextBattingTeamId, board.innings.length]);

  const battingSidePlayers = useMemo(
    () => squadForTeam(board, startForm.batting_team_id),
    [board, startForm.batting_team_id],
  );

  const bowlingSidePlayers = useMemo(
    () => squadForTeam(board, otherTeamId(board.match, startForm.batting_team_id)),
    [board, startForm.batting_team_id],
  );

  const pickDismissedBatter =
    wicketType === "run_out" || wicketType === "retired_hurt";
  const needsFielder =
    wicketType === "caught" ||
    wicketType === "stumped" ||
    wicketType === "run_out";

  async function sendRuns(runs: number) {
    if (wicketMode) {
      if (
        !newBatsmanId &&
        wicketType !== "retired_hurt" &&
        (board.current?.wickets ?? 0) <
          (isSuperOverInnings(board.current?.innings_number ?? 1)
            ? superOverMaxWickets()
            : 10) -
            1
      ) {
        setError("Select the new batsman");
        return;
      }
      const dismissed =
        pickDismissedBatter
          ? dismissedId || board.current?.striker_id
          : board.current?.striker_id;
      if (!dismissed) {
        setError("Select who is out");
        return;
      }
      if (needsFielder && !fielderId) {
        setError(
          wicketType === "stumped"
            ? "Select the wicket-keeper"
            : wicketType === "run_out"
              ? "Select the fielder"
              : "Select the catcher",
        );
        return;
      }
      await post({
        action: "ball",
        batsman_runs: runs,
        extra_type: extra,
        secondary_extra_type:
          extra === "no_ball" ? secondaryExtra : null,
        is_wicket: true,
        wicket_type: wicketType,
        dismissed_player_id: dismissed,
        new_batsman_id: newBatsmanId || null,
        fielder_id: needsFielder ? fielderId : null,
        assist_fielder_id:
          wicketType === "run_out" && assistFielderId && assistFielderId !== fielderId
            ? assistFielderId
            : null,
        is_caught_behind: wicketType === "caught" && caughtBehind,
      });
      return;
    }
    await post({
      action: "ball",
      batsman_runs: runs,
      extra_type: extra,
      secondary_extra_type: extra === "no_ball" ? secondaryExtra : null,
      is_wicket: false,
    });
  }

  if (!board.can_score) {
    return (
      <div className="rounded-2xl border border-[#d81b60]/30 bg-[#fff5f8] px-4 py-6 text-sm text-[#3e2723]">
        You are not assigned as a scorer for this match. Ask an admin to assign you
        in Match admin.
      </div>
    );
  }

  const current = board.current;
  const hasActiveInnings = board.innings.some((i) => i.status === "in_progress");
  const matchOpen = ["live", "innings_break"].includes(board.match.status);
  const superOverReady =
    board.innings.length < 6 &&
    (regulationScoresTied(board.innings) ||
      board.innings.some((row) => isSuperOverInnings(row.innings_number)) ||
      (board.match.result_text ?? "").toLowerCase().includes("super over"));
  const needsStart =
    matchOpen &&
    !hasActiveInnings &&
    (board.innings.length < 2 || superOverReady);

  if (needsStart) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#3e2723]">
          {board.innings.length >= 2 ? "Start Super Over" : "Start innings"}
        </h2>
        {board.innings.length >= 2 ? (
          <p className="text-sm text-[#3e2723]/60">
            One over each, two wickets — same as international T20.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-[#fff5f8] px-3 py-2 text-sm text-[#d81b60]">{error}</p>
        ) : null}
        <label className="block text-sm">
          <span className="font-medium text-[#3e2723]">Batting team</span>
          <select
            className="field-select mt-1"
            value={startForm.batting_team_id}
            disabled={battingLocked}
            onChange={(e) =>
              setStartForm((s) => ({
                ...s,
                batting_team_id: e.target.value,
                striker_id: "",
                non_striker_id: "",
                bowler_id: "",
              }))
            }
          >
            <option value={board.match.team_a_id}>{board.match.team_a?.name}</option>
            <option value={board.match.team_b_id}>{board.match.team_b?.name}</option>
          </select>
          <span className="mt-1 block text-xs text-[#3e2723]/50">
            {board.innings.length >= 2
              ? `${teamName(board, startForm.batting_team_id)} bat this Super Over.`
              : board.innings.length > 0
              ? `${teamName(board, startForm.batting_team_id)} bat second.`
              : board.match.toss_winner?.name && board.match.toss_decision
                ? `${board.match.toss_winner.name} won the toss and chose to ${board.match.toss_decision}.`
                : "Select who bats first."}
          </span>
        </label>
        {(
          [
            [
              "striker_id",
              `Striker — ${teamName(board, startForm.batting_team_id)}`,
              battingSidePlayers,
            ],
            [
              "non_striker_id",
              `Non-striker — ${teamName(board, startForm.batting_team_id)}`,
              battingSidePlayers,
            ],
            [
              "bowler_id",
              `Bowler — ${teamName(board, otherTeamId(board.match, startForm.batting_team_id))}`,
              bowlingSidePlayers,
            ],
          ] as const
        ).map(([key, label, players]) => (
          <label key={key} className="block text-sm">
            <span className="font-medium text-[#3e2723]">{label}</span>
            <select
              className="field-select mt-1"
              value={startForm[key]}
              onChange={(e) =>
                setStartForm((s) => ({ ...s, [key]: e.target.value }))
              }
            >
              <option value="">Select…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey_number != null ? `#${p.jersey_number} ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
            {players.length === 0 ? (
              <span className="mt-1 block text-xs text-[#d81b60]">
                No players on this squad yet.
              </span>
            ) : null}
          </label>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            post({
              action: "start_innings",
              ...startForm,
            })
          }
          className="w-full rounded-2xl bg-[#2aa7ad] py-4 text-base font-bold text-white disabled:opacity-60"
        >
          {busy
            ? "Starting…"
            : board.innings.length >= 2
              ? "Start Super Over"
              : "Start innings"}
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-[#3e2723]/10 bg-white px-4 py-6 text-sm text-[#3e2723]/70">
        No innings to score yet.
      </div>
    );
  }

  if (current.status !== "in_progress") {
    return (
      <div className="space-y-3 rounded-2xl border border-[#3e2723]/10 bg-white px-4 py-6">
        <p className="text-lg font-semibold text-[#3e2723]">
          {current.total_runs}/{current.wickets}
          <span className="ml-2 text-sm font-normal text-[#3e2723]/55">
            {board.overs} ov
          </span>
        </p>
        <p className="text-sm text-[#3e2723]/70">
          {board.match.status === "completed"
            ? board.match.result_text || "This match is complete."
            : board.match.status === "innings_break"
              ? "Innings complete. Start the next innings when ready."
              : "This innings is complete."}
        </p>
        {error ? (
          <p className="rounded-lg bg-[#fff5f8] px-3 py-2 text-sm text-[#d81b60]">
            {error}
          </p>
        ) : null}
        {board.can_score &&
        !board.match.winner_team_id &&
        !board.innings.some((row) => isSuperOverInnings(row.innings_number)) &&
        (board.match.status === "completed" ||
          (board.match.result_text ?? "").toLowerCase().includes("tied") ||
          regulationScoresTied(board.innings)) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void post({ action: "start_super_over" })}
            className="w-full rounded-2xl bg-[#d81b60] py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Starting Super Over…" : "Start Super Over"}
          </button>
        ) : null}
      </div>
    );
  }

  const needsBowler = !current.bowler_id;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#3e2723] px-4 py-5 text-[#fdf6e8]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#f5b830]">
              {board.match.team_a?.short_name} vs {board.match.team_b?.short_name}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums">
              {current.total_runs}
              <span className="text-2xl font-semibold">/{current.wickets}</span>
            </p>
            <p className="mt-1 text-sm text-[#fdf6e8]/70">
              {board.overs} ov
              {current.target_runs ? ` · Target ${current.target_runs}` : ""}
              {board.free_hit ? " · FREE HIT" : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || board.balls.length === 0}
            onClick={() => post({ action: "undo" })}
            className="rounded-xl border border-[#fdf6e8]/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-40"
          >
            Undo
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-[#fdf6e8]/50">Striker</p>
            <p className="font-semibold">
              {playerName(board.batting_players, current.striker_id)}*
            </p>
          </div>
          <div>
            <p className="text-[#fdf6e8]/50">Non-striker</p>
            <p className="font-semibold">
              {playerName(board.batting_players, current.non_striker_id)}
            </p>
          </div>
          <div>
            <p className="text-[#fdf6e8]/50">Bowler</p>
            <p className="font-semibold">
              {playerName(board.bowling_players, current.bowler_id)}
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-[#fff5f8] px-3 py-2 text-sm text-[#d81b60]">{error}</p>
      ) : null}

      {needsBowler ? (
        <label className="block text-sm">
          <span className="font-medium text-[#3e2723]">Select next bowler</span>
          <select
            className="field-select mt-1"
            defaultValue=""
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) {
                void post({ action: "set_players", bowler_id: e.target.value });
              }
            }}
          >
            <option value="">Choose bowler…</option>
            {board.bowling_players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                [null, "Bat"],
                ["wide", "Wide"],
                ["no_ball", "No ball"],
                ["bye", "Bye"],
                ["leg_bye", "Leg bye"],
              ] as const
            ).map(([val, label]) => {
              const active =
                val === extra ||
                (extra === "no_ball" &&
                  (val === "bye" || val === "leg_bye") &&
                  secondaryExtra === val);
              return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (val === extra && !secondaryExtra) {
                    setExtra(null);
                    return;
                  }
                  if (
                    extra === "no_ball" &&
                    (val === "bye" || val === "leg_bye")
                  ) {
                    setSecondaryExtra((cur) => (cur === val ? null : val));
                    return;
                  }
                  if (
                    (extra === "bye" || extra === "leg_bye") &&
                    val === "no_ball"
                  ) {
                    setSecondaryExtra(extra);
                    setExtra("no_ball");
                    return;
                  }
                  setExtra(val);
                  setSecondaryExtra(null);
                  const allowed = wicketsForExtra(val, board.free_hit);
                  if (!allowed.some((w) => w.type === wicketType)) {
                    setWicketType(allowed[0]?.type ?? "run_out");
                  }
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "bg-[#2aa7ad] text-white"
                    : "bg-[#2aa7ad]/10 text-[#1a7f84]"
                }`}
              >
                {label}
              </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setWicketMode((v) => !v);
                setDismissedId(current.striker_id ?? "");
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                wicketMode
                  ? "bg-[#d81b60] text-white"
                  : "bg-[#d81b60]/10 text-[#d81b60]"
              }`}
            >
              Wicket
            </button>
          </div>

          {wicketMode ? (
            <div className="space-y-2 rounded-xl border border-[#d81b60]/20 bg-[#fff5f8] p-3">
              <div className="flex flex-wrap gap-2">
                {wicketsForExtra(extra, board.free_hit).map((w) => (
                  <button
                    key={w.type}
                    type="button"
                    onClick={() => setWicketType(w.type)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      wicketType === w.type
                        ? "bg-[#d81b60] text-white"
                        : "bg-white text-[#3e2723]"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              {pickDismissedBatter ? (
                <select
                  className="field-select"
                  value={dismissedId || current.striker_id || ""}
                  onChange={(e) => setDismissedId(e.target.value)}
                >
                  <option value={current.striker_id ?? ""}>
                    Striker — {playerName(board.batting_players, current.striker_id)}
                  </option>
                  {current.non_striker_id ? (
                    <option value={current.non_striker_id}>
                      Non-striker —{" "}
                      {playerName(board.batting_players, current.non_striker_id)}
                    </option>
                  ) : null}
                </select>
              ) : null}
              {needsFielder ? (
                <>
                  <select
                    className="field-select"
                    value={fielderId}
                    onChange={(e) => setFielderId(e.target.value)}
                  >
                    <option value="">
                      {wicketType === "stumped"
                        ? "Wicket-keeper…"
                        : wicketType === "run_out"
                          ? "Fielder…"
                          : "Catcher…"}
                    </option>
                    {board.bowling_players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.id === current.bowler_id ? " (bowler)" : ""}
                      </option>
                    ))}
                  </select>
                  {wicketType === "caught" ? (
                    <label className="flex items-center gap-2 text-xs text-[#3e2723]">
                      <input
                        type="checkbox"
                        checked={caughtBehind}
                        onChange={(e) => setCaughtBehind(e.target.checked)}
                      />
                      Caught behind
                    </label>
                  ) : null}
                  {wicketType === "run_out" ? (
                    <select
                      className="field-select"
                      value={assistFielderId}
                      onChange={(e) => setAssistFielderId(e.target.value)}
                    >
                      <option value="">Direct hit (no assist)</option>
                      {board.bowling_players
                        .filter((p) => p.id !== fielderId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            Assist — {p.name}
                          </option>
                        ))}
                    </select>
                  ) : null}
                </>
              ) : null}
              {wicketType !== "retired_hurt" &&
              (current.wickets ?? 0) <
                (isSuperOverInnings(current.innings_number)
                  ? superOverMaxWickets()
                  : 10) -
                  1 ? (
                <select
                  className="field-select"
                  value={newBatsmanId}
                  onChange={(e) => setNewBatsmanId(e.target.value)}
                >
                  <option value="">New batsman…</option>
                  {dismissedPool.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}

          {extra ? (
            <p className="text-xs text-[#1a7f84]">
              {extra === "wide"
                ? "Tap extra runs taken after the wide (0 = wide only, +1 to the team)"
                : extra === "no_ball" && secondaryExtra
                  ? "Tap bye / leg-bye runs. Team gets 1 no-ball + those extras"
                  : extra === "no_ball"
                    ? "Tap runs off the bat. Team gets 1 no-ball + bat runs, next is a free hit"
                    : extra === "bye" || extra === "leg_bye"
                      ? "Tap how many byes / leg-byes. This is a legal ball"
                      : extraHint(extra, secondaryExtra, 0)}
            </p>
          ) : null}

          <div className="grid grid-cols-4 gap-3">
            {(extra ? EXTRA_RUNS : BAT_RUNS).map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => void sendRuns(r)}
                className="rounded-2xl bg-[#f5b830] py-6 text-2xl font-bold text-[#3e2723] shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}

      {board.recentBalls.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3e2723]/50">
            This over / recent
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {board.recentBalls.map((b) => (
              <span
                key={b.id}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#3e2723]/08 px-2 text-xs font-bold text-[#3e2723]"
              >
                {ballLabel(b)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
