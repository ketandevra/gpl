/**
 * Browser-side resize/compress before upload (saves upload bandwidth).
 * Server still re-optimizes with sharp — this is a best-effort first pass.
 */

export type ClientCompressOptions = {
  maxEdge: number;
  quality: number; // 0–1
  mimeType?: "image/jpeg" | "image/webp";
  maxBytes?: number;
};

const DEFAULTS: Record<"avatar" | "aadhaar", ClientCompressOptions> = {
  avatar: {
    maxEdge: 512,
    quality: 0.72,
    mimeType: "image/jpeg",
    maxBytes: 140 * 1024,
  },
  aadhaar: {
    maxEdge: 1280,
    quality: 0.7,
    mimeType: "image/jpeg",
    maxBytes: 260 * 1024,
  },
};

function looksLikeImage(file: File) {
  return (
    file.type.startsWith("image/") ||
    !file.type ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
  );
}

async function blobFromCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), mime, quality),
  );
}

export async function compressImageFile(
  file: File,
  kind: "avatar" | "aadhaar" = "avatar",
): Promise<File> {
  const opts = DEFAULTS[kind];
  if (!looksLikeImage(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const mime = opts.mimeType ?? "image/jpeg";
    const maxBytes = opts.maxBytes ?? file.size;
    let edge = opts.maxEdge;
    let quality = opts.quality;
    let best: Blob | null = null;

    for (let i = 0; i < 6; i += 1) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
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
      const blob = await blobFromCanvas(canvas, mime, quality);
      if (blob) best = blob;
      if (blob && blob.size <= maxBytes) break;
      quality = Math.max(0.42, quality - 0.1);
      edge = Math.round(edge * 0.82);
    }

    bitmap.close();
    if (!best) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    const ext = mime === "image/webp" ? "webp" : "jpg";
    return new File([best], `${base}.${ext}`, {
      type: mime,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
