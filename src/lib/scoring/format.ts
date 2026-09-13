/**
 * Display / rate helpers derived from legal balls (matches SQL
 * `legal_balls_to_overs`).
 */

/** Format legal balls as cricket overs, e.g. 13 → `"2.1"`. */
export function oversFromLegalBalls(legal_balls: number): string {
  const safe = Math.max(0, Math.floor(legal_balls));
  const overs = Math.floor(safe / 6);
  const balls = safe % 6;
  return `${overs}.${balls}`;
}

/**
 * Runs per over from legal balls.
 * Returns 0 when no legal ball has been bowled.
 */
export function runRate(total_runs: number, legal_balls: number): number {
  if (legal_balls <= 0) return 0;
  return (total_runs * 6) / legal_balls;
}

/**
 * Required run rate for a chase.
 * `runs_needed` should already be (target − current), and
 * `balls_remaining` the legal balls left in the innings.
 */
export function requiredRunRate(
  runs_needed: number,
  balls_remaining: number,
): number {
  if (balls_remaining <= 0) return runs_needed > 0 ? Infinity : 0;
  if (runs_needed <= 0) return 0;
  return (runs_needed * 6) / balls_remaining;
}
