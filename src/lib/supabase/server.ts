import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://vwfkxwhlopsmbyqgeagz.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Zmt4d2hsb3BzbWJ5cWdlYWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTI2NDYsImV4cCI6MjEwNjkyODY0Nn0.d3sPxfDWwk3xH-0k3eIRqVRlinEAuN2lCnXTDtn8IYw";

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  });
}

export function createAdminSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://vwfkxwhlopsmbyqgeagz.supabase.co";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Zmt4d2hsb3BzbWJ5cWdlYWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTM1MjY0NiwiZXhwIjoyMTA2OTI4NjQ2fQ.WnXkGNTja2UW4_6IPT8rvoXq-q-5C_BbU_YpDgpQCS0";

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
