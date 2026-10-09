import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseCollegeEmail } from "@/lib/auth/parse-email";

/**
 * OAuth callback handler.
 * Exchanges the auth code for a session, then redirects to onboarding or home.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const cookiesToForward: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookiesToForward.push({ name, value, options });
            });
          },
        },
      },
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData?.user) {
      const user = sessionData.user;
      const email = (user.email || "").trim().toLowerCase();

      // Enforce strict college domain & email pattern verification
      const parsed = parseCollegeEmail(email);

      // Check if user is an authorized owner or moderator in app_roles
      let isPrivilegedRole = false;
      if (!parsed) {
        const { data: roleRow } = await supabase
          .from("app_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (roleRow?.role === "owner" || roleRow?.role === "moderator") {
          isPrivilegedRole = true;
        }
      }

      // Reject anyone without a valid REC email or authorized role
      if (!parsed && !isPrivilegedRole) {
        console.warn(`[AUTH] Unauthorized sign-in rejected for non-REC account: ${email}`);

        // Terminate the Supabase session immediately
        await supabase.auth.signOut().catch(() => {});

        const res = NextResponse.redirect(
          `${origin}/login?error=unauthorized_domain&email=${encodeURIComponent(email)}`
        );

        // Delete auth cookies in redirect response
        cookieStore.getAll().forEach((c) => {
          if (c.name.startsWith("sb-") || c.name.includes("auth") || c.name.includes("token")) {
            res.cookies.delete(c.name);
          }
        });

        return res;
      }

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, is_blocked, is_deactivated, consent_given_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        const kind = parsed?.kind || "student";
        const admissionYear = parsed?.year ?? (kind === "student" ? 2023 : null);
        const department = parsed?.department || "CSE";
        const displayName =
          user.user_metadata?.full_name ||
          (parsed
            ? `${parsed.name.charAt(0).toUpperCase() + parsed.name.slice(1)}${parsed.initial ? " " + parsed.initial.toUpperCase() : ""}`
            : email.split("@")[0]);

        await supabase.from("profiles").upsert({
          id: user.id,
          email,
          display_name: displayName,
          kind,
          admission_year: admissionYear,
          department,
          gender: "prefer_not_to_say",
          consent_version: "v1.0",
        });

        const res = NextResponse.redirect(`${origin}/onboarding`);
        cookiesToForward.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        return res;
      }

      if (existingProfile.is_blocked || existingProfile.is_deactivated) {
        const res = NextResponse.redirect(`${origin}/blocked`);
        cookiesToForward.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        return res;
      }

      const res = NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
      cookiesToForward.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      return res;
    }

    if (error) {
      console.error("Supabase exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  const errorDesc = searchParams.get("error_description") || searchParams.get("error") || "auth_failed";
  console.warn("Auth callback received error parameter:", errorDesc);
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDesc)}`);
}
