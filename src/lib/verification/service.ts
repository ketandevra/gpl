import "server-only";
import { writeAuditLog } from "@/lib/auth/audit";
import type { SessionUser } from "@/lib/auth/permissions";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { adminRest, RestError, withRetry } from "@/lib/supabase/rest";
import type { PlayerRole, VerificationStatus } from "@/lib/types/database";
import type { TshirtSize } from "@/lib/verification/registration";
import {
  isRegistrationPlayerRole,
  isTshirtSize,
} from "@/lib/verification/registration";
import {
  getOwnVerificationSummary,
  getUserVerification,
  listVerificationDocuments,
  type DocType,
  type UserVerificationRow,
} from "@/lib/verification/queries";
import {
  aadhaarDigits,
  isValidAadhaarNumber,
  maskAadhaar,
} from "@/lib/verification/helpers";
import { getActiveTournament, getPrimaryTournament } from "@/lib/teams/queries";
import type { PlayerRow } from "@/lib/teams/queries";

export {
  getOwnVerificationSummary,
  getUserVerification,
  listVerificationDocuments,
};
export type { DocType, UserVerificationRow, VerificationDocRow } from "@/lib/verification/queries";

async function persistUploadedDocument(params: {
  actorId: string;
  userId: string;
  docType: DocType;
  bytes: ArrayBuffer;
  mimeType: string;
  action: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const { uploadAadhaarDocument } = await import("@/lib/verification/storage");
  const uploaded = await uploadAadhaarDocument({
    userId: params.userId,
    docType: params.docType,
    bytes: params.bytes,
    mimeType: params.mimeType,
  });
  if ("error" in uploaded) {
    return { error: uploaded.error, status: 400 };
  }

  try {
    await withRetry(() =>
      adminRest("verification_documents", {
        method: "DELETE",
        query: `?user_id=eq.${encodeURIComponent(params.userId)}&doc_type=eq.${params.docType}`,
      }),
    );
  } catch {
    // ignore missing row
  }

  try {
    await withRetry(() =>
      adminRest("verification_documents", {
        method: "POST",
        prefer: "return=minimal",
        body: [
          {
            user_id: params.userId,
            doc_type: params.docType,
            storage_path: uploaded.path,
            mime_type: "image/jpeg",
            file_size: uploaded.size,
          },
        ],
      }),
    );
  } catch (err) {
    console.error("[verification] save document row failed:", err);
    return { error: "Could not save Aadhaar photo.", status: 500 };
  }

  await writeAuditLog({
    actorId: params.actorId,
    action: params.action,
    entityType: "user",
    entityId: params.userId,
    newValue: { doc_type: params.docType },
  });

  return { ok: true };
}

export async function uploadOwnDocument(
  user: SessionUser,
  docType: DocType,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  if (user.verification_status === "verified") {
    return {
      error: "Your identity is already verified. Contact admin to change documents.",
      status: 400,
    };
  }

  return persistUploadedDocument({
    actorId: user.id,
    userId: user.id,
    docType,
    bytes,
    mimeType,
    action: "verification.document_uploaded",
  });
}

export async function uploadAdminDocument(
  admin: SessionUser,
  userId: string,
  docType: DocType,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  if (!canAccessAdmin(admin)) {
    return { error: "Forbidden.", status: 403 };
  }

  const target = await getUserVerification(userId);
  if (!target) return { error: "User not found.", status: 404 };
  if (target.verification_status === "verified") {
    return {
      error: "This player is already verified. Revoke first to replace documents.",
      status: 400,
    };
  }

  return persistUploadedDocument({
    actorId: admin.id,
    userId,
    docType,
    bytes,
    mimeType,
    action: "verification.document_uploaded_by_admin",
  });
}

export async function submitVerification(
  user: SessionUser,
  prefs: {
    preferred_player_role: PlayerRole;
    tshirt_size: TshirtSize;
    aadhaar_number: string;
  },
): Promise<{ ok: true } | { error: string; status: number }> {
  if (user.verification_status === "verified") {
    return { error: "Already verified.", status: 400 };
  }
  if (user.verification_status === "pending") {
    return {
      error: "Your registration is already submitted. Wait for admin review.",
      status: 400,
    };
  }

  if (!isRegistrationPlayerRole(prefs.preferred_player_role)) {
    return { error: "Select a playing role.", status: 400 };
  }
  if (!isTshirtSize(prefs.tshirt_size)) {
    return { error: "Select a t-shirt size.", status: 400 };
  }
  const aadhaar = aadhaarDigits(prefs.aadhaar_number);
  if (!isValidAadhaarNumber(aadhaar)) {
    return { error: "Aadhaar number must be 12 digits.", status: 400 };
  }

  const docs = await listVerificationDocuments(user.id);
  const hasFront = docs.some((d) => d.doc_type === "aadhaar_front");
  const hasBack = docs.some((d) => d.doc_type === "aadhaar_back");
  if (!hasFront || !hasBack) {
    return {
      error: "Upload both Aadhaar front and back photos before submitting.",
      status: 400,
    };
  }

  try {
    await withRetry(() =>
      adminRest("users", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(user.id)}`,
        prefer: "return=minimal",
        body: {
          verification_status: "pending" satisfies VerificationStatus,
          verification_submitted_at: new Date().toISOString(),
          verification_rejection_reason: null,
          preferred_player_role: prefs.preferred_player_role,
          tshirt_size: prefs.tshirt_size,
          aadhaar_number: aadhaar,
        },
      }),
    );
  } catch (err) {
    if (err instanceof RestError && (err.status === 409 || /unique|duplicate/i.test(err.message))) {
      return {
        error: "This Aadhaar number is already registered to another user.",
        status: 409,
      };
    }
    throw err;
  }

  await writeAuditLog({
    actorId: user.id,
    action: "verification.submitted",
    entityType: "user",
    entityId: user.id,
    newValue: {
      status: "pending",
      preferred_player_role: prefs.preferred_player_role,
      tshirt_size: prefs.tshirt_size,
    },
  });

  return { ok: true };
}

export async function listPendingVerifications(): Promise<
  Array<
    UserVerificationRow & {
      has_aadhaar: boolean;
      has_front: boolean;
      has_back: boolean;
    }
  >
> {
  const users = await withRetry(() =>
    adminRest<UserVerificationRow[]>("users", {
      query:
        "?verification_status=eq.pending&select=id,name,mobile_number,verification_status,aadhaar_number,verification_submitted_at,verification_reviewed_at,verification_reviewed_by,verification_rejection_reason,created_at&order=verification_submitted_at.asc.nullslast",
    }),
  );

  const docs = users.length
    ? await withRetry(() =>
        adminRest<Array<{ user_id: string; doc_type: string }>>(
          "verification_documents",
          {
            query: `?user_id=in.(${users.map((u) => u.id).join(",")})&select=user_id,doc_type`,
          },
        ),
      )
    : [];
  const docsByUser = new Map<string, Set<string>>();
  for (const doc of docs) {
    const set = docsByUser.get(doc.user_id) ?? new Set<string>();
    set.add(doc.doc_type);
    docsByUser.set(doc.user_id, set);
  }

  return users.map((u) => {
    const types = docsByUser.get(u.id);
    return {
      ...u,
      has_aadhaar: Boolean(u.aadhaar_number),
      has_front: Boolean(types?.has("aadhaar_front")),
      has_back: Boolean(types?.has("aadhaar_back")),
      aadhaar_number: null,
    };
  });
}

export async function getAdminVerificationDetail(userId: string) {
  const user = await getUserVerification(userId);
  if (!user) return null;

  if (user.verification_status === "verified") {
    const { purgeAadhaarDocumentsForUser } = await import(
      "@/lib/verification/storage"
    );
    await purgeAadhaarDocumentsForUser(userId);
  }

  const docs =
    user.verification_status === "verified"
      ? []
      : await listVerificationDocuments(userId);
  const { createAadhaarSignedUrl } = await import(
    "@/lib/verification/signed-url"
  );
  const signed: Record<string, string | null> = {};
  for (const d of docs) {
    signed[d.doc_type] = await createAadhaarSignedUrl(d.storage_path, 1800);
  }

  let player: PlayerRow | null = null;
  const tournament = await getActiveTournament();
  if (tournament) {
    const rows = await withRetry(() =>
      adminRest<PlayerRow[]>("players", {
        query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
      }),
    );
    player = rows[0] ?? null;
  }

  const historyRaw = await withRetry(() =>
    adminRest<
      Array<{
        id: string;
        action: string;
        created_at: string;
        new_value: unknown;
      }>
    >("audit_logs", {
      query: `?entity_type=eq.user&entity_id=eq.${encodeURIComponent(userId)}&select=id,action,created_at,new_value&order=created_at.desc&limit=80`,
    }),
  );
  const history = historyRaw.filter((h) => h.action.startsWith("verification."));

  let reviewerName: string | null = null;
  if (user.verification_reviewed_by) {
    const reviewers = await withRetry(() =>
      adminRest<Array<{ id: string; name: string }>>("users", {
        query: `?id=eq.${encodeURIComponent(user.verification_reviewed_by!)}&select=id,name&limit=1`,
      }),
    );
    reviewerName = reviewers[0]?.name ?? null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      mobile_number: user.mobile_number,
      verification_status: user.verification_status,
      aadhaar_masked: maskAadhaar(user.aadhaar_number),
      aadhaar_full: user.aadhaar_number, // admin-only detail
      verification_submitted_at: user.verification_submitted_at,
      verification_reviewed_at: user.verification_reviewed_at,
      verification_reviewed_by: user.verification_reviewed_by,
      verification_reviewed_by_name: reviewerName,
      verification_rejection_reason: user.verification_rejection_reason,
      preferred_player_role: user.preferred_player_role,
      tshirt_size: user.tshirt_size,
      created_at: user.created_at,
    },
    documents: docs.map((d) => ({
      doc_type: d.doc_type,
      uploaded_at: d.uploaded_at,
      mime_type: d.mime_type,
      file_size: d.file_size,
      signed_url: signed[d.doc_type] ?? null,
      // Never return storage_path to the client
    })),
    documents_purged: user.verification_status === "verified",
    history: history.map((h) => ({
      id: h.id,
      action: h.action,
      created_at: h.created_at,
      // Strip any accidental sensitive payloads — only status flags
      summary:
        typeof h.new_value === "object" && h.new_value && "status" in h.new_value
          ? String((h.new_value as { status: string }).status)
          : h.action.replace(/^verification\./, "").replace(/_/g, " "),
    })),
    player: player
      ? { id: player.id, public_code: player.public_code, name: player.name }
      : null,
  };
}

export async function adminDecideVerification(params: {
  admin: SessionUser;
  userId: string;
  decision: "verify" | "reject" | "revoke";
  rejection_reason?: string | null;
  aadhaar_number?: string | null;
  force_revoke?: boolean;
}): Promise<{ ok: true; warning?: string } | { error: string; status: number }> {
  if (!canAccessAdmin(params.admin)) {
    return { error: "Forbidden.", status: 403 };
  }

  const target = await getUserVerification(params.userId);
  if (!target) return { error: "User not found.", status: 404 };

  if (params.decision === "verify" && target.verification_status === "verified") {
    return { error: "This player is already verified.", status: 400 };
  }
  if (params.decision === "reject" && target.verification_status === "verified") {
    return {
      error: "Revoke verification first if you need to reject this player.",
      status: 400,
    };
  }
  if (params.decision === "revoke" && target.verification_status !== "verified") {
    return { error: "This player is not verified.", status: 400 };
  }

  if (params.decision === "reject") {
    const reason = (params.rejection_reason ?? "").trim();
    if (reason.length < 3) {
      return { error: "Provide a rejection reason.", status: 400 };
    }
    await withRetry(() =>
      adminRest("users", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(params.userId)}`,
        prefer: "return=minimal",
        body: {
          verification_status: "rejected",
          verification_rejection_reason: reason,
          verification_reviewed_at: new Date().toISOString(),
          verification_reviewed_by: params.admin.id,
        },
      }),
    );
    await writeAuditLog({
      actorId: params.admin.id,
      action: "verification.rejected",
      entityType: "user",
      entityId: params.userId,
      newValue: { status: "rejected", has_reason: true },
    });
    return { ok: true };
  }

  if (params.decision === "revoke") {
    // Warn if on approved team — do not auto-remove
    const locked = await withRetry(() =>
      adminRest<Array<{ id: string; public_code: string; locked_team_id: string | null }>>(
        "players",
        {
          query: `?user_id=eq.${encodeURIComponent(params.userId)}&locked_team_id=not.is.null&select=id,public_code,locked_team_id`,
        },
      ),
    );
    if (locked.length && !params.force_revoke) {
      return {
        error: `Warning: this user is linked to approved-team player(s) ${locked
          .map((p) => p.public_code)
          .join(", ")}. Pass force_revoke=true to revoke without removing historical membership.`,
        status: 409,
      };
    }
    await withRetry(() =>
      adminRest("users", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(params.userId)}`,
        prefer: "return=minimal",
        body: {
          verification_status: "unverified",
          verification_rejection_reason:
            params.rejection_reason?.trim() || "Verification revoked by admin",
          verification_reviewed_at: new Date().toISOString(),
          verification_reviewed_by: params.admin.id,
        },
      }),
    );
    await writeAuditLog({
      actorId: params.admin.id,
      action: "verification.revoked",
      entityType: "user",
      entityId: params.userId,
      newValue: {
        status: "unverified",
        had_approved_membership: locked.length > 0,
      },
    });
    return {
      ok: true,
      warning: locked.length
        ? "Verification revoked. Approved team memberships were NOT removed."
        : undefined,
    };
  }

  // verify
  const aadhaar =
    aadhaarDigits(params.aadhaar_number ?? "") || target.aadhaar_number;
  if (!aadhaar || !isValidAadhaarNumber(aadhaar)) {
    return { error: "Aadhaar number must be 12 digits.", status: 400 };
  }

  const docs = await listVerificationDocuments(params.userId);
  const hasFront = docs.some((d) => d.doc_type === "aadhaar_front");
  const hasBack = docs.some((d) => d.doc_type === "aadhaar_back");
  if (!hasFront || !hasBack) {
    return {
      error: "Upload both Aadhaar front and back photos before verifying.",
      status: 400,
    };
  }

  try {
    await withRetry(() =>
      adminRest("users", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(params.userId)}`,
        prefer: "return=minimal",
        body: {
          verification_status: "verified",
          aadhaar_number: aadhaar,
          verification_rejection_reason: null,
          verification_reviewed_at: new Date().toISOString(),
          verification_reviewed_by: params.admin.id,
        },
      }),
    );
  } catch (err) {
    if (err instanceof RestError && (err.status === 409 || /unique|duplicate/i.test(err.message))) {
      return {
        error: "This Aadhaar number is already registered to another user.",
        status: 409,
      };
    }
    throw err;
  }

  if (aadhaar && aadhaar !== target.aadhaar_number) {
    await writeAuditLog({
      actorId: params.admin.id,
      action: target.aadhaar_number
        ? "verification.aadhaar_changed"
        : "verification.aadhaar_added",
      entityType: "user",
      entityId: params.userId,
      newValue: { updated: true },
    });
  }

  await writeAuditLog({
    actorId: params.admin.id,
    action: "verification.approved",
    entityType: "user",
    entityId: params.userId,
    newValue: { status: "verified" },
  });

  // UIDAI: do not retain copies of Aadhaar after identity is established.
  const { purgeAadhaarDocumentsForUser } = await import(
    "@/lib/verification/storage"
  );
  await purgeAadhaarDocumentsForUser(params.userId);
  await writeAuditLog({
    actorId: params.admin.id,
    action: "verification.documents_purged",
    entityType: "user",
    entityId: params.userId,
    newValue: { status: "verified" },
  });

  // Ensure tournament player exists for verified user
  await ensureTournamentPlayerForUser(params.userId);

  return { ok: true };
}

export async function adminSaveAadhaar(params: {
  admin: SessionUser;
  userId: string;
  aadhaar_number: string;
}): Promise<{ ok: true; masked: string } | { error: string; status: number }> {
  if (!canAccessAdmin(params.admin)) {
    return { error: "Forbidden.", status: 403 };
  }
  const digits = aadhaarDigits(params.aadhaar_number);
  if (!isValidAadhaarNumber(digits)) {
    return { error: "Aadhaar number must be 12 digits.", status: 400 };
  }

  const previous = await getUserVerification(params.userId);
  if (!previous) return { error: "User not found.", status: 404 };

  try {
    await withRetry(() =>
      adminRest("users", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(params.userId)}`,
        prefer: "return=minimal",
        body: { aadhaar_number: digits },
      }),
    );
  } catch (err) {
    if (err instanceof RestError && (err.status === 409 || /unique|duplicate/i.test(err.message))) {
      return {
        error: "This Aadhaar number is already registered to another user.",
        status: 409,
      };
    }
    return { error: "Could not save Aadhaar number.", status: 500 };
  }

  await writeAuditLog({
    actorId: params.admin.id,
    action: previous.aadhaar_number
      ? "verification.aadhaar_changed"
      : "verification.aadhaar_added",
    entityType: "user",
    entityId: params.userId,
    newValue: { updated: true },
  });

  return { ok: true, masked: maskAadhaar(digits)! };
}

export async function adminSaveUserDetails(params: {
  admin: SessionUser;
  userId: string;
  name: string;
  preferred_player_role: PlayerRole;
  tshirt_size: TshirtSize;
  aadhaar_number?: string | null;
}): Promise<{ ok: true; masked: string | null } | { error: string; status: number }> {
  if (!canAccessAdmin(params.admin)) {
    return { error: "Forbidden.", status: 403 };
  }

  const name = params.name.trim();
  if (name.length < 2) {
    return { error: "Name must be at least 2 characters.", status: 400 };
  }
  if (!isRegistrationPlayerRole(params.preferred_player_role)) {
    return { error: "Select a playing role.", status: 400 };
  }
  if (!isTshirtSize(params.tshirt_size)) {
    return { error: "Select a t-shirt size.", status: 400 };
  }

  const previous = await getUserVerification(params.userId);
  if (!previous) return { error: "User not found.", status: 404 };

  const body: Record<string, unknown> = {
    name,
    preferred_player_role: params.preferred_player_role,
    tshirt_size: params.tshirt_size,
  };

  const aadhaar = params.aadhaar_number
    ? aadhaarDigits(params.aadhaar_number)
    : "";
  if (aadhaar) {
    if (!isValidAadhaarNumber(aadhaar)) {
      return { error: "Aadhaar number must be 12 digits.", status: 400 };
    }
    body.aadhaar_number = aadhaar;
  }

  try {
    await withRetry(() =>
      adminRest("users", {
        method: "PATCH",
        query: `?id=eq.${encodeURIComponent(params.userId)}`,
        prefer: "return=minimal",
        body,
      }),
    );
  } catch (err) {
    if (err instanceof RestError && (err.status === 409 || /unique|duplicate/i.test(err.message))) {
      return {
        error: "This Aadhaar number is already registered to another user.",
        status: 409,
      };
    }
    return { error: "Could not save user details.", status: 500 };
  }

  try {
    await withRetry(() =>
      adminRest("players", {
        method: "PATCH",
        query: `?user_id=eq.${encodeURIComponent(params.userId)}`,
        prefer: "return=minimal",
        body: {
          name,
          role: params.preferred_player_role,
          tshirt_size: params.tshirt_size,
        },
      }),
    );
  } catch {
    // Player row may not exist yet.
  }

  await writeAuditLog({
    actorId: params.admin.id,
    action: "verification.details_updated",
    entityType: "user",
    entityId: params.userId,
    previousValue: {
      name: previous.name,
      preferred_player_role: previous.preferred_player_role,
      tshirt_size: previous.tshirt_size,
    },
    newValue: {
      name,
      preferred_player_role: params.preferred_player_role,
      tshirt_size: params.tshirt_size,
    },
  });

  return {
    ok: true,
    masked: aadhaar ? maskAadhaar(aadhaar) : maskAadhaar(previous.aadhaar_number),
  };
}

export async function ensureTournamentPlayerForUser(
  userId: string,
): Promise<PlayerRow | null> {
  const tournament = await getPrimaryTournament();
  if (!tournament) return null;

  const existing = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    }),
  );
  if (existing[0]) return existing[0];

  const user = await getUserVerification(userId);
  if (!user || user.verification_status !== "verified") return null;

  const codes = await withRetry(() =>
    adminRest<Array<{ public_code: string }>>("players", {
      query: `?tournament_id=eq.${encodeURIComponent(tournament.id)}&select=public_code&order=public_code.desc&limit=50`,
    }),
  );
  let max = 0;
  for (const row of codes) {
    const m = /^P(\d+)$/i.exec(row.public_code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const public_code = `P${String(max + 1).padStart(3, "0")}`;

  const created = await withRetry(() =>
    adminRest<PlayerRow[]>("players", {
      method: "POST",
      prefer: "return=representation",
      body: [
        {
          tournament_id: tournament.id,
          public_code,
          name: user.name,
          mobile_number: user.mobile_number,
          user_id: userId,
          role: user.preferred_player_role ?? "batsman",
          tshirt_size: user.tshirt_size,
          locked_team_id: null,
        },
      ],
    }),
  );
  return created[0] ?? null;
}
