import { AdminActivityClient } from "@/components/admin/AdminActivityClient";
import { listAuthActivity } from "@/lib/admin/activity";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Activity" };
export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <p className="text-sm text-[#3e2723]/70">
          Connect Supabase to load login and logout events.
        </p>
      </div>
    );
  }

  let events: Awaited<ReturnType<typeof listAuthActivity>> = [];
  try {
    events = await listAuthActivity();
  } catch {
    return (
      <div className="px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        <p className="text-sm text-[#9f1239]">Could not load activity.</p>
      </div>
    );
  }

  return <AdminActivityClient events={events} />;
}
