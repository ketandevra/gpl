import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOwnVerificationSummary } from "@/lib/verification/queries";
import type { DocType } from "@/lib/verification/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  try {
    const summary = await getOwnVerificationSummary(user.id);
    return NextResponse.json({ verification: summary });
  } catch (err) {
    console.error("[verification] summary failed:", err);
    return NextResponse.json(
      { error: "Could not load verification status." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    }
    if (
      typeof body !== "object" ||
      !body ||
      !("action" in body) ||
      (body as { action: string }).action !== "submit"
    ) {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const raw = body as {
      preferred_player_role?: string;
      tshirt_size?: string;
      aadhaar_number?: string;
    };
    const { submitVerification } = await import("@/lib/verification/service");
    const result = await submitVerification(user, {
      preferred_player_role: (raw.preferred_player_role ?? "") as never,
      tshirt_size: (raw.tshirt_size ?? "") as never,
      aadhaar_number: raw.aadhaar_number ?? "",
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 5 * 1024 * 1024 + 128_000) {
    return NextResponse.json(
      { error: "Image must be 5 MB or smaller." },
      { status: 413 },
    );
  }

  const form = await request.formData();
  const docType = form.get("doc_type");
  const file = form.get("file");
  if (docType !== "aadhaar_front" && docType !== "aadhaar_back") {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const { uploadOwnDocument } = await import("@/lib/verification/service");
  const result = await uploadOwnDocument(
    user,
    docType as DocType,
    bytes,
    file.type || "image/jpeg",
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
