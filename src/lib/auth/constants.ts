export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 7);
export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? "gpl_session";
