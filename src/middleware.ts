import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// The middleware only needs the edge-safe config. Route protection is decided
// by the `authorized` callback in auth.config.ts.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on everything except Next internals, the auth API, and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
