export const APP_NAME = "Ghanchi Premier League";
export const APP_SHORT_NAME = "GPL";
export const LOGO_PATH = "/brand/gpl-logo.png";

/** Last date/time to submit a team and entry fees (IST). */
export const TEAM_ENTRY_DEADLINE_ISO = "2026-10-25T17:00:00+05:30";
export const TEAM_ENTRY_DEADLINE_LABEL = "25 Oct 2026 · 5:00 PM";

/** Default / fallback squad size when app_settings is unavailable. */
export const DEFAULT_SQUAD_SIZE = 6;
export const SQUAD_SIZE_MIN = 2;
export const SQUAD_SIZE_MAX = 15;

/** Full desktop/site navigation */
export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/live", label: "Live" },
  { href: "/tournaments", label: "Tournament" },
  { href: "/players", label: "Players" },
  { href: "/stats", label: "Stats" },
  { href: "/profile", label: "Profile" },
] as const;

/**
 * Primary bottom tabs for phones — Home, Tournament, Players, Profile.
 */
export const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/tournaments", label: "Tournament", icon: "tournament" },
  { href: "/players", label: "Players", icon: "players" },
  { href: "/profile", label: "Profile", icon: "profile" },
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
