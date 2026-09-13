import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/auth/audit";
import { hashPin } from "@/lib/auth/pin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  resetPinSchema,
  updateUserSchema,
} from "@/lib/validations/auth";
import { z } from "zod";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }
  return { user: user! };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select(
      "id, name, mobile_number, role, is_active, created_at, last_login_at, locked_until, failed_login_attempts, verification_status",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: "Could not load users." },
      { status: 500 },
    );
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { user_id, ...updates } = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  // Prevent admin from locking themselves out of the last admin account casually
  if (updates.is_active === false && user_id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot disable your own account." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: previous } = await admin
    .from("users")
    .select("id, role, is_active, name")
    .eq("id", user_id)
    .maybeSingle();

  if (!previous) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { data: updated, error } = await admin
    .from("users")
    .update(updates)
    .eq("id", user_id)
    .select("id, name, mobile_number, role, is_active")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "Could not update user." }, { status: 500 });
  }

  await writeAuditLog({
    actorId: auth.user.id,
    action: "user.update",
    entityType: "user",
    entityId: user_id,
    previousValue: previous,
    newValue: updated,
  });

  return NextResponse.json({ user: updated });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const actionSchema = z.object({ action: z.literal("reset_pin") }).and(resetPinSchema);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const pin_hash = await hashPin(parsed.data.new_pin);
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("users")
    .update({
      pin_hash,
      failed_login_attempts: 0,
      locked_until: null,
    })
    .eq("id", parsed.data.user_id)
    .select("id, name, mobile_number")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "Could not reset PIN." }, { status: 500 });
  }

  // Invalidate existing sessions for that user
  await admin.from("sessions").delete().eq("user_id", parsed.data.user_id);

  await writeAuditLog({
    actorId: auth.user.id,
    action: "user.reset_pin",
    entityType: "user",
    entityId: parsed.data.user_id,
  });

  return NextResponse.json({
    ok: true,
    user: updated,
    message: "PIN reset. The user must sign in with the new PIN.",
  });
}
