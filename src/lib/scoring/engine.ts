import type {
  ApplyBallResult,
  BallEvent,
  BallRecord,
  ExtraType,
  InningsState,
  WicketType,
} from "./types";

const DEFAULT_MAX_WICKETS = 10;

function maxWickets(state: InningsState): number {
  return state.max_wickets ?? DEFAULT_MAX_WICKETS;
}

function cloneState(state: InningsState): InningsState {
  return { ...state };
}

function swapStrike(state: InningsState): void {
  const prev = state.striker_id;
  state.striker_id = state.non_striker_id;
  state.non_striker_id = prev;
}

/** Over index and ball-in-over for the next / current delivery slot. */
export function deliverySlot(legal_balls: number): {
  over_number: number;
  ball_in_over: number;
} {
  return {
    over_number: Math.floor(legal_balls / 6),
    ball_in_over: (legal_balls % 6) + 1,
  };
}

function resolveExtras(event: BallEvent): {
  batsman_runs: number;
  extra_runs: number;
  extra_type: ExtraType | null;
  is_legal_delivery: boolean;
} {
  const extra_type = event.extra_type ?? null;
  const rawBat = Math.max(0, event.batsman_runs ?? 0);
  const rawExtra = Math.max(0, event.extra_runs ?? 0);

  switch (extra_type) {
    case "wide":
      // Wides are never off the bat; extras include the mandatory 1.
      return {
        batsman_runs: 0,
        extra_runs: Math.max(1, rawExtra || 1),
        extra_type,
        is_legal_delivery: false,
      };
    case "no_ball":
      // No-ball: 1+ extras; bat runs still count separately.
      return {
        batsman_runs: rawBat,
        extra_runs: Math.max(1, rawExtra || 1),
        extra_type,
        is_legal_delivery: false,
      };
    case "bye":
    case "leg_bye":
      return {
        batsman_runs: 0,
        extra_runs: rawExtra > 0 ? rawExtra : rawBat,
        extra_type,
        is_legal_delivery: true,
      };
    case "penalty":
      return {
        batsman_runs: 0,
        extra_runs: rawExtra > 0 ? rawExtra : rawBat,
        extra_type,
        is_legal_delivery: false,
      };
    default:
      return {
        batsman_runs: rawBat,
        extra_runs: 0,
        extra_type: null,
        is_legal_delivery: true,
      };
  }
}

/**
 * Runs that rotate strike (penalty run from wide/NB does not).
 * Bye / leg-bye: all extras. Wide: extras − 1. No-ball: bat + (extras − 1).
 */
function strikeRotationRuns(
  batsman_runs: number,
  extra_runs: number,
  extra_type: ExtraType | null,
): number {
  switch (extra_type) {
    case "wide":
      return Math.max(0, extra_runs - 1);
    case "no_ball":
      return batsman_runs + Math.max(0, extra_runs - 1);
    case "bye":
    case "leg_bye":
      return extra_runs;
    case "penalty":
      return 0;
    default:
      return batsman_runs;
  }
}

function wicketAllowedOnFreeHit(wicket_type: WicketType | null): boolean {
  // Only run-out (of either end) is allowed on a free hit.
  return wicket_type === "run_out";
}

function countsAsTeamWicket(wicket_type: WicketType): boolean {
  // retired_hurt is not a team wicket; batter may return later.
  return wicket_type !== "retired_hurt";
}

function isInningsComplete(state: InningsState): boolean {
  if (state.wickets >= maxWickets(state)) return true;
  if (state.legal_balls >= state.overs_per_innings * 6) return true;
  if (state.target_runs != null && state.total_runs >= state.target_runs) {
    return true;
  }
  return false;
}

function replaceDismissed(
  state: InningsState,
  dismissed_player_id: string | null,
  new_batter_id: string | null | undefined,
): void {
  if (!dismissed_player_id) return;
  const replacement = new_batter_id ?? null;
  if (state.striker_id === dismissed_player_id) {
    state.striker_id = replacement;
  } else if (state.non_striker_id === dismissed_player_id) {
    state.non_striker_id = replacement;
  }
}

/**
 * Apply one ball (or penalty) to innings state. Pure and deterministic.
 */
export function applyBall(
  state: InningsState,
  event: BallEvent,
): ApplyBallResult {
  if (state.status === "completed") {
    throw new Error("Cannot apply ball: innings is completed");
  }

  const next = cloneState(state);
  if (next.status === "not_started") {
    next.status = "in_progress";
  }

  const is_free_hit = next.free_hit;
  const { batsman_runs, extra_runs, extra_type, is_legal_delivery } =
    resolveExtras(event);

  let is_wicket = Boolean(event.is_wicket);
  let wicket_type: WicketType | null = event.wicket_type ?? null;
  let dismissed_player_id = event.dismissed_player_id ?? null;

  if (is_wicket && !wicket_type) {
    throw new Error("wicket_type is required when is_wicket is true");
  }

  if (is_free_hit && is_wicket && !wicketAllowedOnFreeHit(wicket_type)) {
    is_wicket = false;
    wicket_type = null;
    dismissed_player_id = null;
  }

  // Default dismissal to striker when not specified.
  if (is_wicket && !dismissed_player_id) {
    dismissed_player_id = next.striker_id;
  }

  const total_runs = batsman_runs + extra_runs;
  const { over_number, ball_in_over } = deliverySlot(next.legal_balls);

  const ball: BallRecord = {
    sequence_no: next.ball_count + 1,
    over_number,
    ball_in_over,
    striker_id: next.striker_id,
    non_striker_id: next.non_striker_id,
    bowler_id: event.bowler_id ?? next.bowler_id,
    batsman_runs,
    extra_runs,
    total_runs,
    is_legal_delivery,
    extra_type,
    is_wicket,
    wicket_type,
    dismissed_player_id: is_wicket ? dismissed_player_id : null,
    free_hit_next: false,
    is_free_hit,
  };

  next.total_runs += total_runs;
  next.ball_count += 1;

  if (is_legal_delivery) {
    next.legal_balls += 1;
  }

  // Free hit: consumed by the next legal delivery; another NB/wide renews it.
  if (extra_type === "no_ball") {
    next.free_hit = true;
    ball.free_hit_next = true;
  } else if (is_legal_delivery) {
    next.free_hit = false;
  }
  // Illegal non-NB (wide / penalty): free-hit flag unchanged until a legal ball.

  const rotation = strikeRotationRuns(batsman_runs, extra_runs, extra_type);
  if (rotation % 2 === 1) {
    swapStrike(next);
  }

  if (event.batters_crossed) {
    swapStrike(next);
  }

  if (is_wicket && wicket_type) {
    if (countsAsTeamWicket(wicket_type)) {
      next.wickets += 1;
    }
    replaceDismissed(next, dismissed_player_id, event.new_batter_id);
  }

  const endedOver =
    is_legal_delivery &&
    next.legal_balls > 0 &&
    next.legal_balls % 6 === 0;

  if (isInningsComplete(next)) {
    next.status = "completed";
  } else if (endedOver) {
    // End of over always rotates strike when the innings continues.
    swapStrike(next);
  }

  return { state: next, ball };
}

/**
 * Reverse the effects of the last applied ball.
 * `lastBall` must be the `BallRecord` returned by `applyBall`.
 */
export function undoLastBall(
  state: InningsState,
  lastBall: BallRecord,
): InningsState {
  if (state.ball_count < 1) {
    throw new Error("Cannot undo: no balls recorded");
  }
  if (lastBall.sequence_no !== state.ball_count) {
    throw new Error(
      `Cannot undo: expected sequence_no ${state.ball_count}, got ${lastBall.sequence_no}`,
    );
  }

  const next = cloneState(state);

  next.total_runs -= lastBall.total_runs;
  if (next.total_runs < 0) next.total_runs = 0;

  next.ball_count -= 1;

  if (lastBall.is_legal_delivery) {
    next.legal_balls -= 1;
    if (next.legal_balls < 0) next.legal_balls = 0;
  }

  if (
    lastBall.is_wicket &&
    lastBall.wicket_type &&
    countsAsTeamWicket(lastBall.wicket_type)
  ) {
    next.wickets -= 1;
    if (next.wickets < 0) next.wickets = 0;
  }

  // Restore batter ends to positions at the moment of the delivery.
  next.striker_id = lastBall.striker_id;
  next.non_striker_id = lastBall.non_striker_id;
  next.bowler_id = lastBall.bowler_id;

  // Free-hit flag as it was before this ball.
  next.free_hit = lastBall.is_free_hit;

  // Recompute status from restored totals.
  if (next.ball_count === 0 && next.legal_balls === 0 && next.total_runs === 0) {
    next.status = "not_started";
  } else if (isInningsComplete(next)) {
    next.status = "completed";
  } else {
    next.status = "in_progress";
  }

  return next;
}
