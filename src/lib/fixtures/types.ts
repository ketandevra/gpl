import type { MatchStatus, MatchType } from "@/lib/types/database";

export const KNOCKOUT_QUALIFIER_OPTIONS = [2, 4, 8, 16] as const;
export type KnockoutQualifierCount = (typeof KNOCKOUT_QUALIFIER_OPTIONS)[number];

export const LEAGUE_METHODS = ["minimum", "round_robin"] as const;
export type LeagueMethod = (typeof LEAGUE_METHODS)[number];

export const TOURNAMENT_FORMATS = ["league_knockout"] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const DRAW_STATUSES = ["pending", "in_progress", "confirmed"] as const;
export type DrawStatus = (typeof DRAW_STATUSES)[number];

export const TOURNAMENT_STAGES = [
  "setup",
  "draw",
  "league",
  "knockout",
  "completed",
] as const;
export type TournamentStage = (typeof TOURNAMENT_STAGES)[number];

export const FIXTURE_STAGES = ["league", "knockout"] as const;
export type FixtureStage = (typeof FIXTURE_STAGES)[number];

export const KNOCKOUT_MATCH_TYPES = [
  "prelim",
  "last16",
  "quarter",
  "semi",
  "final",
] as const;
export type KnockoutMatchType = (typeof KNOCKOUT_MATCH_TYPES)[number];

export type DrawTeam = {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  draw_position: number;
};

export type LeaguePair = {
  team_a_id: string;
  team_b_id: string;
};

export type LeagueRoundPreview = {
  round_number: number;
  pairs: LeaguePair[];
  byes: string[];
};

export type LeagueFixturePreview = {
  match_number: number;
  round_number: number;
  team_a_id: string;
  team_b_id: string;
  team_a_name: string;
  team_b_name: string;
  status: "scheduled";
};

export type TeamMatchCount = {
  team_id: string;
  team_name: string;
  matches: number;
  opponents: string[];
  byes: number;
};

export type LeaguePreview = {
  method: LeagueMethod;
  min_matches: number;
  team_count: number;
  rounds: LeagueRoundPreview[];
  fixtures: LeagueFixturePreview[];
  total_matches: number;
  team_counts: TeamMatchCount[];
  bye_rounds: { round_number: number; team_id: string; team_name: string }[];
  duplicate_pairings: number;
  valid: boolean;
  errors: string[];
};

export type KnockoutSlotPreview = {
  slot_key: string;
  team_id: string | null;
  team_name: string | null;
  source: "seed" | "bye" | "winner";
  source_match_key: string | null;
};

export type KnockoutMatchPreview = {
  knockout_key: string;
  feeds_key: string | null;
  round_number: number;
  match_number: number;
  round_name: string;
  match_type: MatchType;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
  playable: boolean;
};

export type KnockoutPreview = {
  qualifier_count: number;
  bracket_size: number;
  bye_count: number;
  rounds: {
    round_number: number;
    name: string;
    match_type: MatchType;
    matches: KnockoutMatchPreview[];
  }[];
  playable_matches: KnockoutMatchPreview[];
  slots: KnockoutSlotPreview[];
  seeded: { team_id: string; team_name: string; seed: number }[];
};

export type EligibilityIssue = {
  code: string;
  message: string;
};

export type TeamEligibility = {
  team_id: string;
  team_name: string;
  completed_matches: number;
  required_matches: number;
  distinct_opponents: number;
  remaining_matches: number;
  ok: boolean;
};

export type EligibilityReport = {
  ok: boolean;
  issues: EligibilityIssue[];
  teams: TeamEligibility[];
  draw_confirmed: boolean;
  league_fixtures_confirmed: boolean;
  league_stage_completed: boolean;
  pending_league_matches: number;
  qualifier_count: number;
};

export type UnlockImpact = {
  scheduled_league: number;
  started_or_completed_league: number;
  knockout_matches: number;
  can_unlock: boolean;
  message: string;
};

export type GeneratedMatchInsert = {
  team_a_id: string;
  team_b_id: string;
  match_type: MatchType;
  stage: FixtureStage;
  round_number: number;
  match_number: number;
  scheduled_at?: string | null;
  venue?: string | null;
  overs_per_innings?: number;
  knockout_key?: string | null;
  feeds_key?: string | null;
};

export type FixtureMatchStatus = MatchStatus;
