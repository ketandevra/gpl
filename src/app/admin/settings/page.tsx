import { AdminSettingsClient } from "@/components/admin/AdminSettingsClient";
import { DEFAULT_SQUAD_SIZE } from "@/lib/constants";
import { getSquadSize } from "@/lib/settings/app";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Admin · Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const squadSize = isSupabaseAdminConfigured()
    ? await getSquadSize()
    : DEFAULT_SQUAD_SIZE;

  return <AdminSettingsClient squadSize={squadSize} />;
}
