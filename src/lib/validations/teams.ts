import { z } from "zod";
import { SQUAD_SIZE_MAX } from "@/lib/constants";

export const playerRoleSchema = z.enum([
  "batsman",
  "bowler",
  "all_rounder",
  "wicket_keeper",
]);

export const createTournamentPlayerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  mobile_number: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional()
    .nullable(),
  role: playerRoleSchema.default("batsman"),
  batting_style: z.string().trim().max(40).optional().nullable(),
  bowling_style: z.string().trim().max(40).optional().nullable(),
});

/** Admin creates a team shell and assigns a captain (manager_id). */
export const adminCreateTeamSchema = z.object({
  name: z.string().trim().min(2).max(60),
  short_name: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .transform((v) => v.toUpperCase()),
  captain_id: z.string().uuid("Select a captain."),
});

/** Verified player requests to become a team owner. Team is created only after admin approval. */
export const playerCreateTeamSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const ownerRequestDecisionSchema = z.object({
  action: z.literal("owner_request"),
  request_id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  rejection_reason: z.string().trim().max(200).optional(),
});

export const setTeamRosterSchema = z.object({
  members: z
    .array(
      z.object({
        player_id: z.string().uuid(),
        jersey_number: z.number().int().min(0).max(999).nullable().optional(),
      }),
    )
    .min(1)
    .max(SQUAD_SIZE_MAX),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  short_name: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const adminUpdateTeamSchema = updateTeamSchema.extend({
  action: z.literal("update"),
  team_id: z.string().uuid(),
  captain_id: z.string().uuid().optional(),
});

export const adminDeleteTeamSchema = z.object({
  action: z.literal("delete"),
  team_id: z.string().uuid(),
});

export const teamDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});
