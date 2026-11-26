import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Let Next.js internals, direct APIs, and the home page proceed normally
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check if this request originates from a proxy page
  const referer = request.headers.get("referer") || "";
  const match = referer.match(/\/api\/proxy\/([^\/?#]+)/);
  const targetFromReferer = match ? match[1] : null;
  const targetFromCookie = request.cookies.get("proxy_active_target")?.value;

  const target = targetFromReferer || targetFromCookie;

  if (target) {
    // Transparently rewrite root asset request to the active device proxy
    const proxyUrl = new URL(
      `/api/proxy/${target}${pathname}${request.nextUrl.search}`,
      request.url
    );
    return NextResponse.rewrite(proxyUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
