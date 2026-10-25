import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Kept in sync with SESSION_COOKIE / sessionSecret() in src/lib/auth.ts — that file
// imports next/headers, which the proxy runtime can't use.
const COOKIE = "stm_session";

function secret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET ?? "fallback-dev-secret-change-in-production"
  );
}

export default async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, secret());
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

// `/login` is intentionally excluded.
export const config = {
  matcher: ["/", "/members/:path*", "/check-in/:path*", "/attendance/:path*", "/users/:path*", "/events/:path*"],
};
