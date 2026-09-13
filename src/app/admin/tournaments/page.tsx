import { AdminTournamentsClient } from "@/components/admin/AdminTournamentsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { TournamentStatus } from "@/lib/types/database";

export const metadata = { title: "Admin · Tournaments" };
export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const configured =
    isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!configured) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Tournaments</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to manage tournaments.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tournaments")
    .select(
      "id, name, short_name, location, start_date, end_date, registration_open, status, is_active, created_at",
    )
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Tournaments</h1>
        <p className="mt-3 text-sm text-[#9f1239]">Could not load tournaments.</p>
      </div>
    );
  }

  return (
    <AdminTournamentsClient
      tournaments={(data ?? []).map((t) => ({
        ...t,
        status: t.status as TournamentStatus,
      }))}
    />
  );
}
