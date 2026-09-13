import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMAGE_INPUT_MAX_BYTES,
  IMAGE_INPUT_MIME,
  optimizeImageBuffer,
} from "@/lib/images/optimize";

const BUCKET = "aadhaar-docs";

export type DocType = "aadhaar_front" | "aadhaar_back";

export const AADHAAR_MAX_BYTES = IMAGE_INPUT_MAX_BYTES;
export const AADHAAR_MIME = IMAGE_INPUT_MIME;

export function storagePathFor(userId: string, docType: DocType) {
  return `${userId}/${docType}.jpg`;
}

export async function uploadAadhaarDocument(params: {
  userId: string;
  docType: DocType;
  bytes: ArrayBuffer;
  mimeType: string;
}): Promise<{ path: string; size: number } | { error: string }> {
  const mime = params.mimeType || "image/jpeg";
  if (!AADHAAR_MIME.has(mime) && !mime.startsWith("image/")) {
    return { error: "Only image uploads are allowed." };
  }
  if (params.bytes.byteLength > AADHAAR_MAX_BYTES) {
    return { error: "Image must be 5 MB or smaller." };
  }

  const optimized = await optimizeImageBuffer(params.bytes, "aadhaar");
  if ("error" in optimized) return optimized;

  const path = storagePathFor(params.userId, params.docType);
  const admin = createAdminClient();

  const listed = await admin.storage.from(BUCKET).list(params.userId);
  if (listed.data) {
    const stale = listed.data
      .filter((f) => f.name.startsWith(`${params.docType}.`))
      .map((f) => `${params.userId}/${f.name}`);
    if (stale.length) {
      await admin.storage.from(BUCKET).remove(stale);
    }
  }

  const { error } = await admin.storage.from(BUCKET).upload(path, optimized.buffer, {
    contentType: optimized.mimeType,
    upsert: true,
    cacheControl: "3600",
  });

  if (error) {
    console.error("[verification] upload failed:", error.message);
    return { error: "Could not upload document." };
  }

  return { path, size: optimized.size };
}

export async function createAadhaarSignedUrl(
  storagePath: string,
  expiresInSeconds = 120,
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

export async function removeAadhaarObject(storagePath: string): Promise<void> {
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([storagePath]);
}
