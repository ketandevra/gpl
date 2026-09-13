export const DANGER_SCOPES = [
  {
    id: "users",
    title: "Remove all users",
    confirm: "DELETE USERS",
    countKey: "users",
    detail:
      "Deletes every account except GPL Admin (and you). Sessions for those users end. Player records stay, unlinked.",
  },
  {
    id: "teams",
    title: "Remove all teams",
    confirm: "DELETE TEAMS",
    countKey: "teams",
    detail:
      "Deletes every team and squad membership. Matches must go too (fixtures require teams). The player registry stays.",
  },
  {
    id: "players",
    title: "Remove all players",
    confirm: "DELETE PLAYERS",
    countKey: "players",
    detail:
      "Deletes the player registry and empties every squad. Scorecards keep match totals but lose player names.",
  },
  {
    id: "matches",
    title: "Remove all matches",
    confirm: "DELETE MATCHES",
    countKey: "matches",
    detail: "Deletes fixtures, assigned scorers, innings, and every ball.",
  },
  {
    id: "tournaments",
    title: "Remove all tournaments",
    confirm: "DELETE TOURNAMENTS",
    countKey: null,
    detail:
      "Deletes tournaments plus their teams, players, and matches. Create a tournament again before registering teams.",
  },
  {
    id: "verifications",
    title: "Remove all verifications",
    confirm: "DELETE VERIFICATIONS",
    countKey: null,
    detail:
      "Deletes Aadhaar documents and resets verification on non-admin users. Accounts stay.",
  },
  {
    id: "all",
    title: "Reset all data",
    confirm: "DELETE ALL DATA",
    countKey: null,
    detail:
      "Wipes users, players, teams, matches, tournaments, and verifications. Only GPL Admin is kept. You will be signed out.",
  },
] as const;

export type DangerScopeId = (typeof DANGER_SCOPES)[number]["id"];
