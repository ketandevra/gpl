import { AdminReports } from "@/components/admin/AdminReports";
import { getAdminReports } from "@/lib/admin/reports";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Reports" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Reports</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to load admin reports.
        </p>
      </div>
    );
  }

  try {
    const reports = await getAdminReports();
    return <AdminReports reports={reports} />;
  } catch {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Reports</h1>
        <p className="mt-3 text-sm text-[#9f1239]">Could not load reports.</p>
      </div>
    );
  }
}
