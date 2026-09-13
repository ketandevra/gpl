import { adminRest } from "@/lib/supabase/rest";
import {
  hashIp,
  LOCKOUT_MINUTES,
  lockoutUntil,
  MAX_FAILED_ATTEMPTS,
} from "@/lib/auth/crypto";

const IP_WINDOW_MINUTES = 60;
const IP_MAX_FAILURES = 20;

export async function recordLoginAttempt(params: {
  mobileNumber: string;
  success: boolean;
  ip?: string | null;
}): Promise<void> {
  await adminRest("login_attempts", {
    method: "POST",
    prefer: "return=minimal",
    body: [
      {
        mobile_number: params.mobileNumber,
        success: params.success,
        ip_hash: hashIp(params.ip ?? null),
      },
    ],
  });
}

export async function isIpRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const since = new Date(
    Date.now() - IP_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const ipHash = hashIp(ip);
  if (!ipHash) return false;

  const rows = await adminRest<Array<{ id: string }>>("login_attempts", {
    query: `?ip_hash=eq.${encodeURIComponent(ipHash)}&success=eq.false&created_at=gte.${encodeURIComponent(since)}&select=id`,
  });

  return rows.length >= IP_MAX_FAILURES;
}

export async function registerFailedLogin(userId: string): Promise<{
  locked: boolean;
  attempts: number;
}> {
  const users = await adminRest<Array<{ failed_login_attempts: number }>>(
    "users",
    {
      query: `?id=eq.${encodeURIComponent(userId)}&select=failed_login_attempts`,
    },
  );

  const attempts = Number(users[0]?.failed_login_attempts ?? 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;

  await adminRest("users", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(userId)}`,
    prefer: "return=minimal",
    body: {
      failed_login_attempts: attempts,
      locked_until: locked ? lockoutUntil().toISOString() : null,
    },
  });

  return { locked, attempts };
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await adminRest("users", {
    method: "PATCH",
    query: `?id=eq.${encodeURIComponent(userId)}`,
    prefer: "return=minimal",
    body: {
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    },
  });
}

export function lockMessage(): string {
  return `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`;
}
