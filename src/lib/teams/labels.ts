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
