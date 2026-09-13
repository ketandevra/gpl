import { hashPin, verifyPin } from "@/lib/auth/pin";
import {
  clearFailedLogins,
  isIpRateLimited,
  lockMessage,
  recordLoginAttempt,
  registerFailedLogin,
} from "@/lib/auth/rate-limit";
import { createSession, getRequestIp } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { adminRest, RestError, withRetry } from "@/lib/supabase/rest";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { LoginInput, RegisterInput } from "@/lib/validations/auth";
import type { UserRole } from "@/lib/types/database";

export type AuthSuccess = {
  ok: true;
  user: { id: string; name: string; role: UserRole };
  session: { token: string; expiresAt: Date };
};

export type AuthFailure = {
  ok: false;
  error: string;
  status: number;
};

export type AuthResult = AuthSuccess | AuthFailure;

type UserAuthRow = {
  id: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  pin_hash: string;
  failed_login_attempts: number;
  locked_until: string | null;
};

function requireSupabase(): AuthFailure | null {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error:
        "Authentication is not configured yet. Add Supabase keys to .env.local.",
      status: 503,
    };
  }
  return null;
}

function friendlyDbError(err: unknown): AuthFailure {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[auth] database error:", message);
  if (/timeout|504|502|503|fetch failed/i.test(message)) {
    return {
      ok: false,
      error:
        "Cannot reach the database right now. Check your internet connection and that the Supabase project is not paused, then try again.",
      status: 503,
    };
  }
  return { ok: false, error: "Unable to sign in right now.", status: 500 };
}

export async function loginWithPin(
  input: LoginInput,
  request: Request,
): Promise<AuthResult> {
  const missing = requireSupabase();
  if (missing) return missing;

  const ip = getRequestIp(request);

  try {
    if (await isIpRateLimited(ip)) {
      return {
        ok: false,
        error: "Too many login attempts from this network. Please try later.",
        status: 429,
      };
    }
  } catch (err) {
    console.error("[auth] rate limit check failed:", err);
    return {
      ok: false,
      error: "Unable to sign in right now. Please try again shortly.",
      status: 503,
    };
  }

  let users: UserAuthRow[];
  try {
    users = await withRetry(() =>
      adminRest<UserAuthRow[]>("users", {
        query: `?mobile_number=eq.${encodeURIComponent(input.mobile_number)}&select=id,name,role,is_active,pin_hash,failed_login_attempts,locked_until`,
      }),
    );
  } catch (err) {
    return friendlyDbError(err);
  }

  const user = users[0];
  if (!user) {
    try {
      await recordLoginAttempt({
        mobileNumber: input.mobile_number,
        success: false,
        ip,
      });
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: "Invalid mobile number or PIN.",
      status: 401,
    };
  }

  if (!user.is_active) {
    return {
      ok: false,
      error: "This account has been disabled. Contact an admin.",
      status: 403,
    };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    try {
      await recordLoginAttempt({
        mobileNumber: input.mobile_number,
        success: false,
        ip,
      });
    } catch {
      /* ignore */
    }
    return { ok: false, error: lockMessage(), status: 423 };
  }

  const pinOk = await verifyPin(input.pin, user.pin_hash);
  if (!pinOk) {
    try {
      await recordLoginAttempt({
        mobileNumber: input.mobile_number,
        success: false,
        ip,
      });
      const { locked } = await registerFailedLogin(user.id);
      return {
        ok: false,
        error: locked ? lockMessage() : "Invalid mobile number or PIN.",
        status: locked ? 423 : 401,
      };
    } catch (err) {
      console.error("[auth] failed-login bookkeeping error:", err);
      return {
        ok: false,
        error: "Invalid mobile number or PIN.",
        status: 401,
      };
    }
  }

  try {
    await clearFailedLogins(user.id);
    await recordLoginAttempt({
      mobileNumber: input.mobile_number,
      success: true,
      ip,
    });
  } catch (err) {
    console.error("[auth] post-login bookkeeping error:", err);
  }

  let session: { token: string; expiresAt: Date };
  try {
    session = await createSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent"),
      ip,
    });
  } catch (err) {
    return friendlyDbError(err);
  }

  try {
    await writeAuditLog({
      actorId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
    });
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    session,
  };
}

export async function registerWithPin(
  input: RegisterInput,
  request: Request,
): Promise<AuthResult> {
  const missing = requireSupabase();
  if (missing) return missing;

  try {
    const settings = await withRetry(() =>
      adminRest<Array<{ user_registration_open: boolean }>>("app_settings", {
        query: "?id=eq.1&select=user_registration_open",
      }),
    );

    if (!settings[0]?.user_registration_open) {
      return {
        ok: false,
        error: "Public registration is currently closed.",
        status: 403,
      };
    }

    const existing = await adminRest<Array<{ id: string }>>("users", {
      query: `?mobile_number=eq.${encodeURIComponent(input.mobile_number)}&select=id`,
    });
    if (existing.length > 0) {
      return {
        ok: false,
        error: "That mobile number is already registered.",
        status: 409,
      };
    }

    const pin_hash = await hashPin(input.pin);
    const created = await adminRest<
      Array<{ id: string; name: string; role: UserRole }>
    >("users", {
      method: "POST",
      prefer: "return=representation",
      body: [
        {
          name: input.name,
          mobile_number: input.mobile_number,
          pin_hash,
          role: "viewer",
          is_active: true,
        },
      ],
    });

    const user = created[0];
    if (!user) {
      return { ok: false, error: "Could not create your account.", status: 500 };
    }

    const ip = getRequestIp(request);
    const session = await createSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent"),
      ip,
    });

    await writeAuditLog({
      actorId: user.id,
      action: "auth.register",
      entityType: "user",
      entityId: user.id,
      newValue: { role: "viewer" },
    });

    return {
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      session,
    };
  } catch (err) {
    if (err instanceof RestError && err.status === 409) {
      return {
        ok: false,
        error: "That mobile number is already registered.",
        status: 409,
      };
    }
    return friendlyDbError(err);
  }
}
