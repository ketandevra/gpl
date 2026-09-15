import type { PlayerRole, TeamRegistrationStatus } from "@/lib/types/database";
import type { PlayerRow, TeamPlayerView } from "@/lib/teams/types";

export function formatPlayerLabel(
  player: Pick<PlayerRow, "public_code" | "name">,
) {
  return `${player.public_code} — ${player.name}`;
}

export function playerRoleLabel(role: PlayerRole): string {
  switch (role) {
    case "batsman":
      return "Batsman";
    case "bowler":
      return "Bowler";
    case "all_rounder":
      return "All-rounder";
    case "wicket_keeper":
      return "Wicket-keeper";
    default:
      return role;
  }
}

export function teamStatusLabel(status: TeamRegistrationStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending approval";
    case "rejected":
      return "Rejected";
    case "draft":
      return "Draft";
    default:
      return status;
  }
}

export function shortNameFromTeamName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, "")[0] ?? "")
    .join("")
    .toUpperCase();
  if (initials.length >= 2 && initials.length <= 6) return initials;
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact.length >= 2) return compact.slice(0, 6);
  return (compact + "XX").slice(0, 2);
}

export function playerAvailabilityLabel(player: TeamPlayerView): string {
  if (player.locked_team_id) {
    return player.locked_team_name
      ? `Already in approved team: ${player.locked_team_name}`
      : "Already in approved team";
  }
  if (player.pending_other_team_names.length) {
    return `Also selected by pending: ${player.pending_other_team_names.join(", ")}`;
  }
  return "Available";
}
