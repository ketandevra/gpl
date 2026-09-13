"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { InningsBrief } from "@/lib/matches/types";
import { oversFromLegalBalls } from "@/lib/scoring/format";

type BallChip = {
  id: string;
  batsman_runs: number;
  extra_runs: number;
  extra_type: string | null;
  is_wicket: boolean;
  sequence_no: number;
};

type Props = {
  matchId: string;
  initialInnings: InningsBrief[];
  teamAId: string;
  teamAName: string;
  teamBName: string;
  status: string;
  resultText: string | null;
};

function chipLabel(b: BallChip): string {
  if (b.is_wicket) return "W";
  if (b.extra_type === "wide") return "Wd";
  if (b.extra_type === "no_ball") return "Nb";
  if (b.extra_type === "bye") return `B${b.extra_runs}`;
  if (b.extra_type === "leg_bye") return `Lb${b.extra_runs}`;
  if (b.batsman_runs === 0) return "·";
  return String(b.batsman_runs);
}

export function LiveMatchPanel({
  matchId,
  initialInnings,
  teamAId,
  teamAName,
  teamBName,
  status: initialStatus,
  resultText: initialResult,
}: Props) {
  const [innings, setInnings] = useState(initialInnings);
  const [recent, setRecent] = useState<BallChip[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [resultText, setResultText] = useState(initialResult);
  const [live, setLive] = useState(false);
  const inningsRef = useRef(innings);

  useEffect(() => {
    inningsRef.current = innings;
  }, [innings]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    let cancelled = false;

    async function loadBalls(inningsId: string) {
      const { data } = await supabase
        .from("balls")
        .select(
          "id, batsman_runs, extra_runs, extra_type, is_wicket, sequence_no",
        )
        .eq("innings_id", inningsId)
        .order("sequence_no", { ascending: false })
        .limit(12);
      if (!cancelled && data) setRecent(data as BallChip[]);
    }

    const current =
      initialInnings.find((i) => i.status === "in_progress") ??
      initialInnings[initialInnings.length - 1];
    if (current) void loadBalls(current.id);

    const channel = supabase
      .channel(`live-match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "innings",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          const { data } = await supabase
            .from("innings")
            .select("*")
            .eq("match_id", matchId)
            .order("innings_number", { ascending: true });
          if (!cancelled && data) {
            setInnings(data as InningsBrief[]);
            const cur =
              (data as InningsBrief[]).find((i) => i.status === "in_progress") ??
              (data as InningsBrief[])[(data as InningsBrief[]).length - 1];
            if (cur) void loadBalls(cur.id);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "balls",
        },
        async (payload) => {
          const row = (payload.new ?? payload.old) as { innings_id?: string };
          const latest = inningsRef.current;
          const known = new Set(latest.map((i) => i.id));
          if (row.innings_id && !known.has(row.innings_id)) return;
          const cur =
            latest.find((i) => i.status === "in_progress") ??
            latest[latest.length - 1];
          const inningsId = row.innings_id ?? cur?.id;
          if (inningsId) void loadBalls(inningsId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as {
            status?: string;
            result_text?: string | null;
          };
          if (row.status) setStatus(row.status);
          if (row.result_text !== undefined) setResultText(row.result_text);
        },
      )
      .subscribe((s) => {
        setLive(s === "SUBSCRIBED");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once per match
  }, [matchId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-[#d81b60]" : "bg-[#3e2723]/30"}`}
        />
        <span className="font-semibold uppercase tracking-widest text-[#3e2723]/50">
          {live
            ? "Realtime connected"
            : isSupabaseConfigured()
              ? "Connecting…"
              : "Live updates unavailable"}
        </span>
        <span className="ml-auto font-bold uppercase text-[#d81b60]">
          {status === "innings_break" ? "Innings break" : status}
        </span>
      </div>

      {resultText ? (
        <p className="rounded-xl bg-[#2aa7ad]/10 px-4 py-3 text-sm font-medium text-[#1a7f84]">
          {resultText}
        </p>
      ) : null}

      {innings.length === 0 ? (
        <p className="text-sm text-[#3e2723]/60">Waiting for first ball…</p>
      ) : (
        innings.map((inn) => {
          const batting =
            inn.batting_team_id === teamAId ? teamAName : teamBName;
          return (
            <div
              key={inn.id}
              className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#3e2723]">{batting}</p>
                <p className="text-2xl font-bold tabular-nums text-[#3e2723]">
                  {inn.total_runs}/{inn.wickets}
                </p>
              </div>
              <p className="mt-1 text-sm text-[#3e2723]/55">
                {oversFromLegalBalls(inn.legal_balls)} overs
                {inn.target_runs ? ` · Target ${inn.target_runs}` : ""}
              </p>
            </div>
          );
        })
      )}

      {recent.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#3e2723]/50">
            Recent balls
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...recent].reverse().map((b) => (
              <span
                key={b.id}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[#3e2723]/08 px-2 text-xs font-bold"
              >
                {chipLabel(b)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
