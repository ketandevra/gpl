import { AuthForm } from "@/components/auth/AuthForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Register" };
export const revalidate = 30;

async function getRegistrationOpen(): Promise<boolean> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("user_registration_open")
      .eq("id", 1)
      .maybeSingle();
    return Boolean(data?.user_registration_open);
  } catch {
    return false;
  }
}

export default async function RegisterPage() {
  const registrationOpen = await getRegistrationOpen();

  return <AuthForm mode="register" registrationOpen={registrationOpen} />;
}
