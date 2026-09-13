import { createHash, randomBytes } from "crypto";
import { LOCKOUT_MINUTES, SESSION_TTL_DAYS } from "@/lib/auth/constants";

export {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
  SESSION_TTL_DAYS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export function sessionExpiryDate(from = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires;
}

export function lockoutUntil(from = new Date()): Date {
  return new Date(from.getTime() + LOCKOUT_MINUTES * 60 * 1000);
}
