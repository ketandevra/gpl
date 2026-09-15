import "server-only";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import type { PlayerRole, VerificationStatus } from "@/lib/types/database";
import type { TshirtSize } from "@/lib/verification/registration";
import { maskAadhaar } from "@/lib/verification/helpers";
import { createAadhaarSignedUrl } from "@/lib/verification/signed-url";

export type DocType = "aadhaar_front" | "aadhaar_back";

export type VerificationDocRow = {
  id: string;
  user_id: string;
  doc_type: DocType;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
};

export type UserVerificationRow = {
  id: string;
  name: string;
  mobile_number: string;
  verification_status: VerificationStatus;
  aadhaar_number: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_reviewed_by: string | null;
  verification_rejection_reason: string | null;
  preferred_player_role: PlayerRole | null;
  tshirt_size: TshirtSize | null;
  created_at: string;
};

export async function getUserVerification(
  userId: string,
): Promise<UserVerificationRow | null> {
  const rows = await withRetry(() =>
    adminRest<UserVerificationRow[]>("users", {
      query: `?id=eq.${encodeURIComponent(userId)}&select=id,name,mobile_number,verification_status,aadhaar_number,verification_submitted_at,verification_reviewed_at,verification_reviewed_by,verification_rejection_reason,preferred_player_role,tshirt_size,created_at`,
    }),
  );
  return rows[0] ?? null;
}

export async function listVerificationDocuments(
  userId: string,
): Promise<VerificationDocRow[]> {
  return withRetry(() =>
    adminRest<VerificationDocRow[]>("verification_documents", {
      query: `?user_id=eq.${encodeURIComponent(userId)}&select=*&order=doc_type.asc`,
    }),
  );
}

/** Safe payload for the owning user (never returns the full Aadhaar number). */
export async function getOwnVerificationSummary(userId: string) {
  const user = await getUserVerification(userId);
  if (!user) return null;

  // Verified identity: Aadhaar copies must not be retained.
  if (user.verification_status === "verified") {
    const { purgeAadhaarDocumentsForUser } = await import(
      "@/lib/verification/storage"
    );
    await purgeAadhaarDocumentsForUser(userId);
    return {
      status: user.verification_status,
      rejection_reason: user.verification_rejection_reason,
      submitted_at: user.verification_submitted_at,
      reviewed_at: user.verification_reviewed_at,
      preferred_player_role: user.preferred_player_role,
      tshirt_size: user.tshirt_size,
      has_aadhaar: Boolean(user.aadhaar_number),
      aadhaar_masked: maskAadhaar(user.aadhaar_number),
      has_front: false,
      has_back: false,
      front_url: null,
      back_url: null,
      documents_purged: true,
    };
  }

  const docs = await listVerificationDocuments(userId);
  let front_url: string | null = null;
  let back_url: string | null = null;
  for (const doc of docs) {
    const url = await createAadhaarSignedUrl(doc.storage_path, 900);
    if (doc.doc_type === "aadhaar_front") front_url = url;
    if (doc.doc_type === "aadhaar_back") back_url = url;
  }
  return {
    status: user.verification_status,
    rejection_reason: user.verification_rejection_reason,
    submitted_at: user.verification_submitted_at,
    reviewed_at: user.verification_reviewed_at,
    preferred_player_role: user.preferred_player_role,
    tshirt_size: user.tshirt_size,
    has_aadhaar: Boolean(user.aadhaar_number),
    aadhaar_masked: maskAadhaar(user.aadhaar_number),
    has_front: docs.some((d) => d.doc_type === "aadhaar_front"),
    has_back: docs.some((d) => d.doc_type === "aadhaar_back"),
    front_url,
    back_url,
    documents_purged: false,
  };
}
