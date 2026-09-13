import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { registerWithPin } from "@/lib/auth/service";
import { sessionCookieOptions } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const result = await registerWithPin(parsed.data, request);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({ user: result.user }, { status: 201 });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    result.session.token,
    sessionCookieOptions(result.session.expiresAt),
  );
  return response;
}
