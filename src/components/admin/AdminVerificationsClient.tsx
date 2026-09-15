"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  aadhaarDigits,
  formatAadhaarInput,
  verificationStatusLabel,
} from "@/lib/verification/helpers";
import {
  REGISTRATION_PLAYER_ROLES,
  TSHIRT_SIZES,
  type TshirtSize,
} from "@/lib/verification/registration";
import type { PlayerRole, VerificationStatus } from "@/lib/types/database";

type RequestRow = {
  id: string;
  name: string;
  mobile_number: string;
  verification_status: string;
  verification_submitted_at: string | null;
  has_aadhaar: boolean;
  has_front?: boolean;
  has_back?: boolean;
};

type Detail = {
  user: {
    id: string;
    name: string;
    mobile_number: string;
    verification_status: string;
    aadhaar_masked: string | null;
    aadhaar_full: string | null;
    verification_submitted_at: string | null;
    verification_reviewed_at: string | null;
    verification_reviewed_by_name: string | null;
    verification_rejection_reason: string | null;
    preferred_player_role: string | null;
    tshirt_size: string | null;
  };
  documents: Array<{
    doc_type: string;
    uploaded_at: string;
    signed_url: string | null;
  }>;
  history: Array<{
    id: string;
    action: string;
    created_at: string;
    summary: string;
  }>;
  player: { public_code: string; name: string } | null;
  documents_purged?: boolean;
};

function statusChipClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-[#fff6df] text-[#8a6500]";
    case "verified":
      return "bg-[#2aa7ad]/15 text-[#1a7f84]";
    case "rejected":
      return "bg-[#d81b60]/10 text-[#9f1239]";
    default:
      return "bg-[#3e2723]/8 text-[#3e2723]/70";
  }
}

function relativeTime(iso: string | null) {
  if (!iso) return "Not submitted yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Not submitted yet";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function historyLabel(action: string, summary: string) {
  const key = action.replace(/^verification\./, "");
  switch (key) {
    case "submitted":
      return "Player submitted registration";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    case "revoked":
      return "Verification revoked";
    case "details_updated":
      return "Details updated";
    case "aadhaar_added":
      return "Aadhaar number added";
    case "aadhaar_changed":
      return "Aadhaar number changed";
    case "documents_purged":
      return "Aadhaar photos permanently deleted";
    default:
      return summary.replace(/_/g, " ");
  }
}

function CheckDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        ok ? "bg-[#2aa7ad]/12 text-[#1a7f84]" : "bg-[#3e2723]/6 text-[#3e2723]/45"
      }`}
    >
      <span aria-hidden>{ok ? "✓" : "–"}</span>
      {label}
    </span>
  );
}

export function AdminVerificationsClient() {
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState<PlayerRole | "">("");
  const [tshirtInput, setTshirtInput] = useState<TshirtSize | "">("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingForceRevoke, setPendingForceRevoke] = useState(false);
  const [mobileReview, setMobileReview] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.mobile_number.includes(q),
    );
  }, [requests, query]);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/admin/verifications");
    const data = (await res.json()) as { requests?: RequestRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to load.");
      setListLoading(false);
      return;
    }
    setRequests(data.requests ?? []);
    setListLoading(false);
  }, []);

  const loadDetail = useCallback(async (userId: string, opts?: { mobile?: boolean }) => {
    setSelectedId(userId);
    setDetailLoading(true);
    setError(null);
    setPendingForceRevoke(false);
    if (opts?.mobile !== false) setMobileReview(true);
    const res = await fetch(
      `/api/admin/verifications?user_id=${encodeURIComponent(userId)}`,
    );
    const data = (await res.json()) as Detail & { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to load this player.");
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    setDetail(data);
    setAadhaarInput(formatAadhaarInput(data.user.aadhaar_full ?? ""));
    setNameInput(data.user.name ?? "");
    setRoleInput((data.user.preferred_player_role as PlayerRole | null) ?? "");
    setTshirtInput((data.user.tshirt_size as TshirtSize | null) ?? "");
    setRejectReason(data.user.verification_rejection_reason ?? "");
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const uid = searchParams.get("user_id");
    if (uid) void loadDetail(uid);
  }, [searchParams, loadDetail]);

  async function persistDetails(): Promise<boolean> {
    if (!selectedId) return false;
    if (nameInput.trim().length < 2) {
      setError("Enter the player’s full name (at least 2 characters).");
      return false;
    }
    if (!roleInput) {
      setError("Select a playing role.");
      return false;
    }
    if (!tshirtInput) {
      setError("Select a t-shirt size.");
      return false;
    }
    const res = await fetch("/api/admin/verifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_details",
        user_id: selectedId,
        name: nameInput.trim(),
        preferred_player_role: roleInput,
        tshirt_size: tshirtInput,
        aadhaar_number: aadhaarDigits(aadhaarInput) || null,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not save details.");
      return false;
    }
    return true;
  }

  async function decide(
    decision: "verify" | "reject" | "revoke",
    force = false,
  ) {
    if (!selectedId) return;
    if (decision === "reject" && rejectReason.trim().length < 3) {
      setError("Add a short rejection reason so the player knows what to fix.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (decision === "verify") {
        const saved = await persistDetails();
        if (!saved) return;
      }
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedId,
          decision,
          rejection_reason: rejectReason || null,
          aadhaar_number: aadhaarDigits(aadhaarInput) || null,
          force_revoke: force,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        warning?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        if (decision === "revoke" && res.status === 409) {
          setPendingForceRevoke(true);
          setError(
            (data.error ?? "This player is on an approved team.") +
              "\n\nYou can still revoke. Their team history will stay.",
          );
          return;
        }
        setError(data.error ?? "Action failed.");
        return;
      }
      setPendingForceRevoke(false);
      setMessage(
        data.warning ??
          (decision === "verify"
            ? "Player verified. Aadhaar photos were permanently deleted."
            : decision === "reject"
              ? "Request rejected. The player can fix and resubmit."
              : "Verification revoked."),
      );
      await loadList();
      await loadDetail(selectedId, { mobile: true });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await persistDetails();
      if (!saved) return;
      setMessage("Details saved.");
      await loadList();
      if (selectedId) await loadDetail(selectedId, { mobile: true });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const hasFront = Boolean(
    detail?.documents.some((d) => d.doc_type === "aadhaar_front" && d.signed_url),
  );
  const hasBack = Boolean(
    detail?.documents.some((d) => d.doc_type === "aadhaar_back" && d.signed_url),
  );
  const inQueue = Boolean(selectedId && requests.some((r) => r.id === selectedId));
  const reviewStatus = detail?.user.verification_status ?? null;
  const canApprove =
    reviewStatus === "pending" || reviewStatus === "rejected";
  const canReject = reviewStatus === "pending";
  const canRevoke = reviewStatus === "verified";

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
            Admin
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">
            Verification
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[#3e2723]/60">
            Check Aadhaar photos against the number, fix the player’s details
            if needed, then approve or reject. After approval, Aadhaar photos
            are deleted permanently.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-sm font-semibold text-[#1a7f84]"
        >
          Find a user →
        </Link>
      </div>

      {message ? (
        <p
          className="mt-4 rounded-xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-3 py-2 text-sm text-[#1a7f84]"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <pre
          className="mt-4 whitespace-pre-wrap rounded-xl border border-[#d81b60]/25 bg-[#d81b60]/10 px-3 py-2 font-sans text-sm text-[#9f1239]"
          role="alert"
        >
          {error}
        </pre>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start">
        <aside
          className={`space-y-3 lg:sticky lg:top-[4.75rem] ${
            mobileReview ? "hidden lg:block" : "block"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#3e2723]">
              Waiting
              <span className="ml-2 rounded-full bg-[#fff6df] px-2 py-0.5 text-xs font-bold text-[#8a6500]">
                {requests.length}
              </span>
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or mobile"
            className="field"
            aria-label="Search pending requests"
          />
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-0.5 lg:max-h-[calc(100vh-12rem)]">
            {listLoading ? (
              <li className="rounded-2xl border border-[#3e2723]/10 bg-white px-4 py-6 text-sm text-[#3e2723]/50">
                Loading requests…
              </li>
            ) : filtered.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-[#3e2723]/15 bg-white px-4 py-6 text-sm text-[#3e2723]/55">
                {requests.length === 0
                  ? "All caught up — no one is waiting."
                  : "No names match that search."}
              </li>
            ) : (
              filtered.map((r) => {
                const active = selectedId === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => void loadDetail(r.id)}
                      className={`w-full rounded-2xl border p-3.5 text-left shadow-sm transition ${
                        active
                          ? "border-[#2aa7ad] bg-[#2aa7ad]/8 ring-1 ring-[#2aa7ad]/30"
                          : "border-[#3e2723]/10 bg-white hover:border-[#2aa7ad]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[#3e2723]">{r.name}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusChipClass(
                            r.verification_status,
                          )}`}
                        >
                          {verificationStatusLabel(
                            r.verification_status as VerificationStatus,
                          )}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-[#3e2723]/60">
                        {r.mobile_number}
                      </p>
                      <p className="mt-1 text-xs text-[#3e2723]/45">
                        {relativeTime(r.verification_submitted_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <CheckDot ok={Boolean(r.has_front)} label="Front" />
                        <CheckDot ok={Boolean(r.has_back)} label="Back" />
                        <CheckDot ok={r.has_aadhaar} label="Aadhaar" />
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section
          className={`min-w-0 rounded-2xl border border-[#3e2723]/10 bg-white shadow-sm ${
            mobileReview ? "block" : "hidden lg:block"
          }`}
        >
          {!selectedId && !detailLoading ? (
            <div className="px-5 py-16 text-center">
              <p className="font-semibold text-[#3e2723]">Select a player</p>
              <p className="mt-1 text-sm text-[#3e2723]/55">
                Tap a name on the left to review their Aadhaar photos.
              </p>
            </div>
          ) : detailLoading && !detail ? (
            <p className="px-5 py-16 text-center text-sm text-[#3e2723]/55">
              Opening request…
            </p>
          ) : detail ? (
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMobileReview(false)}
                  className="text-sm font-semibold text-[#1a7f84] lg:hidden"
                >
                  ← Queue
                </button>
                {!inQueue ? (
                  <p className="rounded-full bg-[#3e2723]/8 px-2.5 py-1 text-xs font-semibold text-[#3e2723]/60">
                    Not in the waiting list
                  </p>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#3e2723]">
                    {detail.user.name}
                  </h2>
                  <p className="mt-1 text-sm text-[#3e2723]/65">
                    {detail.user.mobile_number}
                    {detail.player ? (
                      <>
                        {" · "}
                        Player ID {detail.player.public_code}
                      </>
                    ) : null}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusChipClass(
                    detail.user.verification_status,
                  )}`}
                >
                  {verificationStatusLabel(
                    detail.user.verification_status as VerificationStatus,
                  )}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#3e2723]/50">
                <span>
                  Submitted {relativeTime(detail.user.verification_submitted_at)}
                </span>
                {detail.user.verification_reviewed_by_name ? (
                  <span>
                    Last reviewed by {detail.user.verification_reviewed_by_name}
                  </span>
                ) : null}
              </div>

              {detail.user.verification_status === "rejected" &&
              detail.user.verification_rejection_reason ? (
                <p className="mt-3 rounded-xl border border-[#d81b60]/20 bg-[#d81b60]/8 px-3 py-2 text-sm text-[#9f1239]">
                  Last rejection: {detail.user.verification_rejection_reason}
                </p>
              ) : null}

              <div className="mt-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#3e2723]">
                    1. Check Aadhaar photos
                  </h3>
                  {reviewStatus !== "verified" ? (
                    <span className="text-xs text-[#3e2723]/45">
                      Tap a photo to enlarge
                    </span>
                  ) : null}
                </div>
                {reviewStatus === "verified" ? (
                  <p className="mt-2 rounded-xl border border-[#2aa7ad]/20 bg-[#2aa7ad]/8 px-3 py-2 text-sm text-[#1a7f84]">
                    Aadhaar photos were permanently deleted after verification.
                    Only the Aadhaar number is kept.
                  </p>
                ) : (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {(["aadhaar_front", "aadhaar_back"] as const).map((type) => {
                    const doc = detail.documents.find((d) => d.doc_type === type);
                    const label = type === "aadhaar_front" ? "Front" : "Back";
                    const ready = Boolean(doc?.signed_url);
                    return (
                      <div
                        key={type}
                        className={`overflow-hidden rounded-xl border ${
                          ready
                            ? "border-[#3e2723]/10"
                            : "border-dashed border-[#d81b60]/30"
                        } bg-[#fdf6e8]`}
                      >
                        <div className="flex items-center justify-between px-3 pt-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#3e2723]/55">
                            {label}
                          </p>
                          <CheckDot ok={ready} label={ready ? "Uploaded" : "Missing"} />
                        </div>
                        {doc?.signed_url ? (
                          <a
                            href={doc.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                            title="Open full size"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={doc.signed_url}
                              alt={`Aadhaar ${label.toLowerCase()}`}
                              className="mt-2 h-56 w-full bg-white object-contain"
                            />
                          </a>
                        ) : (
                          <p className="mt-2 flex h-56 items-center justify-center px-3 text-center text-sm text-[#9f1239]/70">
                            Player has not uploaded this side yet
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
                {!hasFront || !hasBack ? (
                  reviewStatus === "pending" ? (
                    <p className="mt-2 text-xs text-[#9f1239]">
                      Both photos should be present before you verify.
                    </p>
                  ) : null
                ) : null}
              </div>

              <div className="mt-6 rounded-xl border border-[#3e2723]/10 bg-[#fdf6e8]/80 p-4">
                <h3 className="text-sm font-semibold text-[#3e2723]">
                  2. Match the number and player details
                </h3>
                <p className="mt-1 text-xs text-[#3e2723]/50">
                  Compare the Aadhaar number with the photos. Correct the name
                  if it does not match.
                </p>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-sm text-[#3e2723]/70">
                      Full name
                    </span>
                    <input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="field bg-white"
                      maxLength={80}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm text-[#3e2723]/70">
                        Playing role
                      </span>
                      <select
                        value={roleInput}
                        onChange={(e) =>
                          setRoleInput(e.target.value as PlayerRole | "")
                        }
                        className="field-select bg-white"
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
                        value={tshirtInput}
                        onChange={(e) =>
                          setTshirtInput(e.target.value as TshirtSize | "")
                        }
                        className="field-select bg-white"
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
                      Aadhaar number
                    </span>
                    <input
                      value={aadhaarInput}
                      onChange={(e) =>
                        setAadhaarInput(formatAadhaarInput(e.target.value))
                      }
                      inputMode="numeric"
                      placeholder="XXXX-XXXX-XXXX"
                      maxLength={14}
                      className="field bg-white tracking-[0.18em]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveDetails()}
                    className="rounded-full border border-[#2aa7ad]/40 bg-white px-4 py-2 text-sm font-semibold text-[#1a7f84] disabled:opacity-50"
                  >
                    Save details only
                  </button>
                </div>
              </div>

              {canApprove || canReject || canRevoke ? (
              <div className="mt-6 rounded-xl border border-[#3e2723]/10 p-4">
                {reviewStatus === "verified" ? (
                  <>
                    <p className="rounded-xl border border-[#2aa7ad]/25 bg-[#2aa7ad]/10 px-3 py-2 text-sm text-[#1a7f84]">
                      This player is already verified. Aadhaar photos were
                      deleted. You can still update their details above, or
                      revoke verification if it was a mistake.
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide("revoke", false)}
                        className="text-xs font-medium text-[#3e2723]/45 underline-offset-2 hover:text-[#3e2723] hover:underline disabled:opacity-50"
                      >
                        Revoke verification
                      </button>
                      {pendingForceRevoke ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void decide("revoke", true)}
                          className="ml-3 rounded-full bg-[#3e2723] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Confirm revoke (keep team history)
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-[#3e2723]">
                      3. Decide
                    </h3>
                    {canReject ? (
                      <label className="mt-3 block">
                        <span className="mb-1 block text-sm text-[#3e2723]/70">
                          Rejection reason{" "}
                          <span className="font-normal text-[#3e2723]/45">
                            (needed if you reject)
                          </span>
                        </span>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl border border-[#3e2723]/15 px-3 py-2 text-sm"
                          placeholder="Photos unclear, name does not match, Aadhaar number wrong…"
                        />
                      </label>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canApprove ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void decide("verify")}
                          className="rounded-full bg-[#2aa7ad] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {busy ? "Working…" : "Approve player"}
                        </button>
                      ) : null}
                      {canReject ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void decide("reject")}
                          className="rounded-full border border-[#d81b60]/40 px-5 py-2.5 text-sm font-semibold text-[#d81b60] disabled:opacity-50"
                        >
                          Reject
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
              ) : null}

              {detail.history?.length ? (
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-semibold text-[#3e2723]">
                    Activity ({detail.history.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {detail.history.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-lg bg-[#fdf6e8] px-3 py-2 text-xs text-[#3e2723]/75"
                      >
                        <span className="font-medium">
                          {historyLabel(h.action, h.summary)}
                        </span>
                        <span className="mt-0.5 block text-[#3e2723]/45">
                          {new Date(h.created_at).toLocaleString("en-IN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
