"use client";

import { useMemo, useState } from "react";
import { PointsTable } from "@/components/stats/PointsTable";
import {
  formatAverage,
  formatBattingScore,
  type BattingLeaderRow,
  type BowlingLeaderRow,
  type FieldingLeaderRow,
  type MvpLeaderRow,
} from "@/lib/stats/leaderboard";
import type { PointsRow } from "@/lib/stats/points";

type Tab = "points" | "leaderboard";
type Board = "bat" | "bowl" | "field" | "mvp";

type Props = {
  tournamentName: string | null;
  points: PointsRow[];
  batting: BattingLeaderRow[];
  bowling: BowlingLeaderRow[];
  fielding: FieldingLeaderRow[];
  mvp: MvpLeaderRow[];
};

function Photo({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-11 w-11 rounded-full object-cover ring-1 ring-[#3e2723]/10"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#efe4cf] text-sm font-bold text-[#3e2723]/55"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span className="w-8 shrink-0 text-right text-lg font-bold tabular-nums text-[#3e2723]/25">
      {String(n).padStart(2, "0")}
    </span>
  );
}

function groupBattingLines(rows: BattingLeaderRow["matches"]) {
  const groups = new Map<string, typeof rows>();
  for (const line of rows) {
    const list = groups.get(line.match_id) ?? [];
    list.push(line);
    groups.set(line.match_id, list);
  }
  return [...groups.values()].map((lines) => ({
    date_label: lines[0]!.date_label,
    opponent: lines[0]!.opponent,
    scores: lines
      .sort((a, b) => a.innings_number - b.innings_number)
      .map(formatBattingScore)
      .join(", "),
  }));
}

function groupBowlingLines(rows: BowlingLeaderRow["matches"]) {
  const groups = new Map<string, typeof rows>();
  for (const line of rows) {
    const list = groups.get(line.match_id) ?? [];
    list.push(line);
    groups.set(line.match_id, list);
  }
  return [...groups.values()].map((lines) => ({
    date_label: lines[0]!.date_label,
    opponent: lines[0]!.opponent,
    figures: lines
      .sort((a, b) => a.innings_number - b.innings_number)
      .map((l) => l.figures)
      .join(", "),
  }));
}

export function StatsHub({
  tournamentName,
  points,
  batting,
  bowling,
  fielding,
  mvp,
}: Props) {
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [board, setBoard] = useState<Board>("bat");
  const [team, setTeam] = useState("all");
  const [sort, setSort] = useState("default");

  const teams = useMemo(() => {
    const names = new Set<string>();
    for (const row of [...batting, ...bowling, ...fielding, ...mvp]) {
      if (row.team_name) names.add(row.team_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [batting, bowling, fielding, mvp]);

  const battingRows = useMemo(() => {
    const list = batting.filter((r) => team === "all" || r.team_name === team);
    const copy = [...list];
    if (sort === "sr") copy.sort((a, b) => b.strike_rate - a.strike_rate);
    else if (sort === "avg")
      copy.sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
    else if (sort === "sixes") copy.sort((a, b) => b.sixes - a.sixes);
    else if (sort === "fours") copy.sort((a, b) => b.fours - a.fours);
    return copy;
  }, [batting, team, sort]);

  const bowlingRows = useMemo(() => {
    const list = bowling.filter((r) => team === "all" || r.team_name === team);
    const copy = [...list];
    if (sort === "eco") copy.sort((a, b) => a.economy - b.economy);
    else if (sort === "avg")
      copy.sort((a, b) => (a.average ?? 999) - (b.average ?? 999));
    else if (sort === "maidens") copy.sort((a, b) => b.maidens - a.maidens);
    return copy;
  }, [bowling, team, sort]);

  const fieldingRows = useMemo(
    () => fielding.filter((r) => team === "all" || r.team_name === team),
    [fielding, team],
  );
  const mvpRows = useMemo(
    () => mvp.filter((r) => team === "all" || r.team_name === team),
    [mvp, team],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        {tournamentName ?? "Tournament"}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">Statistics</h1>
      <p className="mt-1 text-sm text-[#3e2723]/65">
        Points table and player leaderboards from scored matches.
      </p>

      <div className="mt-6 flex gap-1 rounded-full bg-[#efe4cf] p-1">
        {(
          [
            ["points", "Points table"],
            ["leaderboard", "Leaderboard"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${
              tab === id ? "bg-white text-[#1a7f84] shadow-sm" : "text-[#3e2723]/65"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "points" ? (
        <section className="mt-6">
          <PointsTable rows={points} />
        </section>
      ) : (
        <section className="mt-6">
          <div className="flex gap-5 border-b border-[#3e2723]/10 text-sm font-semibold">
            {(
              [
                ["bat", "Bat"],
                ["bowl", "Bowl"],
                ["field", "Field"],
                ["mvp", "MVP"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setBoard(id);
                  setSort("default");
                }}
                className={`-mb-px border-b-2 pb-2 ${
                  board === id
                    ? "border-[#d81b60] text-[#3e2723]"
                    : "border-transparent text-[#3e2723]/45"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <select
              className="field-select"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            >
              <option value="all">All teams</option>
              {teams.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {board === "bat" ? (
              <select
                className="field-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="default">Most runs</option>
                <option value="sr">Highest strike rate</option>
                <option value="avg">Highest average</option>
                <option value="sixes">Most sixes</option>
                <option value="fours">Most fours</option>
              </select>
            ) : null}
            {board === "bowl" ? (
              <select
                className="field-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="default">Most wickets</option>
                <option value="eco">Best economy</option>
                <option value="avg">Best average</option>
                <option value="maidens">Most maidens</option>
              </select>
            ) : null}
          </div>

          {board === "bat" ? (
            battingRows.length === 0 ? (
              <Empty label="No batting figures yet." />
            ) : (
              <ul className="mt-4 divide-y divide-[#3e2723]/08">
                {battingRows.map((row, i) => (
                  <li key={row.player_id} className="py-4">
                    <div className="flex items-start gap-3">
                      <Photo src={row.photo_url} name={row.player_name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#3e2723]">
                          {row.player_name}{" "}
                          <span className="font-normal text-[#3e2723]/50">
                            ({row.team_name})
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-[#3e2723]/60">
                          Inn: {row.innings} · Runs: {row.runs} · Avg:{" "}
                          {formatAverage(row.average)} · SR:{" "}
                          {row.strike_rate.toFixed(2)}
                        </p>
                        <p className="text-xs text-[#3e2723]/55">
                          HS: {row.highest_score}
                          {row.highest_not_out ? "*" : ""} · N/O: {row.not_outs} ·
                          6s: {row.sixes} · 4s: {row.fours} · 50s: {row.fifties} ·
                          100s: {row.hundreds}
                        </p>
                        <ul className="mt-2 space-y-1">
                          {groupBattingLines(row.matches).map((line) => (
                            <li
                              key={`${row.player_id}-${line.date_label}-${line.opponent}-${line.scores}`}
                              className="flex justify-between gap-3 text-xs text-[#3e2723]/70"
                            >
                              <span>
                                {line.date_label} v {line.opponent}
                              </span>
                              <span className="tabular-nums text-[#1a7f84]">
                                {line.scores}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Rank n={i + 1} />
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {board === "bowl" ? (
            bowlingRows.length === 0 ? (
              <Empty label="No bowling figures yet." />
            ) : (
              <ul className="mt-4 divide-y divide-[#3e2723]/08">
                {bowlingRows.map((row, i) => (
                  <li key={row.player_id} className="py-4">
                    <div className="flex items-start gap-3">
                      <Photo src={row.photo_url} name={row.player_name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#3e2723]">
                          {row.player_name}{" "}
                          <span className="font-normal text-[#3e2723]/50">
                            ({row.team_name})
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-[#3e2723]/60">
                          Inn: {row.innings} · W: {row.wickets} · Eco:{" "}
                          {row.economy.toFixed(2)} · Avg:{" "}
                          {formatAverage(row.average)}
                        </p>
                        <p className="text-xs text-[#3e2723]/55">
                          M: {row.maidens} · HW: {row.highest_wickets} · SR:{" "}
                          {formatAverage(row.strike_rate)} · Dots: {row.dots}
                        </p>
                        <ul className="mt-2 space-y-1">
                          {groupBowlingLines(row.matches).map((line) => (
                            <li
                              key={`${row.player_id}-${line.date_label}-${line.opponent}-${line.figures}`}
                              className="flex justify-between gap-3 text-xs text-[#3e2723]/70"
                            >
                              <span>
                                {line.date_label} v {line.opponent}
                              </span>
                              <span className="tabular-nums text-[#1a7f84]">
                                {line.figures}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Rank n={i + 1} />
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {board === "field" ? (
            fieldingRows.length === 0 ? (
              <Empty label="No fielding dismissals credited yet. Record the catcher or fielder when scoring a wicket." />
            ) : (
              <ul className="mt-4 divide-y divide-[#3e2723]/08">
                {fieldingRows.map((row, i) => (
                  <li key={row.player_id} className="py-4">
                    <div className="flex items-start gap-3">
                      <Photo src={row.photo_url} name={row.player_name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#3e2723]">
                          {row.player_name}{" "}
                          <span className="font-normal text-[#3e2723]/50">
                            ({row.team_name})
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-[#3e2723]/60">
                          Mat: {row.matches_played} · Dismissal: {row.dismissals} ·
                          Catches: {row.catches} · R/o: {row.run_outs}
                        </p>
                        <p className="text-xs text-[#3e2723]/55">
                          C&B: {row.caught_and_bowled} · C.B: {row.caught_behind} ·
                          St: {row.stumpings} · Asst. R/o: {row.assist_run_outs}
                        </p>
                      </div>
                      <Rank n={i + 1} />
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {board === "mvp" ? (
            mvpRows.length === 0 ? (
              <Empty label="MVP points appear after matches are scored." />
            ) : (
              <div className="mt-4">
                <p className="mb-3 text-xs text-[#3e2723]/55">
                  MVP = batting + bowling + fielding. 10 runs = 1 batting point.
                  Wickets are worth more against top-order batters. Faster scoring
                  and tighter bowling than the innings rate earn a bonus. Catchers
                  and stumpers get 20% of that wicket; a direct run-out gets the
                  full wicket value.
                </p>
                <ul className="divide-y divide-[#3e2723]/08">
                  {mvpRows.map((row, i) => (
                    <li key={row.player_id} className="py-4">
                      <div className="flex items-start gap-3">
                        <Photo src={row.photo_url} name={row.player_name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-semibold text-[#3e2723]">
                              {row.player_name}
                              <span className="ml-1 font-normal text-[#3e2723]/50">
                                {row.team_name}
                              </span>
                            </p>
                            <p className="text-lg font-bold tabular-nums text-[#3e2723]">
                              {row.total.toFixed(4)}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-[#3e2723]/55">
                            Batting: {row.batting.toFixed(4)} + Bowling:{" "}
                            {row.bowling.toFixed(4)} + Fielding:{" "}
                            {row.fielding.toFixed(4)} = {row.total.toFixed(4)}
                          </p>
                        </div>
                        <Rank n={i + 1} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : null}
        </section>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="mt-6 rounded-xl border border-dashed border-[#3e2723]/15 px-4 py-8 text-center text-sm text-[#3e2723]/55">
      {label}
    </p>
  );
}
