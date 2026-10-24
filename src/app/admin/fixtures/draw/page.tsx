import Link from "next/link";
import { ManualTeamDrawClient } from "@/components/admin/ManualTeamDrawClient";
import { getFixtureWorkspace } from "@/lib/fixtures/service";
import { listFixtureTournaments } from "@/lib/fixtures/queries";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Manual Team Draw" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tournament?: string }>;
};

export default async function ManualTeamDrawPage({ searchParams }: PageProps) {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Manual Team Draw</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to record the slip draw.
        </p>
      </div>
    );
  }

  const query = await searchParams;
  let tournaments: Awaited<ReturnType<typeof listFixtureTournaments>> = [];
  try {
    tournaments = await listFixtureTournaments();
  } catch {
    tournaments = [];
  }
  const selectedId =
    query.tournament ??
    tournaments.find((row) => row.is_active)?.id ??
    tournaments[0]?.id ??
    null;

  if (!selectedId) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Manual Team Draw</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Create a tournament and select teams before recording the draw.
        </p>
      </div>
    );
  }

  let workspace = null;
  let loadError: string | null = null;
  try {
    workspace = await getFixtureWorkspace(selectedId);
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : "Apply the fixture SQL migrations in Supabase first.";
  }

  if (!workspace) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Manual Team Draw</h1>
        <p className="mt-3 text-sm text-[#9f1239]">
          {loadError ?? "Could not load the draw."}
        </p>
        <Link
          href="/admin/fixtures"
          className="mt-4 inline-flex text-sm font-semibold text-[#1a7f84]"
        >
          Back to fixtures
        </Link>
      </div>
    );
  }

  return (
    <ManualTeamDrawClient
      initial={workspace}
      tournaments={tournaments}
      selectedId={selectedId}
    />
  );
}
