export type UserRole = "admin" | "scorer" | "team_manager" | "viewer";
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";
export type TournamentStatus = "upcoming" | "ongoing" | "completed";
export type TeamRegistrationStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected";
export type TeamInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";
export type TeamOwnerRequestStatus = "pending" | "approved" | "rejected";
export type PlayerRole =
  | "batsman"
  | "bowler"
  | "all_rounder"
  | "wicket_keeper";
export type TshirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
export type MatchType = "league" | "semi" | "final" | "friendly";
export type MatchStatus =
  | "scheduled"
  | "live"
  | "innings_break"
  | "completed"
  | "abandoned";
export type TossDecision = "bat" | "bowl";
export type InningsStatus = "not_started" | "in_progress" | "completed";
export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | "penalty";
export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket"
  | "retired_hurt"
  | "retired_out";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number;
          user_registration_open: boolean;
          squad_size: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_registration_open?: boolean;
          squad_size?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          name: string;
          mobile_number: string;
          pin_hash: string;
          role: UserRole;
          is_active: boolean;
          failed_login_attempts: number;
          locked_until: string | null;
          verification_status: VerificationStatus;
          aadhaar_number: string | null;
          verification_submitted_at: string | null;
          verification_reviewed_at: string | null;
          verification_reviewed_by: string | null;
          verification_rejection_reason: string | null;
          preferred_player_role: PlayerRole | null;
          tshirt_size: TshirtSize | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          mobile_number: string;
          pin_hash: string;
          role?: UserRole;
          is_active?: boolean;
          failed_login_attempts?: number;
          locked_until?: string | null;
          verification_status?: VerificationStatus;
          aadhaar_number?: string | null;
          verification_submitted_at?: string | null;
          verification_reviewed_at?: string | null;
          verification_reviewed_by?: string | null;
          verification_rejection_reason?: string | null;
          preferred_player_role?: PlayerRole | null;
          tshirt_size?: TshirtSize | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      verification_documents: {
        Row: {
          id: string;
          user_id: string;
          doc_type: "aadhaar_front" | "aadhaar_back";
          storage_path: string;
          mime_type: string;
          file_size: number;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          doc_type: "aadhaar_front" | "aadhaar_back";
          storage_path: string;
          mime_type: string;
          file_size: number;
          uploaded_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["verification_documents"]["Insert"]
        >;
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at: string;
          last_seen_at: string;
          user_agent: string | null;
          ip_hash: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at?: string;
          last_seen_at?: string;
          user_agent?: string | null;
          ip_hash?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
      };
      login_attempts: {
        Row: {
          id: string;
          mobile_number: string;
          success: boolean;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mobile_number: string;
          success: boolean;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["login_attempts"]["Insert"]>;
      };
      tournaments: {
        Row: {
          id: string;
          name: string;
          short_name: string | null;
          location: string | null;
          start_date: string | null;
          end_date: string | null;
          registration_open: boolean;
          status: TournamentStatus;
          is_active: boolean;
          points_win: number;
          points_tie: number;
          points_nr: number;
          points_loss: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name?: string | null;
          location?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          registration_open?: boolean;
          status?: TournamentStatus;
          is_active?: boolean;
          points_win?: number;
          points_tie?: number;
          points_nr?: number;
          points_loss?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tournaments"]["Insert"]>;
      };
      teams: {
        Row: {
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
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          short_name: string;
          logo_url?: string | null;
          manager_id?: string | null;
          registration_status?: TeamRegistrationStatus;
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
      };
      players: {
        Row: {
          id: string;
          tournament_id: string;
          public_code: string;
          name: string;
          mobile_number: string | null;
          photo_url: string | null;
          role: PlayerRole;
          batting_style: string | null;
          bowling_style: string | null;
          tshirt_size: TshirtSize | null;
          locked_team_id: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          public_code: string;
          name: string;
          mobile_number?: string | null;
          photo_url?: string | null;
          role?: PlayerRole;
          batting_style?: string | null;
          bowling_style?: string | null;
          tshirt_size?: TshirtSize | null;
          locked_team_id?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
      };
      team_players: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          jersey_number: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          jersey_number?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_players"]["Insert"]>;
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          invited_by: string | null;
          status: TeamInviteStatus;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          invited_by?: string | null;
          status?: TeamInviteStatus;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["team_invites"]["Insert"]>;
      };
      team_owner_requests: {
        Row: {
          id: string;
          tournament_id: string;
          requester_id: string;
          name: string;
          status: TeamOwnerRequestStatus;
          rejection_reason: string | null;
          team_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          requester_id: string;
          name: string;
          status?: TeamOwnerRequestStatus;
          rejection_reason?: string | null;
          team_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["team_owner_requests"]["Insert"]
        >;
      };
      matches: {
        Row: {
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
        Insert: {
          id?: string;
          tournament_id: string;
          team_a_id: string;
          team_b_id: string;
          scheduled_at?: string | null;
          venue?: string | null;
          match_type?: MatchType;
          overs_per_innings?: number;
          status?: MatchStatus;
          toss_winner_id?: string | null;
          toss_decision?: TossDecision | null;
          winner_team_id?: string | null;
          result_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
      };
      match_scorers: {
        Row: {
          match_id: string;
          user_id: string;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: {
          match_id: string;
          user_id: string;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["match_scorers"]["Insert"]>;
      };
      innings: {
        Row: {
          id: string;
          match_id: string;
          batting_team_id: string;
          bowling_team_id: string;
          innings_number: number;
          total_runs: number;
          wickets: number;
          legal_balls: number;
          target_runs: number | null;
          status: InningsStatus;
          striker_id: string | null;
          non_striker_id: string | null;
          bowler_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          batting_team_id: string;
          bowling_team_id: string;
          innings_number: number;
          total_runs?: number;
          wickets?: number;
          legal_balls?: number;
          target_runs?: number | null;
          status?: InningsStatus;
          striker_id?: string | null;
          non_striker_id?: string | null;
          bowler_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["innings"]["Insert"]>;
      };
      balls: {
        Row: {
          id: string;
          innings_id: string;
          sequence_no: number;
          over_number: number;
          ball_in_over: number;
          striker_id: string | null;
          non_striker_id: string | null;
          bowler_id: string | null;
          batsman_runs: number;
          extra_runs: number;
          total_runs: number;
          is_legal_delivery: boolean;
          extra_type: ExtraType | null;
          is_wicket: boolean;
          wicket_type: WicketType | null;
          dismissed_player_id: string | null;
          free_hit_next: boolean;
          commentary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          innings_id: string;
          sequence_no: number;
          over_number: number;
          ball_in_over: number;
          striker_id?: string | null;
          non_striker_id?: string | null;
          bowler_id?: string | null;
          batsman_runs?: number;
          extra_runs?: number;
          total_runs?: number;
          is_legal_delivery?: boolean;
          extra_type?: ExtraType | null;
          is_wicket?: boolean;
          wicket_type?: WicketType | null;
          dismissed_player_id?: string | null;
          free_hit_next?: boolean;
          commentary?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["balls"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          previous_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          previous_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
    };
    Views: {
      public_users: {
        Row: {
          id: string;
          name: string;
          mobile_number: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
      };
    };
    Functions: {
      legal_balls_to_overs: {
        Args: { p_legal_balls: number };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      tournament_status: TournamentStatus;
      team_registration_status: TeamRegistrationStatus;
      team_invite_status: TeamInviteStatus;
      team_owner_request_status: TeamOwnerRequestStatus;
      player_role: PlayerRole;
      match_type: MatchType;
      match_status: MatchStatus;
      toss_decision: TossDecision;
      innings_status: InningsStatus;
      extra_type: ExtraType;
      wicket_type: WicketType;
    };
  };
}
