import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { listAuthActivity } from "@/lib/admin/activity";

export async function GET() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const events = await listAuthActivity();
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[admin/activity]", err);
    return NextResponse.json(
      { error: "Could not load activity." },
      { status: 500 },
    );
  }
}
