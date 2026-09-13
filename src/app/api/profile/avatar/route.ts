import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { adminRest, withRetry } from "@/lib/supabase/rest";
import {
  removeUserAvatarFiles,
  uploadUserAvatar,
} from "@/lib/profile/avatar";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 5 * 1024 * 1024 + 128_000) {
    return NextResponse.json(
      { error: "Image must be 5 MB or smaller." },
      { status: 413 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Photo file is required." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const result = await uploadUserAvatar({
    userId: user.id,
    bytes,
    mimeType: file.type || "image/jpeg",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Cache-bust so browsers pick up the new image immediately
  const avatar_url = `${result.url}?v=${Date.now()}`;

  await withRetry(() =>
    adminRest("users", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(user.id)}`,
      prefer: "return=minimal",
      body: { avatar_url },
    }),
  );

  await writeAuditLog({
    actorId: user.id,
    action: "user.avatar_updated",
    entityType: "user",
    entityId: user.id,
    newValue: { updated: true },
  });

  return NextResponse.json({ ok: true, avatar_url });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  await removeUserAvatarFiles(user.id);
  await withRetry(() =>
    adminRest("users", {
      method: "PATCH",
      query: `?id=eq.${encodeURIComponent(user.id)}`,
      prefer: "return=minimal",
      body: { avatar_url: null },
    }),
  );

  await writeAuditLog({
    actorId: user.id,
    action: "user.avatar_removed",
    entityType: "user",
    entityId: user.id,
    newValue: { updated: true },
  });

  return NextResponse.json({ ok: true, avatar_url: null });
}
