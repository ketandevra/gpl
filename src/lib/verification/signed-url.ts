import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "aadhaar-docs";

export async function createAadhaarSignedUrl(
  storagePath: string,
  expiresInSeconds = 900,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.error("[verification] signed URL failed:", error.message);
    return null;
  }
  return data.signedUrl;
}
