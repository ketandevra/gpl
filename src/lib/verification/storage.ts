import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import {
  IMAGE_INPUT_MAX_BYTES,
  IMAGE_INPUT_MIME,
  optimizeImageBuffer,
} from "@/lib/images/optimize";
import { createAadhaarSignedUrl } from "@/lib/verification/signed-url";

export { createAadhaarSignedUrl };

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

export async function removeAadhaarObject(storagePath: string): Promise<void> {
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([storagePath]);
}

/**
 * Permanently delete Aadhaar image files and DB rows for a user.
 * Required after admin verification — copies of Aadhaar must not be retained.
 */
export async function purgeAadhaarDocumentsForUser(
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  const paths = new Set<string>();

  try {
    const docs = await withRetry(() =>
      adminRest<Array<{ storage_path: string }>>("verification_documents", {
        query: `?user_id=eq.${encodeURIComponent(userId)}&select=storage_path`,
      }),
    );
    for (const doc of docs) {
      if (doc.storage_path) paths.add(doc.storage_path);
    }
  } catch (err) {
    console.error("[verification] list docs for purge failed:", err);
  }

  try {
    const listed = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
    if (listed.data) {
      for (const file of listed.data) {
        if (file.name) paths.add(`${userId}/${file.name}`);
      }
    }
  } catch (err) {
    console.error("[verification] list storage for purge failed:", err);
  }

  if (paths.size) {
    const { error } = await admin.storage.from(BUCKET).remove([...paths]);
    if (error) {
      console.error("[verification] storage purge failed:", error.message);
    }
  }

  try {
    await withRetry(() =>
      adminRest("verification_documents", {
        method: "DELETE",
        query: `?user_id=eq.${encodeURIComponent(userId)}`,
      }),
    );
  } catch (err) {
    console.error("[verification] document row purge failed:", err);
  }
}

/** Remove leftover Aadhaar files for users who are already verified. */
export async function purgeAadhaarDocumentsForVerifiedUsers(): Promise<void> {
  const candidateIds = new Set<string>();

  try {
    const leftovers = await withRetry(() =>
      adminRest<Array<{ user_id: string }>>("verification_documents", {
        query: "?select=user_id",
      }),
    );
    for (const row of leftovers) candidateIds.add(row.user_id);
  } catch (err) {
    console.error("[verification] leftover docs query failed:", err);
  }

  try {
    const admin = createAdminClient();
    const { data: root } = await admin.storage.from(BUCKET).list("", {
      limit: 1000,
    });
    for (const entry of root ?? []) {
      if (entry.name) candidateIds.add(entry.name);
    }
  } catch (err) {
    console.error("[verification] storage listing for sweep failed:", err);
  }

  if (!candidateIds.size) return;

  const userIds = [...candidateIds].filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  );
  if (!userIds.length) return;

  try {
    const verified = await withRetry(() =>
      adminRest<Array<{ id: string }>>("users", {
        query: `?id=in.(${userIds.join(",")})&verification_status=eq.verified&select=id`,
      }),
    );
    for (const user of verified) {
      await purgeAadhaarDocumentsForUser(user.id);
    }
  } catch (err) {
    console.error("[verification] verified-doc sweep failed:", err);
  }
}
