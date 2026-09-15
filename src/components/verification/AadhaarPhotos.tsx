"use client";

import { useState } from "react";
import { compressImageFile } from "@/lib/images/compress-client";

type AadhaarPhotosProps = {
  frontUrl: string | null;
  backUrl: string | null;
  canUpload: boolean;
  required?: boolean;
  onChanged?: () => Promise<void> | void;
};

export function AadhaarPhotos({
  frontUrl,
  backUrl,
  canUpload,
  required = false,
  onChanged,
}: AadhaarPhotosProps) {
  const [busy, setBusy] = useState<"front" | "back" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(docType: "aadhaar_front" | "aadhaar_back", file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only image uploads are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    const side = docType === "aadhaar_front" ? "front" : "back";
    setBusy(side);
    setError(null);
    setMessage(null);
    try {
      const compressed = await compressImageFile(file, "aadhaar");
      const form = new FormData();
      form.set("doc_type", docType);
      form.set("file", compressed);
      const res = await fetch("/api/verification", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setMessage(
        docType === "aadhaar_front"
          ? "Aadhaar front uploaded."
          : "Aadhaar back uploaded.",
      );
      await onChanged?.();
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[#3e2723]">
        Aadhaar photos{" "}
        {required ? <span className="text-[#d81b60]">*</span> : null}
      </p>
      <p className="text-xs text-[#3e2723]/55">
        Upload clear photos of the front and back of your Aadhaar card. Both
        sides are required. These photos are used only for admin review and are
        deleted permanently after you are verified.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["aadhaar_front", "Front", frontUrl, "front"],
            ["aadhaar_back", "Back", backUrl, "back"],
          ] as const
        ).map(([type, label, url, busyKey]) => (
          <div
            key={type}
            className="overflow-hidden rounded-xl border border-[#3e2723]/10 bg-[#fdf6e8]"
          >
            <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-[#3e2723]/50">
              {label}
              {required ? (
                <span className="ml-0.5 text-[#d81b60]">*</span>
              ) : null}
              {url ? <span className="ml-1 text-[#1a7f84]">✓</span> : null}
            </p>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={`Aadhaar ${label.toLowerCase()}`}
                className="mt-2 h-40 w-full object-contain bg-white"
              />
            ) : (
              <div className="mt-2 flex h-40 items-center justify-center px-3 text-center text-sm text-[#3e2723]/45">
                Not uploaded yet
              </div>
            )}
            {canUpload ? (
              <label className="block cursor-pointer bg-white px-3 py-2 text-center text-sm font-semibold text-[#1a7f84]">
                {busy === busyKey
                  ? "Uploading…"
                  : url
                    ? "Replace photo"
                    : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  disabled={busy !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(type, file);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
        ))}
      </div>
      {message ? (
        <p className="text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[#9f1239]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
