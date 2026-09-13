import { writeAuditLog } from "@/lib/auth/audit";
import type { SessionUser } from "@/lib/auth/permissions";
import { applyBall } from "@/lib/scoring/engine";
import type { BallEvent } from "@/lib/scoring/types";
import {
  canScoreMatch,
  deriveFreeHit,
  getScoreboard,
  listBallsForInnings,
  toInningsState,
  type BallRow,
  type InningsRow,
} from "@/lib/scoring/queries";
import { getMatchById, listInningsForMatch } from "@/lib/matches/queries";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import type {
  RecordBallInput,
  SetPlayersInput,
  StartInningsInput,
} from "@/lib/validations/scoring";
import type { Json, MatchStatus } from "@/lib/types/database";

type Result =
  | { ok: true; board: NonNullable<Awaited<ReturnType<typeof getScoreboard>>> }
  | { error: string; status: number };

async function requireScorer(
  user: SessionUser,
  matchId: string,
): Promise<{ error: string; status: number } | null> {
  if (!(await canScoreMatch(user, matchId))) {
    return { error: "You are not assigned to score this match.", status: 403 };
  }
  return null;
}

async function loadFullInnings(matchId: string): Promise<InningsRow[]> {
  const briefs = await listInningsForMatch(matchId);
  const rows = await Promise.all(
    briefs.map((b) =>
      adminRest<InningsRow[]>("innings", {
        query: `?id=eq.${encodeURIComponent(b.id)}&select=*`,
      }).then((r) => r[0]),
    ),
  );
  return rows.filter(Boolean) as InningsRow[];
}

function toBallEvent(input: RecordBallInput): BallEvent {
  const extra = input.extra_type ?? null;
  let extra_runs = input.extra_runs;
  if (extra === "wide" || extra === "no_ball") {
    extra_runs = Math.max(1, extra_runs ?? 1);
  } else if (extra === "bye" || extra === "leg_bye" || extra === "penalty") {
    extra_runs = extra_runs ?? input.batsman_runs ?? 0;
  }

  return {
    batsman_runs: input.batsman_runs,
    extra_type: extra,
    extra_runs,
    is_wicket: input.is_wicket,
    wicket_type: input.wicket_type,
    dismissed_player_id: input.dismissed_player_id,
    new_batter_id: input.new_batsman_id,
  };
}

export async function startInnings(
  user: SessionUser,
  matchId: string,
  input: StartInningsInput,
): Promise<Result> {
  const denied = await requireScorer(user, matchId);
  if (denied) return denied;

  const match = await getMatchById(matchId);
  if (!match) return { error: "Match not found.", status: 404 };

  if (!["live", "innings_break"].includes(match.status)) {
    return {
      error: "Match must be live (or innings break) to start an innings.",
      status: 400,
    };
  }

  if (
    input.batting_team_id !== match.team_a_id &&
    input.batting_team_id !== match.team_b_id
  ) {
    return { error: "Batting team must be one of the match teams.", status: 400 };
  }

  if (input.striker_id === input.non_striker_id) {
    return { error: "Striker and non-striker must be different.", status: 400 };
  }

  const existing = await loadFullInnings(matchId);
  if (existing.some((i) => i.status === "in_progress")) {
    return { error: "An innings is already in progress.", status: 400 };
  }
  if (existing.length >= 2) {
    return { error: "Both innings are already recorded.", status: 400 };
  }

  const bowling_team_id =
    input.batting_team_id === match.team_a_id ? match.team_b_id : match.team_a_id;
  const innings_number = (existing.length + 1) as 1 | 2;
  const target_runs =
    innings_number === 2 ? (existing[0]?.total_runs ?? 0) + 1 : null;

  try {
    const created = await withRetry(() =>
      adminRest<InningsRow[]>("innings", {
        method: "POST",
        prefer: "return=representation",
        body: [
          {
            match_id: matchId,
            batting_team_id: input.batting_team_id,
            bowling_team_id,
            innings_number,
            target_runs,
            status: "in_progress",
            striker_id: input.striker_id,
            non_striker_id: input.non_striker_id,
            bowler_id: input.bowler_id,
            total_runs: 0,
            wickets: 0,
            legal_balls: 0,
          },
        ],
      }),
    );

    if (match.status === "innings_break") {
      await withRetry(() =>
        adminRest("matches", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(matchId)}`,
          prefer: "return=minimal",
          body: { status: "live" satisfies MatchStatus },
        }),
      );
    }

    await writeAuditLog({
      actorId: user.id,
      action: "innings.start",
      entityType: "innings",
      entityId: created[0]?.id,
      newValue: {
        match_id: matchId,
        innings_number,
        batting_team_id: input.batting_team_id,
      },
    });

    const board = await getScoreboard(matchId, user);
    return { ok: true, board: board! };
  } catch (err) {
    console.error("[scoring] startInnings failed:", err);
    return { error: "Could not start innings.", status: 500 };
  }
}

export async function setPlayers(
  user: SessionUser,
  matchId: string,
  input: SetPlayersInput,
): Promise<Result> {
  const denied = await requireScorer(user, matchId);
  if (denied) return denied;

  const innings = await loadFullInnings(matchId);
  const current = innings.find((i) => i.status === "in_progress");
  if (!current) {
    return { error: "No innings in progress.", status: 400 };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.striker_id !== undefined) patch.striker_id = input.striker_id;
  if (input.non_striker_id !== undefined) {
    patch.non_striker_id = input.non_striker_id;
  }
  if (input.bowler_id !== undefined) patch.bowler_id = input.bowler_id;

  try {
    await withRetry(() =>
      adminRest("innings", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(current.id)}`,
        prefer: "return=minimal",
        body: patch,
      }),
    );
    const board = await getScoreboard(matchId, user);
    return { ok: true, board: board! };
  } catch (err) {
    console.error("[scoring] setPlayers failed:", err);
    return { error: "Could not update players.", status: 500 };
  }
}

export async function recordBall(
  user: SessionUser,
  matchId: string,
  input: RecordBallInput,
): Promise<Result> {
  const denied = await requireScorer(user, matchId);
  if (denied) return denied;

  const match = await getMatchById(matchId);
  if (!match) return { error: "Match not found.", status: 404 };
  if (match.status !== "live") {
    return {
      error: "Scoring is only allowed while the match is live.",
      status: 400,
    };
  }

  const inningsList = await loadFullInnings(matchId);
  const current = inningsList.find((i) => i.status === "in_progress");
  if (!current) {
    return { error: "Start an innings before scoring.", status: 400 };
  }
  if (!current.striker_id || !current.non_striker_id) {
    return { error: "Set striker and non-striker first.", status: 400 };
  }
  if (!current.bowler_id) {
    return { error: "Select a bowler before the next delivery.", status: 400 };
  }

  if (input.is_wicket && !input.wicket_type) {
    return { error: "Wicket type is required.", status: 400 };
  }
  if (
    input.is_wicket &&
    input.wicket_type !== "retired_hurt" &&
    !input.new_batsman_id &&
    current.wickets < 9
  ) {
    return { error: "Select the new batsman.", status: 400 };
  }

  const balls = await listBallsForInnings(current.id);
  const freeHit = deriveFreeHit(balls);
  const state = toInningsState(current, match, freeHit, balls.length);

  let result;
  try {
    result = applyBall(state, toBallEvent(input));
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Cannot record ball.",
      status: 400,
    };
  }

  const ball = result.ball;
  const next = result.state;
  const overEnded =
    ball.is_legal_delivery &&
    next.legal_balls > 0 &&
    next.legal_balls % 6 === 0 &&
    next.status !== "completed";

  try {
    await withRetry(() =>
      adminRest("balls", {
        method: "POST",
        prefer: "return=minimal",
        body: [
          {
            innings_id: current.id,
            sequence_no: ball.sequence_no,
            over_number: ball.over_number,
            ball_in_over: ball.ball_in_over,
            striker_id: ball.striker_id,
            non_striker_id: ball.non_striker_id,
            bowler_id: ball.bowler_id,
            batsman_runs: ball.batsman_runs,
            extra_runs: ball.extra_runs,
            total_runs: ball.total_runs,
            is_legal_delivery: ball.is_legal_delivery,
            extra_type: ball.extra_type,
            is_wicket: ball.is_wicket,
            wicket_type: ball.wicket_type,
            dismissed_player_id: ball.dismissed_player_id,
            free_hit_next: ball.free_hit_next,
            commentary: input.commentary ?? null,
          },
        ],
      }),
    );

    await withRetry(() =>
      adminRest("innings", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(current.id)}`,
        prefer: "return=minimal",
        body: {
          total_runs: next.total_runs,
          wickets: next.wickets,
          legal_balls: next.legal_balls,
          status: next.status,
          striker_id: next.striker_id,
          non_striker_id: next.non_striker_id,
          bowler_id: overEnded ? null : next.bowler_id,
          updated_at: new Date().toISOString(),
        },
      }),
    );

    if (next.status === "completed") {
      await maybeAdvanceMatch(user, matchId, inningsList, {
        innings_number: current.innings_number,
        batting_team_id: current.batting_team_id,
        bowling_team_id: current.bowling_team_id,
        total_runs: next.total_runs,
        wickets: next.wickets,
        target_runs: next.target_runs,
        max_wickets: next.max_wickets ?? 10,
      });
    }

    await writeAuditLog({
      actorId: user.id,
      action: "ball.record",
      entityType: "ball",
      entityId: current.id,
      newValue: {
        sequence_no: ball.sequence_no,
        total_runs: ball.total_runs,
        is_wicket: ball.is_wicket,
      } as Json,
    });

    const board = await getScoreboard(matchId, user);
    return { ok: true, board: board! };
  } catch (err) {
    console.error("[scoring] recordBall failed:", err);
    return { error: "Could not record ball.", status: 500 };
  }
}

async function maybeAdvanceMatch(
  user: SessionUser,
  matchId: string,
  inningsList: InningsRow[],
  finished: {
    innings_number: number;
    batting_team_id: string;
    bowling_team_id: string;
    total_runs: number;
    wickets: number;
    target_runs: number | null;
    max_wickets: number;
  },
) {
  if (finished.innings_number === 1) {
    await withRetry(() =>
      adminRest("matches", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(matchId)}`,
        prefer: "return=minimal",
        body: {
          status: "innings_break" satisfies MatchStatus,
          result_text: null,
        },
      }),
    );
    await writeAuditLog({
      actorId: user.id,
      action: "match.innings_break",
      entityType: "match",
      entityId: matchId,
      newValue: { reason: "First innings complete" },
    });
    return;
  }

  const first = inningsList.find((i) => i.innings_number === 1);
  const match = await getMatchById(matchId);
  if (!match || !first) return;

  const chaseTeam = finished.batting_team_id;
  const defendTeam = finished.bowling_team_id;
  const target = finished.target_runs ?? first.total_runs + 1;
  let winner_team_id: string | null = null;
  let result_text = "Match completed";

  const chaseName =
    chaseTeam === match.team_a_id ? match.team_a?.name : match.team_b?.name;
  const defendName =
    defendTeam === match.team_a_id ? match.team_a?.name : match.team_b?.name;

  if (finished.total_runs >= target) {
    winner_team_id = chaseTeam;
    const wicketsLeft = Math.max(0, finished.max_wickets - finished.wickets);
    result_text = `${chaseName} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
  } else if (finished.total_runs === target - 1) {
    winner_team_id = null;
    result_text = "Match tied";
  } else {
    winner_team_id = defendTeam;
    const margin = target - 1 - finished.total_runs;
    result_text = `${defendName} won by ${margin} run${margin === 1 ? "" : "s"}`;
  }

  await withRetry(() =>
    adminRest("matches", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(matchId)}`,
      prefer: "return=minimal",
      body: {
        status: "completed" satisfies MatchStatus,
        winner_team_id,
        result_text,
      },
    }),
  );

  await writeAuditLog({
    actorId: user.id,
    action: "match.complete",
    entityType: "match",
    entityId: matchId,
    newValue: { winner_team_id, result_text },
  });
}

export async function undoLastBall(
  user: SessionUser,
  matchId: string,
): Promise<Result> {
  const denied = await requireScorer(user, matchId);
  if (denied) return denied;

  const match = await getMatchById(matchId);
  if (!match) return { error: "Match not found.", status: 404 };

  const inningsList = await loadFullInnings(matchId);
  const current =
    inningsList.find((i) => i.status === "in_progress") ??
    [...inningsList].reverse().find((i) => i.status === "completed") ??
    null;
  if (!current) {
    return { error: "No innings to undo.", status: 400 };
  }

  const balls = await listBallsForInnings(current.id);
  const last = balls[balls.length - 1];
  if (!last) {
    return { error: "No balls to undo.", status: 400 };
  }

  const restored = {
    total_runs: Math.max(0, current.total_runs - last.total_runs),
    wickets: Math.max(
      0,
      current.wickets -
        (last.is_wicket && last.wicket_type !== "retired_hurt" ? 1 : 0),
    ),
    legal_balls: Math.max(
      0,
      current.legal_balls - (last.is_legal_delivery ? 1 : 0),
    ),
    striker_id: last.striker_id,
    non_striker_id: last.non_striker_id,
    bowler_id: last.bowler_id,
    status: "in_progress" as const,
    updated_at: new Date().toISOString(),
  };

  try {
    await withRetry(() =>
      adminRest("balls", {
        method: "DELETE",
        query: `?id=eq.${encodeURIComponent(last.id)}`,
      }),
    );

    await withRetry(() =>
      adminRest("innings", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(current.id)}`,
        prefer: "return=minimal",
        body: restored,
      }),
    );

    if (["completed", "innings_break"].includes(match.status)) {
      await withRetry(() =>
        adminRest("matches", {
          method: "PATCH",
          query: `?id=eq.${encodeURIComponent(matchId)}`,
          prefer: "return=minimal",
          body: {
            status: "live" satisfies MatchStatus,
            winner_team_id: null,
            result_text: null,
          },
        }),
      );
    }

    await writeAuditLog({
      actorId: user.id,
      action: "ball.undo",
      entityType: "ball",
      entityId: last.id,
      previousValue: {
        sequence_no: last.sequence_no,
        total_runs: last.total_runs,
      } as Json,
    });

    const board = await getScoreboard(matchId, user);
    return { ok: true, board: board! };
  } catch (err) {
    console.error("[scoring] undo failed:", err);
    return { error: "Could not undo last ball.", status: 500 };
  }
}

export type { BallRow, InningsRow };
