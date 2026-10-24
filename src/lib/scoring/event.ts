import type { BallEvent, ExtraType, WicketType } from "./types";

export type FieldingExtra = "bye" | "leg_bye";

/** CricHeroes tap: Wide/NB + N, or Bye + N, or bat N. */
export type CricHeroesBallInput = {
  /** Number tapped on the pad (0–7). */
  runs?: number;
  extra_type?: ExtraType | null;
  /**
   * No-ball + bye / leg-bye (CricHeroes combo).
   * Additional tapped runs are fielding extras, not bat runs.
   */
  secondary_extra_type?: FieldingExtra | null;
  /** If set, treated as total extras including the Wide/NB penalty. */
  extra_runs?: number;
  is_wicket?: boolean;
  wicket_type?: WicketType | null;
  dismissed_player_id?: string | null;
  new_batter_id?: string | null;
  batters_crossed?: boolean;
  bowler_id?: string | null;
};

/**
 * Map a CricHeroes scoring tap to an engine event.
 *
 * Wide + N  → 1 wide penalty + N extra runs (all wides, not off the bat)
 * No ball + N → 1 no-ball + N off the bat
 * No ball + Bye/LB + N → 1 no-ball + N fielding extras
 * Bye / LB + N → N extras, legal ball
 */
export function cricheroesBallEvent(input: CricHeroesBallInput): BallEvent {
  const extra = input.extra_type ?? null;
  const secondary = input.secondary_extra_type ?? null;
  const tapped = Math.max(0, input.runs ?? 0);
  const fieldingOnNoBall =
    extra === "no_ball" && (secondary === "bye" || secondary === "leg_bye");

  let batsman_runs = 0;
  let extra_runs = input.extra_runs;

  if (extra === "wide") {
    batsman_runs = 0;
    extra_runs = extra_runs ?? 1 + tapped;
  } else if (extra === "no_ball" && fieldingOnNoBall) {
    batsman_runs = 0;
    extra_runs = extra_runs ?? 1 + tapped;
  } else if (extra === "no_ball") {
    batsman_runs = tapped;
    extra_runs = extra_runs ?? 1;
  } else if (extra === "bye" || extra === "leg_bye" || extra === "penalty") {
    batsman_runs = 0;
    extra_runs = extra_runs ?? tapped;
  } else {
    batsman_runs = tapped;
    extra_runs = extra_runs ?? 0;
  }

  return {
    batsman_runs,
    extra_type: extra,
    extra_runs,
    secondary_extra_type: fieldingOnNoBall ? secondary : null,
    is_wicket: input.is_wicket,
    wicket_type: input.wicket_type,
    dismissed_player_id: input.dismissed_player_id,
    new_batter_id: input.new_batter_id,
    batters_crossed: input.batters_crossed,
    bowler_id: input.bowler_id,
  };
}

/** Runs charged to the bowler (CricHeroes / MCC extras). */
export function runsAgainstBowler(ball: {
  batsman_runs: number;
  extra_runs: number;
  extra_type: ExtraType | string | null;
}): number {
  if (ball.extra_type === "wide") return ball.extra_runs;
  if (ball.extra_type === "no_ball") return 1 + ball.batsman_runs;
  if (
    ball.extra_type === "bye" ||
    ball.extra_type === "leg_bye" ||
    ball.extra_type === "penalty"
  ) {
    return 0;
  }
  return ball.batsman_runs;
}

export function wicketAllowedOnDelivery(params: {
  extra_type: ExtraType | null;
  is_free_hit: boolean;
  wicket_type: WicketType | null;
}): boolean {
  const { extra_type, is_free_hit, wicket_type } = params;
  if (!wicket_type) return false;
  if (wicket_type === "retired_hurt" || wicket_type === "retired_out") {
    return true;
  }
  if (extra_type === "wide") {
    return (
      wicket_type === "run_out" ||
      wicket_type === "stumped" ||
      wicket_type === "hit_wicket"
    );
  }
  if (extra_type === "no_ball" || is_free_hit) {
    return wicket_type === "run_out";
  }
  return true;
}
