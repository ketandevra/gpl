import type { VerificationStatus } from "@/lib/types/database";

/** Client-safe limits (server still re-compresses with sharp). */
export const AADHAAR_MAX_BYTES = 5 * 1024 * 1024;
export const AADHAAR_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function aadhaarDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12);
}

/** Display / input mask: XXXX-XXXX-XXXX */
export function formatAadhaarInput(value: string): string {
  const digits = aadhaarDigits(value);
  const parts = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)].filter(
    Boolean,
  );
  return parts.join("-");
}

export function isValidAadhaarNumber(value: string): boolean {
  return /^[0-9]{12}$/.test(aadhaarDigits(value));
}

/** Mask for display: XXXX-XXXX-1234 */
export function maskAadhaar(aadhaar: string | null | undefined): string | null {
  const digits = aadhaar ? aadhaarDigits(aadhaar) : "";
  if (digits.length !== 12) return null;
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

export function verificationStatusLabel(status: VerificationStatus): string {
  switch (status) {
    case "unverified":
      return "Unverified";
    case "pending":
      return "Pending verification";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function formatUnverifiedPlayers(
  rows: Array<{ public_code: string; name: string; reason?: string }>,
): string {
  const lines = rows.map((r) => {
    const why =
      r.reason === "not_linked"
        ? " (not linked to a verified user)"
        : " (user not verified)";
    return `${r.public_code} — ${r.name}${why}`;
  });
  return [
    "Cannot approve this team.",
    "",
    "The following player(s) are not verified:",
    "",
    ...lines,
    "",
    "Only verified users can be on an approved team.",
  ].join("\n");
}
