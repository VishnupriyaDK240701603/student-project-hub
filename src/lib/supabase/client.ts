import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://vwfkxwhlopsmbyqgeagz.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Zmt4d2hsb3BzbWJ5cWdlYWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTI2NDYsImV4cCI6MjEwNjkyODY0Nn0.d3sPxfDWwk3xH-0k3eIRqVRlinEAuN2lCnXTDtn8IYw";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
