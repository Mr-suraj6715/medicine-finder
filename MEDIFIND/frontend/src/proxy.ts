import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const roleCookie = request.cookies.get("medifind_role")?.value;
    const tokenCookie = request.cookies.get("medifind_token")?.value;

    const isAuthenticated = !!(roleCookie && tokenCookie);

    if (pathname.startsWith("/dashboard/shop")) {
      if (!isAuthenticated) {
        const loginUrl = new URL("/", request.url);
        loginUrl.searchParams.set("auth", "login");
        loginUrl.searchParams.set("role", "shop_owner");
        return NextResponse.redirect(loginUrl);
      }
      if (roleCookie !== "shop_owner") {
        if (roleCookie === "rider") {
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
      if (roleCookie !== "user") {
        if (roleCookie === "shop_owner") {
          return NextResponse.redirect(new URL("/dashboard/shop", request.url));
        } else if (roleCookie === "rider") {
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
      if (roleCookie !== "rider") {
        if (roleCookie === "shop_owner") {
          return NextResponse.redirect(new URL("/dashboard/shop", request.url));
        } else if (roleCookie === "user") {
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
