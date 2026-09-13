"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verificationStatusLabel } from "@/lib/verification/helpers";

type RequestRow = {
  id: string;
  name: string;
  mobile_number: string;
  verification_status: string;
  verification_submitted_at: string | null;
  has_front: boolean;
  has_back: boolean;
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
};

export function AdminVerificationsClient() {
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingForceRevoke, setPendingForceRevoke] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/admin/verifications");
    const data = (await res.json()) as { requests?: RequestRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to load.");
      return;
    }
    setRequests(data.requests ?? []);
  }, []);

  const loadDetail = useCallback(async (userId: string) => {
    setSelectedId(userId);
    setDetail(null);
    setError(null);
    setPendingForceRevoke(false);
    const res = await fetch(
      `/api/admin/verifications?user_id=${encodeURIComponent(userId)}`,
    );
    const data = (await res.json()) as Detail & { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Failed to load detail.");
      return;
    }
    setDetail(data);
    setAadhaarInput(data.user.aadhaar_full ?? "");
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const uid = searchParams.get("user_id");
    if (uid) void loadDetail(uid);
  }, [searchParams, loadDetail]);

  async function decide(
    decision: "verify" | "reject" | "revoke",
    force = false,
  ) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedId,
          decision,
          rejection_reason: rejectReason || null,
          aadhaar_number: aadhaarInput || null,
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
            (data.error ?? "User is on an approved team.") +
              "\n\nConfirm revoke below. Team membership and match history will NOT be removed.",
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
            ? "User verified."
            : decision === "reject"
              ? "User rejected."
              : "Verification revoked."),
      );
      await loadList();
      await loadDetail(selectedId);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAadhaar() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_aadhaar",
          user_id: selectedId,
          aadhaar_number: aadhaarInput,
        }),
      });
      const data = (await res.json()) as { error?: string; masked?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setMessage(`Aadhaar saved (masked: ${data.masked})`);
      await loadDetail(selectedId);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-8 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2aa7ad]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#3e2723]">
        Verification Requests
      </h1>
      <p className="mt-1 text-sm text-[#3e2723]/60">
        Review Aadhaar documents. Images use short-lived signed URLs (private
        storage). Open any user from Users → Verification profile.
      </p>

      {message ? (
        <p className="mt-3 text-sm text-[#1a7f84]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-[#d81b60]/25 bg-[#d81b60]/10 px-3 py-2 font-sans text-sm text-[#9f1239]">
          {error}
        </pre>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ul className="space-y-3">
          {requests.length === 0 ? (
            <li className="rounded-xl border border-dashed border-[#3e2723]/15 px-4 py-6 text-sm text-[#3e2723]/55">
              No pending verification requests.
            </li>
          ) : (
            requests.map((r) => (
              <li
                key={r.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  selectedId === r.id
                    ? "border-[#2aa7ad]"
                    : "border-[#3e2723]/10"
                }`}
              >
                <p className="font-semibold text-[#3e2723]">{r.name}</p>
                <p className="text-sm text-[#3e2723]/60">
                  Mobile: {r.mobile_number}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#8a6500]">
                  Status:{" "}
                  {verificationStatusLabel(r.verification_status as never)}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void loadDetail(r.id)}
                    className="text-sm font-semibold text-[#1a7f84]"
                  >
                    View Aadhaar Documents
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="rounded-2xl border border-[#3e2723]/10 bg-white p-4 shadow-sm">
          {!detail ? (
            <p className="text-sm text-[#3e2723]/55">
              Select a request to review documents.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#2aa7ad]">
                  User Profile
                </p>
                <p className="mt-1 text-lg font-bold text-[#3e2723]">
                  {detail.user.name}
                </p>
                <dl className="mt-3 space-y-1.5 text-sm text-[#3e2723]">
                  <div>
                    <span className="text-[#3e2723]/50">Mobile: </span>
                    {detail.user.mobile_number}
                  </div>
                  {detail.user.preferred_player_role ? (
                    <div>
                      <span className="text-[#3e2723]/50">Role: </span>
                      {detail.user.preferred_player_role.replace("_", "-")}
                    </div>
                  ) : null}
                  {detail.user.tshirt_size ? (
                    <div>
                      <span className="text-[#3e2723]/50">T-shirt: </span>
                      {detail.user.tshirt_size}
                    </div>
                  ) : null}
                  <div>
                    <span className="text-[#3e2723]/50">User ID: </span>
                    <span className="break-all text-xs">{detail.user.id}</span>
                  </div>
                  {detail.player ? (
                    <div>
                      <span className="text-[#3e2723]/50">Player ID: </span>
                      {detail.player.public_code}
                    </div>
                  ) : null}
                  <div>
                    <span className="text-[#3e2723]/50">Verification: </span>
                    <strong>
                      {verificationStatusLabel(
                        detail.user.verification_status as never,
                      ).toUpperCase()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#3e2723]/50">Aadhaar: </span>
                    {detail.user.aadhaar_masked ?? "—"}
                  </div>
                  <div>
                    <span className="text-[#3e2723]/50">Documents: </span>
                    {detail.documents.some((d) => d.doc_type === "aadhaar_front")
                      ? "✓ Front uploaded"
                      : "○ Front missing"}
                    {" · "}
                    {detail.documents.some((d) => d.doc_type === "aadhaar_back")
                      ? "✓ Back uploaded"
                      : "○ Back missing"}
                  </div>
                  {detail.user.verification_reviewed_by_name ? (
                    <div>
                      <span className="text-[#3e2723]/50">Verified by: </span>
                      {detail.user.verification_reviewed_by_name}
                    </div>
                  ) : null}
                  {detail.user.verification_reviewed_at ? (
                    <div>
                      <span className="text-[#3e2723]/50">Reviewed on: </span>
                      {new Date(
                        detail.user.verification_reviewed_at,
                      ).toLocaleString("en-IN")}
                    </div>
                  ) : null}
                  {detail.user.verification_submitted_at ? (
                    <div>
                      <span className="text-[#3e2723]/50">Submitted: </span>
                      {new Date(
                        detail.user.verification_submitted_at,
                      ).toLocaleString("en-IN")}
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {detail.documents.length === 0 ? (
                  <p className="text-sm text-[#3e2723]/55 col-span-2">
                    No documents uploaded yet.
                  </p>
                ) : (
                  detail.documents.map((d) => (
                    <div key={d.doc_type}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#3e2723]/50">
                        {d.doc_type === "aadhaar_front" ? "Front" : "Back"}
                      </p>
                      {d.signed_url ? (
                        <a
                          href={d.signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-xl border border-[#3e2723]/10"
                          title="Open full size"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={d.signed_url}
                            alt={d.doc_type}
                            className="h-48 w-full object-contain bg-[#fdf6e8]"
                          />
                        </a>
                      ) : (
                        <p className="text-sm text-[#9f1239]">Unavailable</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3e2723]">
                  Aadhaar Number
                </label>
                <input
                  value={aadhaarInput}
                  onChange={(e) =>
                    setAadhaarInput(e.target.value.replace(/\D/g, "").slice(0, 12))
                  }
                  placeholder="XXXX XXXX 1234"
                  className="mt-1 w-full rounded-xl border border-[#3e2723]/15 px-3 py-2.5 tracking-widest"
                />
                <p className="mt-1 text-xs text-[#3e2723]/45">
                  Masked display: {detail.user.aadhaar_masked ?? "—"}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveAadhaar()}
                  className="mt-2 rounded-full border border-[#3e2723]/20 px-3 py-1.5 text-sm font-semibold"
                >
                  Save
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#3e2723]">
                  Rejection reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[#3e2723]/15 px-3 py-2 text-sm"
                  placeholder="Aadhaar image is unclear."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide("verify")}
                  className="rounded-full bg-[#2aa7ad] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide("reject")}
                  className="rounded-full border border-[#d81b60]/40 px-4 py-2 text-sm font-semibold text-[#d81b60] disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide("revoke", false)}
                  className="rounded-full border border-[#3e2723]/20 px-4 py-2 text-sm font-semibold text-[#3e2723] disabled:opacity-50"
                >
                  Revoke
                </button>
                {pendingForceRevoke ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide("revoke", true)}
                    className="rounded-full bg-[#3e2723] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Confirm revoke (keep team history)
                  </button>
                ) : null}
              </div>

              {detail.history?.length ? (
                <div>
                  <p className="text-sm font-semibold text-[#3e2723]">
                    Verification history
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {detail.history.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-lg bg-[#fdf6e8] px-3 py-2 text-xs text-[#3e2723]/75"
                      >
                        <span className="font-medium">{h.summary}</span>
                        <span className="mt-0.5 block text-[#3e2723]/45">
                          {new Date(h.created_at).toLocaleString("en-IN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Link
                href="/admin/users"
                className="inline-flex text-sm font-semibold text-[#1a7f84]"
              >
                Back to users
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
