import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMAGE_INPUT_MAX_BYTES,
  IMAGE_INPUT_MIME,
  optimizeImageBuffer,
} from "@/lib/images/optimize";

const BUCKET = "user-avatars";
/** Max raw upload before server optimize (client should compress first). */
export const AVATAR_MAX_BYTES = IMAGE_INPUT_MAX_BYTES;
export const AVATAR_MIME = IMAGE_INPUT_MIME;

export function publicAvatarUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return path;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function uploadUserAvatar(params: {
  userId: string;
  bytes: ArrayBuffer;
  mimeType: string;
}): Promise<{ url: string; path: string; size: number } | { error: string }> {
  const mime = params.mimeType || "image/jpeg";
  if (!AVATAR_MIME.has(mime) && !mime.startsWith("image/")) {
    return { error: "Only image uploads are allowed." };
  }
  if (params.bytes.byteLength > AVATAR_MAX_BYTES) {
    return { error: "Image must be 5 MB or smaller." };
  }

  const optimized = await optimizeImageBuffer(params.bytes, "avatar");
  if ("error" in optimized) return optimized;

  // Always store as jpg after optimize — one object per user
  const path = `${params.userId}/avatar.jpg`;
  const admin = createAdminClient();

  const listed = await admin.storage.from(BUCKET).list(params.userId);
  if (listed.data?.length) {
    await admin.storage
      .from(BUCKET)
      .remove(listed.data.map((f) => `${params.userId}/${f.name}`));
  }

  const { error } = await admin.storage.from(BUCKET).upload(path, optimized.buffer, {
    contentType: optimized.mimeType,
    upsert: true,
    cacheControl: "86400",
  });

  if (error) {
    console.error("[avatar] upload failed:", error.message);
    return { error: "Could not upload photo." };
  }

  return {
    url: publicAvatarUrl(path),
    path,
    size: optimized.size,
  };
}

export async function removeUserAvatarFiles(userId: string): Promise<void> {
  const admin = createAdminClient();
  const listed = await admin.storage.from(BUCKET).list(userId);
  if (listed.data?.length) {
    await admin.storage
      .from(BUCKET)
      .remove(listed.data.map((f) => `${userId}/${f.name}`));
  }
}
