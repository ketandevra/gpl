export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
/** Stay signed in until the user logs out. */
export const SESSION_TTL_DAYS = 3650;
export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? "gpl_session";

export function sessionExpiryDate(from = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}
