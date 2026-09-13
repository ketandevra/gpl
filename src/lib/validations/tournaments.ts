import { z } from "zod";

export const createTournamentSchema = z.object({
  name: z.string().trim().min(2, "Tournament name is required.").max(120),
  short_name: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  location: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional()
    .nullable(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional()
    .nullable(),
  registration_open: z.boolean().optional().default(true),
  status: z.enum(["upcoming", "ongoing", "completed"]).optional().default("upcoming"),
  is_active: z.boolean().optional().default(true),
});

export const updateTournamentSchema = z.object({
  tournament_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  short_name: z.string().trim().max(12).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  registration_open: z.boolean().optional(),
  status: z.enum(["upcoming", "ongoing", "completed"]).optional(),
  is_active: z.boolean().optional(),
});
