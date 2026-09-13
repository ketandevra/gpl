import { NextResponse } from "next/server";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/constants";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: APP_SHORT_NAME,
    name: APP_NAME,
  });
}
