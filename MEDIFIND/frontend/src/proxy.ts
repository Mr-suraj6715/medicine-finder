import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getVerifiedRoleFromToken(token?: string): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(payloadBase64);
      const payload = JSON.parse(decoded);
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return null;
      }
      if (payload.role) {
        const r = String(payload.role).toLowerCase().trim();
        if (r === "shop_owner" || r === "shopowner") return "shop_owner";
        if (r === "rider") return "rider";
        return "user";
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const tokenCookie = request.cookies.get("medifind_token")?.value;
    const verifiedRole = getVerifiedRoleFromToken(tokenCookie);
    const roleCookie = request.cookies.get("medifind_role")?.value?.toLowerCase().trim();
    const effectiveRole = verifiedRole || roleCookie;

    const isAuthenticated = !!(tokenCookie && effectiveRole);

    if (pathname.startsWith("/dashboard/shop")) {
      if (!isAuthenticated) {
        const loginUrl = new URL("/", request.url);
        loginUrl.searchParams.set("auth", "login");
        loginUrl.searchParams.set("role", "shop_owner");
        return NextResponse.redirect(loginUrl);
      }
      if (effectiveRole !== "shop_owner") {
        if (effectiveRole === "rider") {
          return NextResponse.redirect(new URL("/dashboard/rider", request.url));
        }
        return NextResponse.redirect(new URL("/dashboard/user", request.url));
      }
    } else if (pathname.startsWith("/dashboard/user")) {
      if (!isAuthenticated) {
        const loginUrl = new URL("/", request.url);
        loginUrl.searchParams.set("auth", "login");
        loginUrl.searchParams.set("role", "user");
        return NextResponse.redirect(loginUrl);
      }
      if (effectiveRole !== "user") {
        if (effectiveRole === "shop_owner") {
          return NextResponse.redirect(new URL("/dashboard/shop", request.url));
        } else if (effectiveRole === "rider") {
          return NextResponse.redirect(new URL("/dashboard/rider", request.url));
        }
      }
    } else if (pathname.startsWith("/dashboard/rider")) {
      if (!isAuthenticated) {
        const loginUrl = new URL("/", request.url);
        loginUrl.searchParams.set("auth", "login");
        loginUrl.searchParams.set("role", "rider");
        return NextResponse.redirect(loginUrl);
      }
      if (effectiveRole !== "rider") {
        if (effectiveRole === "shop_owner") {
          return NextResponse.redirect(new URL("/dashboard/shop", request.url));
        } else if (effectiveRole === "user") {
          return NextResponse.redirect(new URL("/dashboard/user", request.url));
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
