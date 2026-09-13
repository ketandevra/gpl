/** Schema-aligned scoring types (see innings / balls / enums in migrations). */

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | "penalty";

export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket"
  | "retired_hurt"
  | "retired_out";

export type InningsStatus = "not_started" | "in_progress" | "completed";

/**
 * Live innings snapshot used by the pure scoring engine.
 * Field names match `innings` (+ match overs + free-hit flag).
 */
export interface InningsState {
  total_runs: number;
  wickets: number;
  legal_balls: number;
  target_runs: number | null;
  status: InningsStatus;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
  /** From `matches.overs_per_innings`. */
  overs_per_innings: number;
  /** Next delivery is a free hit (after a no-ball). */
  free_hit: boolean;
  /** Balls recorded so far; next ball gets `ball_count + 1` as sequence_no. */
  ball_count: number;
  /** Defaults to 10 when omitted. */
  max_wickets?: number;
}

/**
 * Input event for one delivery / penalty award.
 * Maps onto `balls` columns after `applyBall`.
 */
export interface BallEvent {
  /** Runs off the bat (0–6 typical). Ignored for bye / leg_bye / wide / penalty. */
  batsman_runs?: number;
  extra_type?: ExtraType | null;
  /**
   * Extra runs recorded on the ball.
   * - wide / no_ball: total extras including the mandatory 1 (defaults to 1)
   * - bye / leg_bye / penalty: full extra count
   */
  extra_runs?: number;
  is_wicket?: boolean;
  wicket_type?: WicketType | null;
  dismissed_player_id?: string | null;
  /** Replacement batter at the dismissed end (optional until selected). */
  new_batter_id?: string | null;
  /**
   * Batsmen crossed before a catch/run-out completion.
   * When true, ends are swapped before placing the new batter.
   */
  batters_crossed?: boolean;
  /** Override bowler for this ball (else state.bowler_id). */
  bowler_id?: string | null;
}

/** Persisted-shape ball produced by the engine (matches `balls` + undo helpers). */
export interface BallRecord {
  sequence_no: number;
  over_number: number;
  ball_in_over: number;
  striker_id: string | null;
  non_striker_id: string | null;
  bowler_id: string | null;
  batsman_runs: number;
  extra_runs: number;
  total_runs: number;
  is_legal_delivery: boolean;
  extra_type: ExtraType | null;
  is_wicket: boolean;
  wicket_type: WicketType | null;
  dismissed_player_id: string | null;
  free_hit_next: boolean;
  /** Engine-only: whether this delivery was itself a free hit (for undo). */
  is_free_hit: boolean;
}

export interface ApplyBallResult {
  state: InningsState;
  ball: BallRecord;
}
