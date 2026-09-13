import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const configured =
    isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!configured) {
    return (
      <AdminDashboardClient
        configured={false}
        totals={{
          users: 0,
          teams: 0,
          players: 0,
          matches: 0,
          live: 0,
          upcoming: 0,
          completed: 0,
        }}
        userRegistrationOpen={false}
        teamRegistrationOpen={false}
        tournamentName={null}
      />
    );
  }

  const admin = createAdminClient();
  const [
    users,
    teams,
    players,
    matches,
    liveMatches,
    upcomingMatches,
    completedMatches,
    settings,
    activeTournament,
  ] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("teams").select("id", { count: "exact", head: true }),
    admin.from("players").select("id", { count: "exact", head: true }),
    admin.from("matches").select("id", { count: "exact", head: true }),
    admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["live", "innings_break"]),
    admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled"),
    admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    admin
      .from("app_settings")
      .select("user_registration_open")
      .eq("id", 1)
      .maybeSingle(),
    admin
      .from("tournaments")
      .select("id, name, registration_open")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  return (
    <AdminDashboardClient
      configured
      totals={{
        users: users.count ?? 0,
        teams: teams.count ?? 0,
        players: players.count ?? 0,
        matches: matches.count ?? 0,
        live: liveMatches.count ?? 0,
        upcoming: upcomingMatches.count ?? 0,
        completed: completedMatches.count ?? 0,
      }}
      userRegistrationOpen={Boolean(settings.data?.user_registration_open)}
      teamRegistrationOpen={Boolean(activeTournament.data?.registration_open)}
      tournamentName={(activeTournament.data?.name as string | undefined) ?? null}
    />
  );
}
