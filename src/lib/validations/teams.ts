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

export const teamDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});
