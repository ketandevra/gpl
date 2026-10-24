"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  extrasLabel,
  type BatterLine,
  type BowlerLine,
  type InningsCard,
} from "@/lib/scoring/scorecard";
import { oversFromLegalBalls, runRate } from "@/lib/scoring/format";
import { playerRoleLabel } from "@/lib/teams/labels";
import type { PlayerRole } from "@/lib/types/database";

type SquadPlayer = {
  id: string;
  name: string;
  public_code: string;
  role: PlayerRole;
  jersey_number: number | null;
  avatar_url?: string | null;
  photo_url?: string | null;
  is_captain?: boolean;
};

type BoardView = {
  match: {
    status: string;
    result_text: string | null;
    winner_team_id?: string | null;
    overs_per_innings: number;
    toss_winner?: { name: string } | null;
    toss_decision?: string | null;
    team_a?: { name: string; short_name: string } | null;
    team_b?: { name: string; short_name: string } | null;
  };
  can_score?: boolean;
  current: {
    total_runs: number;
    legal_balls: number;
    target_runs: number | null;
  } | null;
  cards: InningsCard[];
  free_hit: boolean;
  team_a_players?: SquadPlayer[];
  team_b_players?: SquadPlayer[];
};

type Props = {
  matchId: string;
  initial: BoardView;
};

type Tab = "live" | "scorecard" | "squads";

function strikeRate(batter: BatterLine) {
  if (batter.balls <= 0) return "0.00";
  return ((batter.runs * 100) / batter.balls).toFixed(2);
}

function economy(bowler: BowlerLine) {
  if (bowler.balls <= 0) return "0.00";
  return ((bowler.runs * 6) / bowler.balls).toFixed(2);
}

function ballChipClass(label: string) {
  if (label === "W") return "bg-[#d81b60] text-white";
  if (label === "6") return "bg-[#2aa7ad] text-white";
  if (label === "4") return "bg-[#f5b830] text-[#3e2723]";
  if (label.startsWith("Wd") || label.startsWith("Nb")) {
    return "bg-[#fff6df] text-[#8a6500] ring-1 ring-[#f5b830]/50";
  }
  if (label === "·" || label === "0") {
    return "bg-[#3e2723]/8 text-[#3e2723]/55";
  }
  return "bg-[#3e2723] text-[#fdf6e8]";
}

function BallChip({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-bold ${ballChipClass(label)}`}
    >
      {label === "·" ? "0" : label}
    </span>
  );
}

function ScoreLine({
  shortName,
  runs,
  wickets,
  overs,
  emphasis,
  crr,
}: {
  shortName: string;
  runs: number;
  wickets: number;
  overs: string;
  emphasis?: boolean;
  crr?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p
        className={`min-w-0 truncate font-semibold ${
          emphasis ? "text-lg text-white" : "text-sm text-white/65"
        }`}
      >
        {shortName}
      </p>
      <div className="shrink-0 text-right">
        <p
          className={`tabular-nums leading-none ${
            emphasis ? "text-3xl font-bold text-white" : "text-xl font-semibold text-white/80"
          }`}
        >
          {runs}
          <span className={emphasis ? "text-xl font-semibold" : "text-base"}>
            /{wickets}
          </span>
          <span className="ml-2 align-middle text-xs font-medium text-white/45">
            ({overs})
          </span>
        </p>
        {crr ? (
          <p className="mt-1 text-[11px] font-medium text-[#f5b830]">CRR {crr}</p>
        ) : null}
      </div>
    </div>
  );
}

function StatTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<{
    key: string;
    name: string;
    mark?: boolean;
    cells: Array<string | number>;
    empty?: boolean;
  }>;
}) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col />
        <col className="w-9" />
        <col className="w-9" />
        <col className="w-9" />
        <col className="w-9" />
        <col className="w-14" />
      </colgroup>
      <thead>
        <tr className="bg-[#f8efe0] text-[10px] font-bold uppercase tracking-[0.12em] text-[#3e2723]/45">
          <th className="px-4 py-2 text-left">{title}</th>
          {headers.map((h) => (
            <th key={h} className="py-2 pr-3 text-right last:pr-4">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            className={`border-t border-[#3e2723]/6 ${
              row.empty ? "text-[#3e2723]/35" : "text-[#3e2723]"
            } ${row.mark ? "bg-[#2aa7ad]/6" : ""}`}
          >
            <td className="px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                <span className="truncate">{row.name}</span>
                {row.mark ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2aa7ad]" />
                ) : null}
              </span>
            </td>
            {row.cells.map((cell, i) => (
              <td
                key={`${row.key}-${i}`}
                className={`py-2.5 pr-3 text-right text-sm tabular-nums last:pr-4 ${
                  i === 0 ? "font-bold" : "text-[#3e2723]/70"
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function playingXiName(player: SquadPlayer) {
  const marks: string[] = [];
  if (player.is_captain) marks.push("C");
  if (player.role === "wicket_keeper") marks.push("WK");
  return marks.length ? `${player.name} (${marks.join(" & ")})` : player.name;
}

function playingXiRole(player: SquadPlayer) {
  switch (player.role) {
    case "batsman":
      return "Batter";
    case "bowler":
      return "Bowler";
    case "all_rounder":
      return "Batting Allrounder";
    case "wicket_keeper":
      return "WK-Batter";
    default:
      return playerRoleLabel(player.role);
  }
}

function TeamCrest({ shortName }: { shortName: string }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold tracking-wide text-[#1a7f84] shadow-sm ring-1 ring-[#2aa7ad]/20">
      {shortName.slice(0, 3)}
    </span>
  );
}

function PlayingXiCell({
  player,
  align,
}: {
  player: SquadPlayer | null;
  align: "left" | "right";
}) {
  if (!player) {
    return <div className="min-h-[4.25rem] px-3 py-3" />;
  }

  const name = playingXiName(player);
  const role = playingXiRole(player);
  const photo = (
    <UserAvatar
      name={player.name}
      src={player.avatar_url ?? player.photo_url ?? null}
      size="sm"
      className="border border-[#3e2723]/8"
    />
  );

  return (
    <Link
      href={`/players/${player.id}`}
      className={`flex min-h-[4.25rem] items-center gap-2.5 px-3 py-3 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {photo}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#3e2723]">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[#3e2723]/45">
          {role}
        </span>
      </span>
    </Link>
  );
}

function PlayingXI({
  teamA,
  teamB,
  sideA,
  sideB,
}: {
  teamA: string;
  teamB: string;
  sideA: SquadPlayer[];
  sideB: SquadPlayer[];
}) {
  const rows = Math.max(sideA.length, sideB.length, 1);

  return (
    <div>
      <div className="flex items-center justify-between bg-[#e8f6f6] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <TeamCrest shortName={teamA} />
          <p className="truncate text-sm font-bold text-[#3e2723]">{teamA}</p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold text-[#3e2723]">{teamB}</p>
          <TeamCrest shortName={teamB} />
        </div>
      </div>
      <h3 className="py-4 text-center text-lg font-semibold text-[#3e2723]">
        Playing XI
      </h3>
      {sideA.length === 0 && sideB.length === 0 ? (
        <p className="px-4 pb-6 text-center text-sm text-[#3e2723]/45">
          Squads not announced yet.
        </p>
      ) : (
        <div className="border-t border-[#3e2723]/8">
          {Array.from({ length: rows }, (_, index) => (
            <div
              key={sideA[index]?.id ?? sideB[index]?.id ?? index}
              className="grid grid-cols-2 border-b border-[#3e2723]/8 last:border-b-0 [&>:first-child]:border-r [&>:first-child]:border-[#3e2723]/8"
            >
              <PlayingXiCell player={sideA[index] ?? null} align="left" />
              <PlayingXiCell player={sideB[index] ?? null} align="right" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FullCard({ card }: { card: InningsCard }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#3e2723]/8 bg-white">
      <header className="flex items-center justify-between gap-3 bg-[#3e2723] px-4 py-3 text-[#fdf6e8]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5b830]">
            {card.innings_number >= 3
              ? `Super Over${card.innings_number >= 5 ? " 2" : ""}`
              : `Innings ${card.innings_number}`}
          </p>
          <p className="mt-0.5 font-bold">{card.batting_name}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums">
          {card.total_runs}/{card.wickets}
          <span className="ml-1 text-sm font-medium text-white/50">
            ({card.overs})
          </span>
        </p>
      </header>
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col />
          <col className="w-9" />
          <col className="w-9" />
          <col className="w-9" />
          <col className="w-9" />
          <col className="w-14" />
        </colgroup>
        <thead>
          <tr className="bg-[#f8efe0] text-[10px] uppercase tracking-[0.12em] text-[#3e2723]/45">
            <th className="px-4 py-2 font-bold">Batter</th>
            <th className="py-2 pr-3 text-right font-bold">R</th>
            <th className="py-2 pr-3 text-right font-bold">B</th>
            <th className="py-2 pr-3 text-right font-bold">4s</th>
            <th className="py-2 pr-3 text-right font-bold">6s</th>
            <th className="py-2 pr-4 text-right font-bold">SR</th>
          </tr>
        </thead>
        <tbody>
          {card.batters.map((b) => (
            <tr key={b.player_id} className="border-t border-[#3e2723]/6">
              <td className="px-4 py-2">
                <span className="font-semibold">
                  {b.name}
                  {b.on_strike ? " *" : ""}
                </span>
                <span className="mt-0.5 block text-[11px] capitalize text-[#3e2723]/40">
                  {b.out ? b.how_out : "not out"}
                </span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums font-bold">{b.runs}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-[#3e2723]/60">
                {b.balls}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-[#3e2723]/60">
                {b.fours}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-[#3e2723]/60">
                {b.sixes}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-[#3e2723]/60">
                {strikeRate(b)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[#3e2723]/6 px-4 py-2 text-xs text-[#3e2723]/50">
        Extras {extrasLabel(card.extras)}
        {card.yet_to_bat.length ? ` · Yet to bat: ${card.yet_to_bat.join(", ")}` : ""}
      </p>
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col />
          <col className="w-9" />
          <col className="w-9" />
          <col className="w-9" />
          <col className="w-9" />
          <col className="w-14" />
        </colgroup>
        <thead>
          <tr className="bg-[#f8efe0] text-[10px] uppercase tracking-[0.12em] text-[#3e2723]/45">
            <th className="px-4 py-2 font-bold">Bowler</th>
            <th className="py-2 pr-3 text-right font-bold">O</th>
            <th className="py-2 pr-3 text-right font-bold">M</th>
            <th className="py-2 pr-3 text-right font-bold">R</th>
            <th className="py-2 pr-3 text-right font-bold">W</th>
            <th className="py-2 pr-4 text-right font-bold">ECO</th>
          </tr>
        </thead>
        <tbody>
          {card.bowlers.map((b) => (
            <tr key={b.player_id} className="border-t border-[#3e2723]/6">
              <td className="px-4 py-2 font-semibold">{b.name}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {oversFromLegalBalls(b.balls)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-[#3e2723]/60">
                {b.maidens}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-[#3e2723]/60">
                {b.runs}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums font-bold">{b.wickets}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-[#3e2723]/60">
                {economy(b)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {card.fall.length ? (
        <p className="border-t border-[#3e2723]/6 px-4 py-3 text-xs leading-5 text-[#3e2723]/55">
          Fall of wickets:{" "}
          {card.fall
            .map((f) => `${f.wicket}-${f.score} (${f.name}, ${f.overs} ov)`)
            .join(" · ")}
        </p>
      ) : null}
    </article>
  );
}

function awaitingSuperOver(board: BoardView) {
  if (board.match.winner_team_id) return false;
  if (board.cards.some((card) => card.innings_number >= 3)) return false;
  const first = board.cards.find((card) => card.innings_number === 1);
  const second = board.cards.find((card) => card.innings_number === 2);
  const scoresTied = Boolean(
    first &&
      second &&
      first.status !== "in_progress" &&
      second.status !== "in_progress" &&
      first.total_runs === second.total_runs,
  );
  const resultTied = (board.match.result_text ?? "").toLowerCase().includes("tied");
  return (
    board.match.status === "completed" ||
    resultTied ||
    scoresTied
  );
}

export function LiveMatchPanel({ matchId, initial }: Props) {
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState<Tab>("live");
  const [startingSuperOver, setStartingSuperOver] = useState(false);
  const [superOverError, setSuperOverError] = useState<string | null>(null);

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  const isLive =
    board.match.status === "live" || board.match.status === "innings_break";

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch(`/api/scoring/${matchId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as BoardView;
        if (!cancelled && data.match) setBoard(data);
      } catch {
        // keep last good board
      }
    }
    const id = window.setInterval(() => void refresh(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLive, matchId]);

  const current =
    board.cards.find((c) => c.status === "in_progress") ??
    board.cards[board.cards.length - 1] ??
    null;
  const previous = current
    ? board.cards.find((c) => c.innings_number === current.innings_number - 1)
    : null;
  const liveBatters = current
    ? current.batters.filter((b) => !b.out).slice(0, 2)
    : [];
  const liveBowlers = current
    ? [
        current.bowlers.find((b) => b.player_id === current.current_bowler_id),
        ...current.bowlers.filter((b) => b.player_id !== current.current_bowler_id),
      ]
        .filter((b): b is BowlerLine => Boolean(b))
        .slice(0, 2)
    : [];
  const lastWicket = current?.fall[current.fall.length - 1] ?? null;
  const rr = board.current
    ? runRate(board.current.total_runs, board.current.legal_balls)
    : 0;
  const ballsLeft = board.current
    ? Math.max(0, board.match.overs_per_innings * 6 - board.current.legal_balls)
    : 0;
  const needed =
    board.current?.target_runs != null
      ? board.current.target_runs - board.current.total_runs
      : null;

  let statusLine = board.match.result_text ?? "";
  if (!statusLine && board.match.status === "innings_break") {
    statusLine = "Innings break — second innings starting soon";
  } else if (!statusLine && needed != null && current) {
    statusLine =
      needed > 0
        ? `${current.batting_name} need ${needed} from ${ballsLeft} balls`
        : `${current.batting_name} won`;
  } else if (!statusLine && board.free_hit) {
    statusLine = "Free hit next ball";
  }

  const toss =
    board.match.toss_winner?.name && board.match.toss_decision
      ? `${board.match.toss_winner.name}, ${board.match.toss_decision === "bat" ? "batting" : "bowling"}`
      : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-[#3e2723]/8 bg-white shadow-[0_18px_40px_-24px_rgba(62,39,35,0.45)]">
      <div className="bg-[#3e2723] px-4 py-5 sm:px-5">
        <div className="space-y-3">
          {previous ? (
            <ScoreLine
              shortName={previous.batting_short}
              runs={previous.total_runs}
              wickets={previous.wickets}
              overs={previous.overs}
            />
          ) : null}
          {current ? (
            <ScoreLine
              shortName={current.batting_short}
              runs={current.total_runs}
              wickets={current.wickets}
              overs={current.overs}
              emphasis
              crr={rr ? rr.toFixed(2) : null}
            />
          ) : (
            <p className="text-sm text-white/50">Waiting for the first ball</p>
          )}
        </div>
        {statusLine ? (
          <p className="mt-4 rounded-xl bg-white/8 px-3 py-2 text-sm font-medium text-[#ffcf5c]">
            {statusLine}
          </p>
        ) : null}
        {board.can_score && awaitingSuperOver(board) ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              disabled={startingSuperOver}
              onClick={() => {
                void (async () => {
                  setStartingSuperOver(true);
                  setSuperOverError(null);
                  try {
                    const res = await fetch(`/api/scoring/${matchId}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "start_super_over" }),
                    });
                    const data = (await res.json()) as BoardView & {
                      error?: string;
                    };
                    if (!res.ok) {
                      setSuperOverError(data.error ?? "Could not start Super Over");
                      return;
                    }
                    setBoard(data);
                    router.push(`/score/${matchId}`);
                    router.refresh();
                  } catch {
                    setSuperOverError("Network error");
                  } finally {
                    setStartingSuperOver(false);
                  }
                })();
              }}
              className="w-full rounded-xl bg-[#d81b60] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {startingSuperOver ? "Starting Super Over…" : "Start Super Over"}
            </button>
            <p className="text-center text-[11px] text-white/50">
              One over each, two wickets — same as international T20.
            </p>
            {superOverError ? (
              <p className="text-center text-xs text-[#ffcf5c]">{superOverError}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex border-b border-[#3e2723]/8">
        {(
          [
            ["live", "Live"],
            ["scorecard", "Scorecard"],
            ["squads", "Squads"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`relative min-h-11 flex-1 px-2 text-sm font-bold ${
              tab === id
                ? "text-[#1a7f84] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#1a7f84]"
                : "text-[#3e2723]/35"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "squads" ? (
        <PlayingXI
          teamA={board.match.team_a?.short_name ?? "A"}
          teamB={board.match.team_b?.short_name ?? "B"}
          sideA={board.team_a_players ?? []}
          sideB={board.team_b_players ?? []}
        />
      ) : tab === "live" ? (
        <div>
          <StatTable
            title="Batter"
            headers={["R", "B", "4s", "6s", "SR"]}
            rows={
              liveBatters.length
                ? liveBatters.map((b) => ({
                    key: b.player_id,
                    name: b.name,
                    mark: b.on_strike,
                    cells: [b.runs, b.balls, b.fours, b.sixes, strikeRate(b)],
                  }))
                : [{ key: "empty-bat", name: "No batter yet", cells: ["—", "—", "—", "—", "—"], empty: true }]
            }
          />
          <StatTable
            title="Bowler"
            headers={["O", "M", "R", "W", "ECO"]}
            rows={
              liveBowlers.length
                ? liveBowlers.map((b) => ({
                    key: b.player_id,
                    name: b.name,
                    mark: b.player_id === current?.current_bowler_id,
                    cells: [
                      oversFromLegalBalls(b.balls),
                      b.maidens,
                      b.runs,
                      b.wickets,
                      economy(b),
                    ],
                  }))
                : [{ key: "empty-bowl", name: "No bowler yet", cells: ["—", "—", "—", "—", "—"], empty: true }]
            }
          />

          {current?.recent_overs.length ? (
            <div className="border-t border-[#3e2723]/6 px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#3e2723]/40">
                Recent
              </p>
              <div className="mt-2 space-y-2">
                {current.recent_overs.map((over) => (
                  <div key={over.over} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-[11px] font-semibold text-[#3e2723]/35">
                      Ov {over.over + 1}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {over.balls.map((label, i) => (
                        <BallChip key={`${over.over}-${i}`} label={label} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 border-t border-[#3e2723]/6 bg-[#fffaf1] p-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#3e2723]/40">
                Partnership
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-[#3e2723]">
                {current
                  ? `${current.partnership_runs}`
                  : "—"}
                {current ? (
                  <span className="text-sm font-medium text-[#3e2723]/45">
                    {" "}
                    ({current.partnership_balls})
                  </span>
                ) : null}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#3e2723]/40">
                Last wicket
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[#3e2723]">
                {lastWicket
                  ? `${lastWicket.name} · ${lastWicket.score}/${lastWicket.wicket}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#3e2723]/40">
                Toss
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[#3e2723]">
                {toss ?? "—"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-3">
          {board.cards.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-[#3e2723]/50">
              Scorecard will appear after the first innings starts.
            </p>
          ) : (
            board.cards.map((card) => <FullCard key={card.innings_id} card={card} />)
          )}
        </div>
      )}
    </div>
  );
}
