import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/auth/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  createTournamentSchema,
  updateTournamentSchema,
} from "@/lib/validations/tournaments";

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
    .from("tournaments")
    .select(
      "id, name, short_name, location, start_date, end_date, registration_open, status, is_active, created_at",
    )
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Could not load tournaments." },
      { status: 500 },
    );
  }

  return NextResponse.json({ tournaments: data ?? [] });
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

  const parsed = createTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return NextResponse.json(
      { error: "End date must be on or after start date." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (input.is_active) {
    const { error: deactivateError } = await admin
      .from("tournaments")
      .update({ is_active: false })
      .eq("is_active", true);
    if (deactivateError) {
      return NextResponse.json(
        { error: "Could not update active tournament." },
        { status: 500 },
      );
    }
  }

  const { data, error } = await admin
    .from("tournaments")
    .insert({
      name: input.name,
      short_name: input.short_name,
      location: input.location,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      registration_open: input.registration_open,
      status: input.status,
      is_active: input.is_active,
    })
    .select(
      "id, name, short_name, location, start_date, end_date, registration_open, status, is_active, created_at",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create tournament." },
      { status: 500 },
    );
  }

  await writeAuditLog({
    actorId: auth.user.id,
    action: "tournament.created",
    entityType: "tournament",
    entityId: data.id,
    newValue: {
      name: data.name,
      is_active: data.is_active,
      registration_open: data.registration_open,
      status: data.status,
    },
  });

  return NextResponse.json({ tournament: data }, { status: 201 });
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

  const parsed = updateTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { tournament_id, ...rest } = parsed.data;
  if (Object.keys(rest).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  if (
    rest.start_date &&
    rest.end_date &&
    rest.end_date < rest.start_date
  ) {
    return NextResponse.json(
      { error: "End date must be on or after start date." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (rest.is_active === true) {
    const { error: deactivateError } = await admin
      .from("tournaments")
      .update({ is_active: false })
      .eq("is_active", true)
      .neq("id", tournament_id);
    if (deactivateError) {
      return NextResponse.json(
        { error: "Could not switch active tournament." },
        { status: 500 },
      );
    }
  }

  const { data, error } = await admin
    .from("tournaments")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("id", tournament_id)
    .select(
      "id, name, short_name, location, start_date, end_date, registration_open, status, is_active, created_at",
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not update tournament." },
      { status: 500 },
    );
  }

  await writeAuditLog({
    actorId: auth.user.id,
    action: "tournament.updated",
    entityType: "tournament",
    entityId: tournament_id,
    newValue: {
      updated_fields: Object.keys(rest),
      is_active: data.is_active,
      registration_open: data.registration_open,
      status: data.status,
    },
  });

  return NextResponse.json({ tournament: data });
}
