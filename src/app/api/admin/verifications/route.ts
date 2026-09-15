import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  adminDecideVerification,
  adminSaveAadhaar,
  adminSaveUserDetails,
  getAdminVerificationDetail,
  listPendingVerifications,
} from "@/lib/verification/service";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  if (userId) {
    const detail = await getAdminVerificationDetail(userId);
    if (!detail) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json(detail);
  }

  const pending = await listPendingVerifications();
  const { purgeAadhaarDocumentsForVerifiedUsers } = await import(
    "@/lib/verification/storage"
  );
  await purgeAadhaarDocumentsForVerifiedUsers();
  // Strip any residual aadhaar from list
  return NextResponse.json({
    requests: pending.map((p) => ({
      id: p.id,
      name: p.name,
      mobile_number: p.mobile_number,
      verification_status: p.verification_status,
      verification_submitted_at: p.verification_submitted_at,
      has_aadhaar: p.has_aadhaar,
      has_front: p.has_front,
      has_back: p.has_back,
    })),
  });
}

const decideSchema = z.object({
  user_id: z.string().uuid(),
  decision: z.enum(["verify", "reject", "revoke"]),
  rejection_reason: z.string().max(500).optional().nullable(),
  aadhaar_number: z.string().max(20).optional().nullable(),
  force_revoke: z.boolean().optional(),
});

const detailsSchema = z.object({
  user_id: z.string().uuid(),
  action: z.literal("save_details"),
  name: z.string().trim().min(2).max(80),
  preferred_player_role: z.enum(["batsman", "bowler", "all_rounder"]),
  tshirt_size: z.enum(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]),
  aadhaar_number: z.string().max(20).optional().nullable(),
});

const aadhaarSchema = z.object({
  user_id: z.string().uuid(),
  action: z.literal("save_aadhaar"),
  aadhaar_number: z.string().min(12).max(20),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (
    typeof body === "object" &&
    body &&
    "action" in body &&
    (body as { action: string }).action === "save_details"
  ) {
    const parsed = detailsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await adminSaveUserDetails({
      admin: user!,
      userId: parsed.data.user_id,
      name: parsed.data.name,
      preferred_player_role: parsed.data.preferred_player_role,
      tshirt_size: parsed.data.tshirt_size,
      aadhaar_number: parsed.data.aadhaar_number,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  }

  if (
    typeof body === "object" &&
    body &&
    "action" in body &&
    (body as { action: string }).action === "save_aadhaar"
  ) {
    const parsed = aadhaarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }
    const result = await adminSaveAadhaar({
      admin: user!,
      userId: parsed.data.user_id,
      aadhaar_number: parsed.data.aadhaar_number,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  }

  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const result = await adminDecideVerification({
    admin: user!,
    userId: parsed.data.user_id,
    decision: parsed.data.decision,
    rejection_reason: parsed.data.rejection_reason,
    aadhaar_number: parsed.data.aadhaar_number,
    force_revoke: parsed.data.force_revoke,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
