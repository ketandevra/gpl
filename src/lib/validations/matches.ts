import { z } from "zod";

export const matchTypeSchema = z.enum(["league", "semi", "final", "friendly"]);
export const matchStatusSchema = z.enum([
  "scheduled",
  "live",
  "innings_break",
  "completed",
  "abandoned",
]);
export const tossDecisionSchema = z.enum(["bat", "bowl"]);

export const createMatchSchema = z
  .object({
    team_a_id: z.string().uuid(),
    team_b_id: z.string().uuid(),
    scheduled_at: z.string().min(1, "Schedule date/time is required"),
    venue: z.string().trim().min(2).max(120).optional().nullable(),
    match_type: matchTypeSchema.default("league"),
    overs_per_innings: z.number().int().min(1).max(50).default(20),
    scorer_ids: z.array(z.string().uuid()).optional().default([]),
  })
  .refine((d) => d.team_a_id !== d.team_b_id, {
    message: "Select two different teams",
    path: ["team_b_id"],
  });

export const updateMatchSchema = z
  .object({
    team_a_id: z.string().uuid().optional(),
    team_b_id: z.string().uuid().optional(),
    scheduled_at: z.string().optional().nullable(),
    venue: z.string().trim().min(2).max(120).optional().nullable(),
    match_type: matchTypeSchema.optional(),
    overs_per_innings: z.number().int().min(1).max(50).optional(),
    toss_winner_id: z.string().uuid().optional().nullable(),
    toss_decision: tossDecisionSchema.optional().nullable(),
    winner_team_id: z.string().uuid().optional().nullable(),
    result_text: z.string().trim().max(200).optional().nullable(),
    scorer_ids: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (d) =>
      !d.team_a_id || !d.team_b_id || d.team_a_id !== d.team_b_id,
    { message: "Select two different teams", path: ["team_b_id"] },
  );

export const matchActionSchema = z.object({
  action: z.enum([
    "start",
    "innings_break",
    "resume",
    "complete",
    "abandon",
  ]),
  toss_winner_id: z.string().uuid().optional().nullable(),
  toss_decision: tossDecisionSchema.optional().nullable(),
  winner_team_id: z.string().uuid().optional().nullable(),
  result_text: z.string().trim().max(200).optional().nullable(),
});
