import type {
  PlayerRole,
  TeamRegistrationStatus,
} from "@/lib/types/database";

export type TeamRow = {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  manager_id: string | null;
  registration_status: TeamRegistrationStatus;
  approved: boolean;
  created_at: string;
  updated_at: string;
};

/** Tournament player registry row (not team-owned). */
export type PlayerRow = {
  id: string;
  tournament_id: string;
  public_code: string;
  name: string;
  mobile_number: string | null;
  photo_url: string | null;
  role: PlayerRole;
  batting_style: string | null;
  bowling_style: string | null;
  tshirt_size: string | null;
  locked_team_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Player as seen on a team roster. */
export type TeamPlayerView = PlayerRow & {
  team_id: string;
  jersey_number: number | null;
  membership_id: string;
  locked_team_name: string | null;
  /** Other pending teams that also selected this player */
  pending_other_team_names: string[];
};

export type PlayerAvailability = {
  status: "available" | "locked" | "pending_elsewhere";
  label: string;
  locked_team_name: string | null;
  pending_other_team_names: string[];
};

export type ActiveTournament = {
  id: string;
  name: string;
  registration_open: boolean;
  status: string;
};

export type PlayerConflict = {
  player_id: string;
  public_code: string;
  name: string;
  team_id: string;
  team_name: string;
};
