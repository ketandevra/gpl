import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySessionByToken,
  getCurrentUser,
  getSessionToken,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";

export async function POST() {
  const user = await getCurrentUser();
  const token = await getSessionToken();
  await destroySessionByToken(token);
  await clearSessionCookie();

  if (user) {
    await writeAuditLog({
      actorId: user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
