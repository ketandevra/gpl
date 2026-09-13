import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Public endpoint — whether self-registration is open. */
export async function GET() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ user_registration_open: false });
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("user_registration_open")
      .eq("id", 1)
      .maybeSingle();

    return NextResponse.json({
      user_registration_open: Boolean(data?.user_registration_open),
    });
  } catch {
    return NextResponse.json({ user_registration_open: false });
  }
}
