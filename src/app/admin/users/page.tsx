import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/types/database";

export const metadata = { title: "Admin · Users" };
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  name: string;
  mobile_number: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  locked_until: string | null;
  failed_login_attempts: number;
  verification_status: import("@/lib/types/database").VerificationStatus;
};

export default async function AdminUsersPage() {
  const current = await getCurrentUser();
  const configured =
    isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!configured || !current) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Users</h1>
        <p className="mt-3 text-sm text-[#3e2723]/70">
          Connect Supabase to manage users.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select(
      "id, name, mobile_number, role, is_active, created_at, last_login_at, locked_until, failed_login_attempts, verification_status",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-bold text-[#3e2723]">Users</h1>
        <p className="mt-3 text-sm text-[#9f1239]">Could not load users.</p>
      </div>
    );
  }

  return (
    <AdminUsersClient
      users={(data ?? []) as UserRow[]}
      currentUserId={current.id}
    />
  );
}
