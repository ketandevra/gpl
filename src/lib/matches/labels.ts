import type { MatchStatus } from "@/lib/types/database";

export const LIVE_MATCH_STATUSES: MatchStatus[] = ["live", "innings_break"];

export function matchStatusLabel(status: MatchStatus): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "live":
      return "Live";
    case "innings_break":
      return "Innings break";
    case "completed":
      return "Completed";
    case "abandoned":
      return "Abandoned";
    default:
      return status;
  }
}

export function formatMatchWhen(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
