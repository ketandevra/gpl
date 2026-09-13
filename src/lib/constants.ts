export const APP_NAME = "Ghanchi Premier League";
export const APP_SHORT_NAME = "GPL";
export const LOGO_PATH = "/brand/gpl-logo.jpg";

/** Default / fallback squad size when app_settings is unavailable. */
export const DEFAULT_SQUAD_SIZE = 6;
export const SQUAD_SIZE_MIN = 2;
export const SQUAD_SIZE_MAX = 15;

/** Full desktop/site navigation */
export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/live", label: "Live" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/stats", label: "Stats" },
  { href: "/profile", label: "Profile" },
] as const;

/**
 * Primary bottom tabs for phones — max 5 for thumb reach.
 * Secondary destinations stay in header overflow / profile later.
 */
export const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/live", label: "Live", icon: "live" },
  { href: "/matches", label: "Matches", icon: "matches" },
  { href: "/teams", label: "Teams", icon: "teams" },
  { href: "/stats", label: "Stats", icon: "stats" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/scoring", label: "Scoring" },
  { href: "/admin/settings", label: "Settings" },
] as const;
