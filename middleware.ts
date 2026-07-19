import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Reachable without a session. Everything else redirects to /login.
const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Where anonymous visitors at "/" go. Self-hosted installs leave this unset
 * (straight to /login). A hosted deployment can point it at a marketing site —
 * same-origin paths (e.g. "/landing" routed to another service by the reverse
 * proxy) or a full URL both work.
 */
const marketingHome = () => process.env.MARKETING_HOME;

/**
 * Optimistic auth gate: fast cookie-presence check only (no DB) — real session
 * validation happens in requireUserId() on every page/action. Memory-mode demo
 * runs without auth entirely.
 */
export function middleware(request: NextRequest) {
  if (process.env.DATA_SOURCE !== "mongodb") return NextResponse.next();

  const { pathname } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);

  if (pathname === "/" && !hasSession) {
    const home = marketingHome() ?? "/login";
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (hasSession) {
      // Signed-in users skip the auth pages — except an authenticated "buy
      // hosted" click, which continues to the hosted checkout (proxy-routed).
      const dest =
        request.nextUrl.searchParams.get("plan") === "hosted" && marketingHome()
          ? "/checkout/start"
          : "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Protect everything except auth endpoints, health, and static assets
  // (`.*\\..*` = any path with a file extension, i.e. public/ files).
  matcher: [
    "/((?!api/auth|api/health|_next/static|_next/image|.*\\..*).*)",
  ],
};
