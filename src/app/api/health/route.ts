import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  dependencies: {
    database: "connected" | "unreachable";
    ai_service: "configured" | "disabled" | "unconfigured";
    storage: "ready" | "unavailable";
  };
}

const startTime = Date.now();

export async function GET() {
  let dbStatus: "connected" | "unreachable" = "unreachable";
  let storageStatus: "ready" | "unavailable" = "unavailable";

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    if (!error) {
      dbStatus = "connected";
      storageStatus = "ready";
    }
  } catch {
    dbStatus = "unreachable";
    storageStatus = "unavailable";
  }

  const aiEnabled = process.env.AI_ENABLED === "true";
  const hasAiProvider = Boolean(process.env.HF_TOKEN || process.env.GROQ_API_KEY);
  const aiStatus = aiEnabled && hasAiProvider ? "configured" : aiEnabled ? "unconfigured" : "disabled";

  const overallStatus = dbStatus === "connected" ? "healthy" : "degraded";

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || "production",
    dependencies: {
      database: dbStatus,
      ai_service: aiStatus,
      storage: storageStatus,
    },
  };

  return NextResponse.json(response, {
    status: overallStatus === "healthy" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
