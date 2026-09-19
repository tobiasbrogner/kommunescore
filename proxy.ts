import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Dette er kun et BILLIGT, optimistisk tjek ("findes cookien overhovedet").
// Det er bevidst IKKE den autoritative adgangskontrol — proxy kører på hver
// eneste request (også prefetches) og må ikke lave DB-opslag. Den rigtige
// kontrol (er sessionen faktisk gyldig i databasen) sker i
// app/panel/(protected)/layout.tsx og i hver /api/admin/**-route via
// lib/auth/dal.ts / lib/auth/session.ts.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const harCookie = request.cookies.has(SESSION_COOKIE);

  const erBeskyttetSide = pathname.startsWith("/panel") && pathname !== "/panel/login";
  const erBeskyttetApi = pathname.startsWith("/api/admin");

  if (erBeskyttetSide && !harCookie) {
    return NextResponse.redirect(new URL("/panel/login", request.url));
  }

  if (erBeskyttetApi && !harCookie) {
    return NextResponse.json({ fejl: "Ikke logget ind." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*", "/api/admin/:path*"],
};
