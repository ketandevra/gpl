import type {
  MatchStatus,
  MatchType,
  TossDecision,
} from "@/lib/types/database";

export type MatchRow = {
  id: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  scheduled_at: string | null;
  venue: string | null;
  match_type: MatchType;
  overs_per_innings: number;
  status: MatchStatus;
  toss_winner_id: string | null;
  toss_decision: TossDecision | null;
  winner_team_id: string | null;
  result_text: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamBrief = {
  id: string;
  name: string;
  short_name: string;
};

export type MatchView = MatchRow & {
  team_a: TeamBrief | null;
  team_b: TeamBrief | null;
  toss_winner: TeamBrief | null;
  winner: TeamBrief | null;
};

export type InningsBrief = {
  id: string;
  match_id: string;
  batting_team_id: string;
  bowling_team_id: string;
  innings_number: number;
  total_runs: number;
  wickets: number;
  legal_balls: number;
  target_runs: number | null;
  status: string;
};
