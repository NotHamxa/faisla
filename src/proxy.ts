// Optimistic auth gate: no session cookie → /login (pages) or 401 (API).
// Real verification happens server-side in requireUser()/userOr401().
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE } from "@/lib/auth/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && !isPublic) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "Not signed in" }, { status: 401 });
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
