import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * OAuth callback handler.
 * Exchanges the auth code for a session, then redirects to onboarding or home.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {
              // Ignore errors from Server Components
            }
          },
        },
      },
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Supabase exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    if (sessionData?.user) {
      const user = sessionData.user;
      const email = user.email || "";

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, is_blocked, is_deactivated, consent_given_at")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        // Auto-create profile for first-time login
        const emailPrefix = email.split("@")[0] || "User";
        const parts = emailPrefix.split(".");
        const displayName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
        const isStaff = parts.length === 3;
        const dept = parts[parts.length - 1]?.toUpperCase() || "CSE";
        const admYear = !isStaff && parts.length >= 3 && /^\d{2}$/.test(parts[2]) ? 2000 + parseInt(parts[2], 10) : 2022;

        await supabase.from("profiles").upsert({
          id: user.id,
          email,
          display_name: user.user_metadata?.full_name || displayName,
          kind: isStaff ? "staff" : "student",
          admission_year: isStaff ? null : admYear,
          department: dept,
          gender: "prefer_not_to_say",
          consent_version: "v1.0",
        });

        return NextResponse.redirect(`${origin}/onboarding`);
      }

      if (existingProfile.is_blocked || existingProfile.is_deactivated) {
        return NextResponse.redirect(`${origin}/blocked`);
      }

      return NextResponse.redirect(origin);
    }
  }

  const errorDesc = searchParams.get("error_description") || searchParams.get("error") || "auth_failed";
  console.warn("Auth callback received error parameter:", errorDesc);
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDesc)}`);
}
