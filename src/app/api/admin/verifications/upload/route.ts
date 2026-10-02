import { NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { RestError } from "@/lib/supabase/rest";
import { uploadAdminDocument, type DocType } from "@/lib/verification/service";

async function readUploadFile(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string") return null;
  if (typeof value.arrayBuffer !== "function" || value.size <= 0) return null;
  return {
    bytes: await value.arrayBuffer(),
    mimeType: value.type || "image/jpeg",
  };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!canAccessAdmin(user)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > 5 * 1024 * 1024 + 128_000) {
      return NextResponse.json(
        { error: "Image must be 5 MB or smaller." },
        { status: 413 },
      );
    }

    const form = await request.formData();
    const userId = form.get("user_id");
    const docType = form.get("doc_type");
    const uploaded = await readUploadFile(form.get("file"));
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "User is required." }, { status: 400 });
    }
    if (docType !== "aadhaar_front" && docType !== "aadhaar_back") {
      return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
    }
    if (!uploaded) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    const result = await uploadAdminDocument(
      user!,
      userId,
      docType as DocType,
      uploaded.bytes,
      uploaded.mimeType,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin verification] upload failed:", err);
    const message =
      err instanceof RestError
        ? err.message
        : "Could not upload Aadhaar photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
