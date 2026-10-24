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

type Step = 1 | 2;

export function VerificationClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playerRole, setPlayerRole] = useState<PlayerRole | "">("");
  const [tshirtSize, setTshirtSize] = useState<TshirtSize | "">("");
  const [aadhaar, setAadhaar] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<Step>(1);

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
      if (next.status === "pending" || next.status === "verified") {
        setStep(2);
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

  async function submitDetails() {
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
      setAadhaar("");
      setMessage(
        "Details submitted. Upload Aadhaar photos when you have the card.",
      );
      setStep(2);
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
  const canSubmitDetails =
    canEdit &&
    Boolean(playerRole) &&
    Boolean(tshirtSize) &&
    isValidAadhaarNumber(aadhaar) &&
    !busy;

  const roleLabel =
    REGISTRATION_PLAYER_ROLES.find((r) => r.value === summary.preferred_player_role)
      ?.label ?? summary.preferred_player_role;

  const photosDone = summary.has_front && summary.has_back;

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

      {step === 1 && canEdit ? (
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

      {step === 2 && summary.status !== "verified" ? (
        <div className="space-y-3">
          {summary.status === "pending" ? (
            <div className="space-y-1 text-sm text-[#8a6500]">
              <p>
                {photosDone
                  ? "Details and photos submitted. Waiting for admin review."
                  : "Details submitted. Upload both Aadhaar photos when you have the card."}
              </p>
              {roleLabel ? <p>Role: {roleLabel}</p> : null}
              {summary.tshirt_size ? <p>T-shirt: {summary.tshirt_size}</p> : null}
              {summary.aadhaar_masked ? (
                <p>Aadhaar: {summary.aadhaar_masked}</p>
              ) : null}
            </div>
          ) : null}
          <AadhaarPhotos
            frontUrl={summary.front_url}
            backUrl={summary.back_url}
            canUpload
            required
            onChanged={load}
          />
          {!photosDone ? (
            <p className="text-xs text-[#3e2723]/55">
              You can leave now and come back to upload photos later.
            </p>
          ) : null}
        </div>
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

      {step === 1 && canEdit ? (
        <button
          type="button"
          disabled={!canSubmitDetails}
          onClick={() => void submitDetails()}
          className="w-full rounded-full bg-[#2aa7ad] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit details"}
        </button>
      ) : null}

      {step === 2 && canEdit ? (
        <button
          type="button"
          onClick={() => {
            setStep(1);
            setError(null);
            setMessage(null);
          }}
          className="w-full text-sm font-semibold text-[#1a7f84]"
        >
          Back to details
        </button>
      ) : null}
    </div>
  );
}
