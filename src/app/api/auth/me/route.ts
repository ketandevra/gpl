import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  let userRegistrationOpen = false;
  if (isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("user_registration_open")
      .eq("id", 1)
      .maybeSingle();
    userRegistrationOpen = Boolean(data?.user_registration_open);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      mobile_number: user.mobile_number,
      role: user.role,
    },
    userRegistrationOpen,
  });
}
