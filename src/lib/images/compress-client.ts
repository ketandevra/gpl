/**
 * Browser-side resize/compress before upload (saves upload bandwidth).
 * Server still re-optimizes with sharp — this is a best-effort first pass.
 */

export type ClientCompressOptions = {
  maxEdge: number;
  quality: number; // 0–1
  mimeType?: "image/jpeg" | "image/webp";
};

const DEFAULTS: Record<"avatar" | "aadhaar", ClientCompressOptions> = {
  avatar: { maxEdge: 512, quality: 0.72, mimeType: "image/jpeg" },
  aadhaar: { maxEdge: 1280, quality: 0.7, mimeType: "image/jpeg" },
};

export async function compressImageFile(
  file: File,
  kind: "avatar" | "aadhaar" = "avatar",
): Promise<File> {
  const opts = DEFAULTS[kind];
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      opts.maxEdge / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const mime = opts.mimeType ?? "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, opts.quality),
    );
    if (!blob) return file;

    // Prefer compressed result when smaller (or always when we resized)
    if (blob.size >= file.size && scale === 1) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    const ext = mime === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() });
  } catch {
    return file;
  }
}
