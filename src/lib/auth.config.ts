import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth configuration shared between the middleware and the full
 * Node runtime auth instance. No database or bcrypt imports here.
 */

// Any path under these prefixes requires an authenticated session.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/settings",
  "/leads",
  "/contacts",
  "/companies",
  "/deals",
  "/pipeline",
  "/tasks",
  "/activities",
  "/quotations",
  "/invoices",
  "/payments",
  "/reports",
  "/search",
  "/admin",
];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  trustHost: true,
  providers: [], // real providers are added in ./auth.ts (Node runtime)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(`${p}/`),
      );
      if (isProtected && !isLoggedIn) return false; // -> redirect to /login
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.isSuperAdmin = Boolean(
          (user as { isSuperAdmin?: boolean }).isSuperAdmin,
        );
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
      return session;
    },
  },
} satisfies NextAuthConfig;
