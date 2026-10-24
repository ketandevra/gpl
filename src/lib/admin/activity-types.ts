export const AUTH_ACTIVITY_ACTIONS = ["auth.login", "auth.logout"] as const;
export type AuthActivityAction = (typeof AUTH_ACTIVITY_ACTIONS)[number];

export type ActivityUser = {
  id: string;
  name: string;
  mobile_number: string;
  role: string;
  avatar_url: string | null;
  public_code: string | null;
};

export type ActivityEvent = {
  id: string;
  action: AuthActivityAction;
  created_at: string;
  user: ActivityUser | null;
};
