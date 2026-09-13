import { cookies } from "next/headers";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import type { UserRole, VerificationStatus } from "@/lib/types/database";
import {
  generateSessionToken,
  hashIp,
  hashToken,
  SESSION_COOKIE_NAME,
  sessionExpiryDate,
} from "@/lib/auth/crypto";
import type { SessionUser } from "@/lib/auth/permissions";

type DbUser = {
  id: string;
  name: string;
  mobile_number: string;
  role: UserRole;
  is_active: boolean;
  verification_status: VerificationStatus;
  avatar_url: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
};

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function createSession(params: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = sessionExpiryDate();

  await withRetry(() =>
    adminRest("sessions", {
      method: "POST",
      prefer: "return=minimal",
      body: [
        {
          user_id: params.userId,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          user_agent: params.userAgent ?? null,
          ip_hash: hashIp(params.ip ?? null),
        },
      ],
    }),
  );

  return { token, expiresAt };
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
}

export async function destroySessionByToken(
  token: string | undefined | null,
): Promise<void> {
  if (!token || !isSupabaseAdminConfigured()) return;
  await adminRest("sessions", {
    method: "DELETE",
    query: `?token_hash=eq.${encodeURIComponent(hashToken(token))}`,
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const token = await getSessionToken();
  if (!token) return null;

  try {
    const tokenHash = hashToken(token);
    const nowIso = new Date().toISOString();

    const sessions = await withRetry(() =>
      adminRest<SessionRow[]>("sessions", {
        query: `?token_hash=eq.${encodeURIComponent(tokenHash)}&expires_at=gt.${encodeURIComponent(nowIso)}&select=id,user_id,expires_at`,
      }),
    );

    const session = sessions[0];
    if (!session) return null;

    const users = await withRetry(() =>
      adminRest<DbUser[]>("users", {
        query: `?id=eq.${encodeURIComponent(session.user_id)}&select=id,name,mobile_number,role,is_active,verification_status,avatar_url`,
      }),
    );

    const dbUser = users[0];
    if (!dbUser || !dbUser.is_active) {
      if (dbUser && !dbUser.is_active) {
        await destroySessionByToken(token);
      }
      return null;
    }

    void adminRest("sessions", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(session.id)}`,
      body: { last_seen_at: nowIso },
      prefer: "return=minimal",
    }).catch(() => undefined);

    return {
      id: dbUser.id,
      name: dbUser.name,
      mobile_number: dbUser.mobile_number,
      role: dbUser.role,
      is_active: dbUser.is_active,
      verification_status: dbUser.verification_status ?? "unverified",
      avatar_url: dbUser.avatar_url ?? null,
    };
  } catch (err) {
    console.error("[auth] getCurrentUser failed:", err);
    return null;
  }
}

export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip");
}
