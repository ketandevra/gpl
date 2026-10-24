import { z } from "zod";

export const fixtureActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_config"),
    tournament_id: z.string().uuid(),
    team_ids: z.array(z.string().uuid()).min(2, "Select at least 2 teams."),
    min_league_matches: z.number().int().min(1).max(32).default(2),
    knockout_qualifiers: z.union([
      z.literal(2),
      z.literal(4),
      z.literal(8),
      z.literal(16),
    ]),
    league_method: z.enum(["minimum", "round_robin"]).default("minimum"),
  }),
  z.object({
    action: z.literal("draw_team"),
    tournament_id: z.string().uuid(),
    team_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("undraw_position"),
    tournament_id: z.string().uuid(),
    draw_position: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("confirm_draw"),
    tournament_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("unlock_draw"),
    tournament_id: z.string().uuid(),
    confirm: z.literal(true),
  }),
  z.object({
    action: z.literal("preview_league"),
    tournament_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("confirm_league"),
    tournament_id: z.string().uuid(),
    replace_scheduled: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal("complete_league"),
    tournament_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("preview_knockout"),
    tournament_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("confirm_knockout"),
    tournament_id: z.string().uuid(),
    replace_scheduled: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal("reset_knockout"),
    tournament_id: z.string().uuid(),
    confirm: z.literal(true),
  }),
  z.object({
    action: z.literal("reset_fixtures"),
    tournament_id: z.string().uuid(),
    confirm: z.literal(true),
  }),
]);

export type FixtureAction = z.infer<typeof fixtureActionSchema>;
