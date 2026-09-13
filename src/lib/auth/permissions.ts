import type { UserRole, VerificationStatus } from "@/lib/types/database";

export type SessionUser = {
  id: string;
  name: string;
  mobile_number: string;
  role: UserRole;
  is_active: boolean;
  verification_status: VerificationStatus;
  avatar_url: string | null;
};

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin" && user.is_active;
}

export function isScorer(user: SessionUser | null | undefined): boolean {
  return (
    !!user?.is_active && (user.role === "scorer" || user.role === "admin")
  );
}

export function isTeamManager(user: SessionUser | null | undefined): boolean {
  return (
    !!user?.is_active &&
    (user.role === "team_manager" || user.role === "admin")
  );
}

export function canAccessAdmin(user: SessionUser | null | undefined): boolean {
  return isAdmin(user);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "scorer":
      return "Scorer";
    case "team_manager":
      return "Captain";
    case "viewer":
      return "Viewer";
    default:
      return role;
  }
}
