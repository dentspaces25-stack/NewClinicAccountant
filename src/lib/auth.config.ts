import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config (no Node.js-only imports like bcrypt or prisma).
 * Used by middleware for JWT session checking.
 * The full config with credentials provider is in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Providers added in auth.ts (not needed for middleware JWT check)
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const publicPaths = ["/login", "/register"];
      const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));
      const isApiAuth = pathname.startsWith("/api/auth");

      // Allow API auth routes always
      if (isApiAuth) return true;

      // Public paths: redirect logged-in users to dashboard
      if (isPublicPath) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Protected routes: require login
      if (!isLoggedIn) return false; // NextAuth redirects to signIn page

      // Admin routes: check role
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        const role = (auth?.user as { role?: string })?.role;
        if (role !== "ADMIN") {
          return Response.redirect(new URL("/", nextUrl));
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.phone = (user as { phone: string }).phone;
        token.role = (user as { role: "DOCTOR" | "ADMIN" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as { id: string }).id = token.id as string;
      (session.user as { phone: string }).phone = token.phone as string;
      (session.user as { role: string }).role = token.role as string;
      return session;
    },
  },
};
