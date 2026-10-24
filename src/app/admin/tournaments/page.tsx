import { AdminTournamentsClient } from "@/components/admin/AdminTournamentsClient";
import { listAllTournaments } from "@/lib/tournaments/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Tournaments" };
export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Tournaments</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to manage tournaments.
        </p>
      </div>
    );
  }

  let tournaments: Awaited<ReturnType<typeof listAllTournaments>> = [];
  try {
    tournaments = await listAllTournaments();
  } catch {
    tournaments = [];
  }

  return (
    <AdminTournamentsClient
      tournaments={tournaments.map((t) => ({
        ...t,
        created_at: t.created_at ?? "",
      }))}
    />
  );
}
