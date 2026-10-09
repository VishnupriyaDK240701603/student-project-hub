import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseCollegeEmail } from "@/lib/auth/parse-email";

/**
 * Server-side middleware for route protection.
 * 
 * - Refreshes the user's session on every request.
 * - Redirects unauthenticated users to /login on protected routes.
 * - Enforces verified college domain (@rajalakshmi.edu.in).
 * - Redirects blocked/deactivated accounts to /blocked.
 * - Protects /owner and /moderation routes by role.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't need auth
  const publicPaths = [
    "/login",
    "/auth",
    "/blocked",
    "/privacy",
    "/api/auth",
    "/api/health",
    "/_next",
    "/favicon.ico",
    "/manifest.json",
    "/icons",
    "/sw.js",
    "/offline",
    "/design",
  ];
  // If request contains OAuth code, forward to /auth/callback immediately
  if (request.nextUrl.searchParams.has("code") && !pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // If request on public root contains an error parameter, forward to /login
  if (pathname === "/" && request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // If Supabase credentials are not configured, treat user as unauthenticated and redirect to /login
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect unauthenticated users to login
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const email = (user.email || "").trim().toLowerCase();
    const parsed = parseCollegeEmail(email);

    const isOwnerRoute = pathname.startsWith("/owner");
    const isModRoute = pathname.startsWith("/moderation") || pathname.startsWith("/staff/moderator-console");

    // Execute profile status check and role verification concurrently
    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_blocked, is_deactivated")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("app_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const isPrivilegedRole = roleRes.data?.role === "owner" || roleRes.data?.role === "moderator";

    // Non-REC email and not an admin/moderator
    if (!parsed && !isPrivilegedRole) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "unauthorized_domain");
      url.searchParams.set("email", email);
      return NextResponse.redirect(url);
    }

    const profile = profileRes.data;
    if (profile?.is_blocked || profile?.is_deactivated) {
      const url = request.nextUrl.clone();
      url.pathname = "/blocked";
      return NextResponse.redirect(url);
    }

    if (isOwnerRoute && roleRes.data?.role !== "owner") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (isModRoute && roleRes.data?.role !== "moderator") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files, images, icons, manifests, and assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|css|js|woff|woff2|ttf|eot)$).*)",
  ],
};
