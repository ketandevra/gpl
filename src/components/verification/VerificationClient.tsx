"use client";

import { useCallback, useEffect, useState } from "react";
import { compressImageFile } from "@/lib/images/compress-client";
import { verificationStatusLabel } from "@/lib/verification/helpers";
import {
  REGISTRATION_PLAYER_ROLES,
  TSHIRT_SIZES,
  type TshirtSize,
} from "@/lib/verification/registration";
import type { PlayerRole, VerificationStatus } from "@/lib/types/database";

type Summary = {
  status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  preferred_player_role: PlayerRole | null;
  tshirt_size: TshirtSize | null;
  has_front: boolean;
  has_back: boolean;
};

export function VerificationClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"front" | "back" | "submit" | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<PlayerRole | "">("");
  const [tshirtSize, setTshirtSize] = useState<TshirtSize | "">("");

  const load = useCallback(async () => {
    const res = await fetch("/api/verification", { credentials: "same-origin" });
    const data = (await res.json()) as { verification?: Summary; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not load verification status.");
      return;
    }
    const next = data.verification ?? null;
    setSummary(next);
    if (next?.preferred_player_role) {
      setPlayerRole(next.preferred_player_role);
    }
    if (next?.tshirt_size) {
      setTshirtSize(next.tshirt_size);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(docType: "aadhaar_front" | "aadhaar_back", file: File) {
    setError(null);
    setMessage(null);
    if (!file.type.startsWith("image/")) {
      setError("Only image uploads are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    setBusy(docType === "aadhaar_front" ? "front" : "back");
    setProgress("Compressing & uploading…");
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
      await load();
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function submit() {
    if (!playerRole) {
      setError("Select your playing role.");
      return;
    }
    if (!tshirtSize) {
      setError("Select your t-shirt size.");
      return;
    }
    setBusy("submit");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          preferred_player_role: playerRole,
          tshirt_size: tshirtSize,
        }),
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Submit failed.");
        return;
      }
      setMessage("Submitted for admin verification.");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  if (!summary) {
    return (
      <p className="text-sm text-[#3e2723]/60">Loading verification…</p>
    );
  }

  const canUpload =
    summary.status === "unverified" || summary.status === "rejected";
  const canSubmit =
    canUpload &&
    summary.has_front &&
    summary.has_back &&
    Boolean(playerRole) &&
    Boolean(tshirtSize) &&
    busy !== "submit";

  const roleLabel =
    REGISTRATION_PLAYER_ROLES.find((r) => r.value === summary.preferred_player_role)
      ?.label ?? summary.preferred_player_role;

  return (
    <div className="space-y-4 rounded-2xl border border-[#3e2723]/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#3e2723]">
        Register as player
      </h2>
      <p className="text-sm text-[#3e2723]/65">
        Status:{" "}
        <span className="font-semibold">
          {verificationStatusLabel(summary.status)}
        </span>
      </p>

      {summary.status === "rejected" && summary.rejection_reason ? (
        <div className="rounded-xl border border-[#d81b60]/25 bg-[#d81b60]/10 px-3 py-2 text-sm text-[#9f1239]">
          <p className="font-semibold">Reason</p>
          <p className="mt-1">{summary.rejection_reason}</p>
        </div>
      ) : null}

      {summary.status === "verified" ? (
        <div className="space-y-1 text-sm text-[#1a7f84]">
          <p>You are verified. You can be selected for team registration.</p>
          {roleLabel ? <p>Role: {roleLabel}</p> : null}
          {summary.tshirt_size ? <p>T-shirt: {summary.tshirt_size}</p> : null}
        </div>
      ) : null}

      {summary.status === "pending" ? (
        <div className="space-y-1 text-sm text-[#8a6500]">
          <p>Documents submitted. Waiting for admin review.</p>
          {roleLabel ? <p>Role: {roleLabel}</p> : null}
          {summary.tshirt_size ? <p>T-shirt: {summary.tshirt_size}</p> : null}
        </div>
      ) : null}

      {canUpload ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Playing role
            </span>
            <select
              value={playerRole}
              onChange={(e) =>
                setPlayerRole(e.target.value as PlayerRole | "")
              }
              required
              className="field-select"
            >
              <option value="">Select role</option>
              {REGISTRATION_PLAYER_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              T-shirt size
            </span>
            <select
              value={tshirtSize}
              onChange={(e) =>
                setTshirtSize(e.target.value as TshirtSize | "")
              }
              required
              className="field-select"
            >
              <option value="">Select size</option>
              {TSHIRT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {(canUpload || summary.status === "pending") && (
        <div className="space-y-4">
          {(
            [
              ["aadhaar_front", "Aadhaar Front", summary.has_front, "front"],
              ["aadhaar_back", "Aadhaar Back", summary.has_back, "back"],
            ] as const
          ).map(([type, label, done, busyKey]) => (
            <div key={type}>
              <p className="text-sm font-medium text-[#3e2723]">
                {label}{" "}
                {done ? (
                  <span className="text-[#1a7f84]">✓ uploaded</span>
                ) : null}
              </p>
              {canUpload ? (
                <label className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#3e2723]/25 bg-[#fdf6e8] px-4 py-6 text-sm font-semibold text-[#1a7f84]">
                  {busy === busyKey ? "Uploading…" : "Upload Image"}
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
      )}

      {progress ? (
        <p className="text-xs text-[#3e2723]/55">{progress}</p>
      ) : null}
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

      {canUpload ? (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="w-full rounded-full bg-[#2aa7ad] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "submit" ? "Submitting…" : "Submit for Verification"}
        </button>
      ) : null}

      {summary.status === "rejected" ? (
        <p className="text-xs text-[#3e2723]/55">
          Re-upload clearer documents, then submit again.
        </p>
      ) : null}
    </div>
  );
}
