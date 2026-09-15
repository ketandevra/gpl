"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatAadhaarInput,
  aadhaarDigits,
  isValidAadhaarNumber,
  verificationStatusLabel,
} from "@/lib/verification/helpers";
import {
  REGISTRATION_PLAYER_ROLES,
  TSHIRT_SIZES,
  type TshirtSize,
} from "@/lib/verification/registration";
import type { PlayerRole, VerificationStatus } from "@/lib/types/database";
import { AadhaarPhotos } from "@/components/verification/AadhaarPhotos";

type Summary = {
  status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  preferred_player_role: PlayerRole | null;
  tshirt_size: TshirtSize | null;
  has_aadhaar: boolean;
  aadhaar_masked: string | null;
  has_front: boolean;
  has_back: boolean;
  front_url: string | null;
  back_url: string | null;
};

export function VerificationClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playerRole, setPlayerRole] = useState<PlayerRole | "">("");
  const [tshirtSize, setTshirtSize] = useState<TshirtSize | "">("");
  const [aadhaar, setAadhaar] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/verification", {
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        verification?: Summary;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load verification status.");
        return;
      }
      const next = data.verification ?? null;
      if (!next) {
        setError("Could not load verification status.");
        return;
      }
      setSummary(next);
      setError(null);
      if (next.preferred_player_role) {
        setPlayerRole(next.preferred_player_role);
      }
      if (next.tshirt_size) {
        setTshirtSize(next.tshirt_size);
      }
    } catch {
      setError("Could not load verification status.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!playerRole) {
      setError("Select your playing role.");
      return;
    }
    if (!tshirtSize) {
      setError("Select your t-shirt size.");
      return;
    }
    if (!isValidAadhaarNumber(aadhaar)) {
      setError("Enter a 12-digit Aadhaar number.");
      return;
    }
    if (!summary?.has_front || !summary?.has_back) {
      setError("Upload both Aadhaar front and back photos.");
      return;
    }
    setBusy(true);
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
          aadhaar_number: aadhaarDigits(aadhaar),
        }),
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Submit failed.");
        return;
      }
      setMessage("Submitted for admin verification.");
      setAadhaar("");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <p className="text-sm text-[#3e2723]/60">Loading verification…</p>
    );
  }

  if (!summary) {
    return (
      <p className="text-sm text-[#9f1239]" role="alert">
        {error ?? "Could not load verification status."}
      </p>
    );
  }

  const canEdit =
    summary.status === "unverified" || summary.status === "rejected";
  const canSubmit =
    canEdit &&
    Boolean(playerRole) &&
    Boolean(tshirtSize) &&
    isValidAadhaarNumber(aadhaar) &&
    summary.has_front &&
    summary.has_back &&
    !busy;

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
          {summary.aadhaar_masked ? (
            <p>Aadhaar: {summary.aadhaar_masked}</p>
          ) : null}
          <p className="pt-1 text-xs text-[#3e2723]/55">
            Aadhaar photos were permanently deleted after verification.
          </p>
        </div>
      ) : null}

      {summary.status === "pending" ? (
        <div className="space-y-1 text-sm text-[#8a6500]">
          <p>
            {summary.has_front && summary.has_back
              ? "Details submitted. Waiting for admin review."
              : "Submitted. Upload both Aadhaar photos so admin can verify you."}
          </p>
          {roleLabel ? <p>Role: {roleLabel}</p> : null}
          {summary.tshirt_size ? <p>T-shirt: {summary.tshirt_size}</p> : null}
          {summary.aadhaar_masked ? (
            <p>Aadhaar: {summary.aadhaar_masked}</p>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-[#3e2723]/70">
                Playing role <span className="text-[#d81b60]">*</span>
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
                T-shirt size <span className="text-[#d81b60]">*</span>
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
          <label className="block">
            <span className="mb-1 block text-sm text-[#3e2723]/70">
              Aadhaar number <span className="text-[#d81b60]">*</span>
            </span>
            <input
              value={aadhaar}
              onChange={(e) => setAadhaar(formatAadhaarInput(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="XXXX-XXXX-XXXX"
              maxLength={14}
              required
              className="field tracking-[0.18em]"
            />
            <span className="mt-1 block text-xs text-[#3e2723]/50">
              12 digits only. Shown as XXXX-XXXX-XXXX.
            </span>
          </label>
        </div>
      ) : null}

      {summary.status !== "verified" ? (
        <AadhaarPhotos
          frontUrl={summary.front_url}
          backUrl={summary.back_url}
          canUpload
          required
          onChanged={load}
        />
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

      {canEdit ? (
        <>
          {(!summary.has_front || !summary.has_back) ? (
            <p className="text-xs text-[#3e2723]/55">
              Upload both Aadhaar photos to enable Submit for Verification.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="w-full rounded-full bg-[#2aa7ad] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit for Verification"}
          </button>
        </>
      ) : null}

      {summary.status === "rejected" ? (
        <p className="text-xs text-[#3e2723]/55">
          Update your details and submit again.
        </p>
      ) : null}
    </div>
  );
}
