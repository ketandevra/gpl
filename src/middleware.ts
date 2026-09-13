import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Protect admin shell — full role check still happens in the admin layout.
  if (pathname.startsWith("/admin") && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/score") && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/verify") && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Do not auto-bounce /login ↔ /profile here (caused confusing “nothing happens”
  // when a stale cookie was present). Pages handle auth state themselves.

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/score/:path*", "/verify", "/login", "/register"],
};
