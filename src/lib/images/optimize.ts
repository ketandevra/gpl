import "server-only";

function canUseSharp() {
  return (
    typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair ===
    "undefined"
  );
}

export const IMAGE_INPUT_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_INPUT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type OptimizePreset = "avatar" | "aadhaar";

const PRESETS: Record<
  OptimizePreset,
  { maxEdge: number; quality: number; maxOutputBytes: number }
> = {
  // Public avatars — keep tiny to protect free-tier storage + egress
  avatar: { maxEdge: 512, quality: 72, maxOutputBytes: 120 * 1024 },
  // Private docs — readable but tightly compressed
  aadhaar: { maxEdge: 1280, quality: 68, maxOutputBytes: 280 * 1024 },
};

/**
 * Resize + convert to JPEG. Reduces Supabase storage and bandwidth usage.
 */
export async function optimizeImageBuffer(
  input: ArrayBuffer | Buffer,
  preset: OptimizePreset,
): Promise<{ buffer: Buffer; mimeType: "image/jpeg"; size: number } | { error: string }> {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (bytes.byteLength < 100) {
    return { error: "File looks empty or corrupt." };
  }
  if (bytes.byteLength > IMAGE_INPUT_MAX_BYTES) {
    return { error: "Image must be 5 MB or smaller." };
  }

  const { maxEdge, quality, maxOutputBytes } = PRESETS[preset];

  if (!canUseSharp()) {
    if (bytes.byteLength > maxOutputBytes) {
      return {
        error: "Photo is too large. Try a closer, clearer photo.",
      };
    }
    return { buffer: bytes, mimeType: "image/jpeg", size: bytes.byteLength };
  }

  try {
    const { default: sharp } = await import("sharp");
    let q = quality;
    let out = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();

    // Step quality down if still too large
    while (out.byteLength > maxOutputBytes && q > 40) {
      q -= 8;
      out = await sharp(bytes, { failOn: "none" })
        .rotate()
        .resize({
          width: maxEdge,
          height: maxEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: q, mozjpeg: true })
        .toBuffer();
    }

    // Last resort: shrink edge further
    if (out.byteLength > maxOutputBytes) {
      const smallerEdge = Math.round(maxEdge * 0.75);
      out = await sharp(bytes, { failOn: "none" })
        .rotate()
        .resize({
          width: smallerEdge,
          height: smallerEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 55, mozjpeg: true })
        .toBuffer();
    }

    if (out.byteLength > maxOutputBytes * 1.5) {
      return { error: "Could not compress image enough. Try a simpler photo." };
    }

    return { buffer: out, mimeType: "image/jpeg", size: out.byteLength };
  } catch (err) {
    console.error("[images] optimize failed:", err);
    return { error: "Could not process image. Use JPG, PNG, or WebP." };
  }
}
