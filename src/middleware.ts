import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side middleware for route protection.
 * 
 * - Refreshes the user's session on every request.
 * - Redirects unauthenticated users to /login on protected routes.
 * - Redirects blocked/deactivated accounts to /blocked.
 * - Protects /owner and /moderation routes by role.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't need auth
  const publicPaths = [
    "/login",
    "/blocked",
    "/api/auth",
    "/_next",
    "/favicon.ico",
    "/manifest.json",
    "/icons",
    "/sw.js",
    "/offline",
    "/design",
  ];
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

    // Check if user is blocked or deactivated
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_blocked, is_deactivated")
      .eq("id", user.id)
      .single();

    if (profile?.is_blocked || profile?.is_deactivated) {
      const url = request.nextUrl.clone();
      url.pathname = "/blocked";
      return NextResponse.redirect(url);
    }

    // Role-based route protection
    if (pathname.startsWith("/owner")) {
      const { data: ownerRole } = await supabase
        .from("app_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();

      if (!ownerRole) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith("/moderation")) {
      const { data: modRole } = await supabase
        .from("app_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "moderator")
        .single();

      if (!modRole) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
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
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
