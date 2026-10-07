import { NextResponse } from "next/server";
import { parseCollegeEmail } from "@/lib/auth/parse-email";

/**
 * Supabase Auth Hook: before-user-created
 * 
 * Validates that the email belongs to the college domain and matches
 * either the student or staff pattern. Rejects all other emails.
 * 
 * In non-production environments, emails listed in DEMO_ALLOWED_EMAILS
 * are also allowed (they must still match a valid pattern).
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email: string = payload?.record?.email ?? payload?.email ?? "";

    if (!email) {
      return NextResponse.json(
        { error: "No email provided" },
        { status: 400 },
      );
    }

    const appEnv = process.env.APP_ENV ?? "local";
    const demoEmails = (process.env.DEMO_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    // In non-production, allow demo emails (but they must still parse correctly)
    const isDemoAllowed =
      appEnv !== "production" &&
      demoEmails.some((de) => de.toLowerCase() === email.trim().toLowerCase());

    const parsed = parseCollegeEmail(email);

    if (!parsed && !isDemoAllowed) {
      return NextResponse.json(
        {
          error: {
            http_code: 403,
            message: "Only verified college email addresses are permitted to sign in.",
          },
        },
        { status: 403 },
      );
    }

    // If demo allowed but doesn't parse, still reject (must be a valid pattern)
    if (!parsed) {
      return NextResponse.json(
        {
          error: {
            http_code: 403,
            message: "Demo email does not match a valid college email pattern.",
          },
        },
        { status: 403 },
      );
    }

    // Email is valid, allow user creation
    return NextResponse.json({
      user: {
        email: parsed.email,
        user_metadata: {
          display_name: `${parsed.name.charAt(0).toUpperCase() + parsed.name.slice(1)} ${parsed.initial.toUpperCase()}`,
          kind: parsed.kind,
          admission_year: parsed.year,
          department: parsed.department,
        },
      },
    });
  } catch (err) {
    console.error("Auth hook error:", err);
    return NextResponse.json(
      { error: "Internal server error in auth hook" },
      { status: 500 },
    );
  }
}
