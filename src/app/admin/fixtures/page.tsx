import { AdminFixturesClient } from "@/components/admin/AdminFixturesClient";
import { getFixtureWorkspace } from "@/lib/fixtures/service";
import { listFixtureTournaments } from "@/lib/fixtures/queries";
import { listAllTournaments } from "@/lib/tournaments/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Fixtures" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tournament?: string }>;
};

export default async function AdminFixturesPage({ searchParams }: PageProps) {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Fixtures</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to manage tournament fixtures.
        </p>
      </div>
    );
  }

  const query = await searchParams;
  let tournaments: Awaited<ReturnType<typeof listFixtureTournaments>> = [];
  try {
    tournaments = await listFixtureTournaments();
  } catch {
    try {
      const fallback = await listAllTournaments();
      tournaments = fallback.map((row) => ({
        id: row.id,
        name: row.name,
        is_active: row.is_active,
        current_stage: "setup" as const,
        draw_status: "pending" as const,
      }));
    } catch {
      tournaments = [];
    }
  }

  const selectedId =
    query.tournament ??
    tournaments.find((row) => row.is_active)?.id ??
    tournaments[0]?.id ??
    null;

  let workspace = null;
  let loadError: string | null = null;
  if (selectedId) {
    try {
      workspace = await getFixtureWorkspace(selectedId);
    } catch (err) {
      loadError =
        err instanceof Error
          ? err.message
          : "Could not load fixture data. Apply the fixture SQL migrations first.";
    }
  }

  return (
    <AdminFixturesClient
      initial={workspace}
      tournaments={tournaments}
      selectedId={selectedId}
      loadError={loadError}
    />
  );
}
