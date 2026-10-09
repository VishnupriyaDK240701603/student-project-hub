import { createClient } from "@supabase/supabase-js";

async function testConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  }

  const supabase = createClient(url, serviceKey);

  console.log("Checking Supabase connectivity...");
  const { data, error } = await supabase.from("profiles").select("count");

  if (error) {
    console.log("Database response (tables likely need creation):", error.message);
  } else {
    console.log("Database connected successfully! Profiles table found.");
  }
}

testConnection();
