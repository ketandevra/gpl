import { z } from "zod";

export const indianMobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export const loginSchema = z.object({
  mobile_number: indianMobileSchema,
  pin: pinSchema,
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name is too long"),
    mobile_number: indianMobileSchema,
    pin: pinSchema,
    confirm_pin: pinSchema,
  })
  .refine((data) => data.pin === data.confirm_pin, {
    message: "PINs do not match",
    path: ["confirm_pin"],
  });

export const resetPinSchema = z.object({
  user_id: z.string().uuid(),
  new_pin: pinSchema,
});

export const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "scorer", "team_manager", "viewer"]).optional(),
  is_active: z.boolean().optional(),
  name: z.string().trim().min(2).max(80).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
