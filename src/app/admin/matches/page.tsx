import { AdminMatchesClient } from "@/components/admin/AdminMatchesClient";
import { listMatches, listScorerUsers } from "@/lib/matches/queries";
import { listApprovedTeams } from "@/lib/teams/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Matches" };
export const dynamic = "force-dynamic";

export default async function AdminMatchesPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Matches</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to manage matches.
        </p>
      </div>
    );
  }

  const [matches, teams, scorers] = await Promise.all([
    listMatches(),
    listApprovedTeams(),
    listScorerUsers(),
  ]);

  return (
    <AdminMatchesClient
      initialMatches={matches}
      teams={teams}
      scorers={scorers}
    />
  );
}
