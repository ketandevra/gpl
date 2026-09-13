import { z } from "zod";

export const startInningsSchema = z.object({
  batting_team_id: z.string().uuid(),
  striker_id: z.string().uuid(),
  non_striker_id: z.string().uuid(),
  bowler_id: z.string().uuid(),
});

export const setPlayersSchema = z.object({
  striker_id: z.string().uuid().optional(),
  non_striker_id: z.string().uuid().optional(),
  bowler_id: z.string().uuid().nullable().optional(),
});

export const recordBallSchema = z.object({
  batsman_runs: z.number().int().min(0).max(6).optional().default(0),
  extra_type: z
    .enum(["wide", "no_ball", "bye", "leg_bye", "penalty"])
    .nullable()
    .optional()
    .default(null),
  /** Total extras on the ball (wide/NB include the mandatory 1). */
  extra_runs: z.number().int().min(0).max(8).optional(),
  is_wicket: z.boolean().optional().default(false),
  wicket_type: z
    .enum([
      "bowled",
      "caught",
      "lbw",
      "run_out",
      "stumped",
      "hit_wicket",
      "retired_hurt",
      "retired_out",
    ])
    .nullable()
    .optional(),
  dismissed_player_id: z.string().uuid().nullable().optional(),
  new_batsman_id: z.string().uuid().nullable().optional(),
  commentary: z.string().max(280).nullable().optional(),
});

export type StartInningsInput = z.infer<typeof startInningsSchema>;
export type SetPlayersInput = z.infer<typeof setPlayersSchema>;
export type RecordBallInput = z.infer<typeof recordBallSchema>;
