import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getOwnVerificationSummary,
  submitVerification,
  uploadOwnDocument,
} from "@/lib/verification/service";
import type { DocType } from "@/lib/verification/storage";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const summary = await getOwnVerificationSummary(user.id);
  return NextResponse.json({ verification: summary });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  // JSON submit
  if (contentType.includes("application/json")) {
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
      (body as { action: string }).action === "submit"
    ) {
      const raw = body as {
        preferred_player_role?: string;
        tshirt_size?: string;
      };
      const result = await submitVerification(user, {
        preferred_player_role: (raw.preferred_player_role ?? "") as never,
        tshirt_size: (raw.tshirt_size ?? "") as never,
      });
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status },
        );
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  // Multipart upload
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
