import { createClient } from "@supabase/supabase-js";

async function testConnection() {
  const url = "https://vwfkxwhlopsmbyqgeagz.supabase.co";
  const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Zmt4d2hsb3BzbWJ5cWdlYWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTM1MjY0NiwiZXhwIjoyMTA2OTI4NjQ2fQ.WnXkGNTja2UW4_6IPT8rvoXq-q-5C_BbU_YpDgpQCS0";

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
