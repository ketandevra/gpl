export type ReportCount = {
  label: string;
  value: number;
};

export type ReportPerson = {
  name: string;
  mobile: string | null;
  player_id: string | null;
  detail?: string;
  href?: string;
};

export type ReportTeam = {
  name: string;
  status: string;
  squad: number;
  verified: number;
  needed: number;
  href: string;
};

export type ReportNameGroup = {
  name: string;
  people: ReportPerson[];
};

export type AdminReports = {
  tournament_name: string | null;
  squad_size: number;
  snapshot: ReportCount[];
  verification: ReportCount[];
  user_roles: ReportCount[];
  team_status: ReportCount[];
  match_status: ReportCount[];
  player_roles: ReportCount[];
  tshirts: ReportCount[];
  signups_7d: ReportCount[];
  logins_7d: ReportCount[];
  attention: {
    pending_verification: ReportPerson[];
    never_logged_in: ReportPerson[];
    verified_no_player: ReportPerson[];
    players_unlinked: ReportPerson[];
    players_no_team: ReportPerson[];
    players_no_photo: ReportPerson[];
    duplicate_names: ReportNameGroup[];
    short_squads: ReportTeam[];
    unverified_in_squads: ReportPerson[];
  };
};
