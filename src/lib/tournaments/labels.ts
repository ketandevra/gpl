import type { TournamentStatus } from "@/lib/types/database";

export type PublicTournament = {
  id: string;
  name: string;
  short_name: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TournamentStatus;
  registration_open: boolean;
  is_active: boolean;
  created_at?: string;
};

export function formatTournamentDates(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (start && end) {
    if (start === end) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  }
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end!)}`;
}

export function tournamentStatusLabel(status: TournamentStatus): string {
  if (status === "ongoing") return "Ongoing";
  if (status === "upcoming") return "Upcoming";
  return "Completed";
}
