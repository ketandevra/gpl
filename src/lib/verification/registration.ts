import type { PlayerRole } from "@/lib/types/database";

export type TshirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";

/** Roles offered on Register as player (not wicket-keeper). */
export const REGISTRATION_PLAYER_ROLES: Array<{
  value: PlayerRole;
  label: string;
}> = [
  { value: "batsman", label: "Batsman" },
  { value: "bowler", label: "Bowler" },
  { value: "all_rounder", label: "All-rounder" },
];

export const TSHIRT_SIZES: TshirtSize[] = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
];

export function isRegistrationPlayerRole(value: string): value is PlayerRole {
  return REGISTRATION_PLAYER_ROLES.some((r) => r.value === value);
}

export function isTshirtSize(value: string): value is TshirtSize {
  return (TSHIRT_SIZES as string[]).includes(value);
}
