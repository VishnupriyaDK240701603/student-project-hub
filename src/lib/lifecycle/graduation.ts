import { collegeConfig } from "@/config/college";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Computes the official graduation timestamp (30 June of joining year + courseYears).
 */
export function calculateGraduationDate(admissionYear: number): Date {
  const gradYear = admissionYear + collegeConfig.courseYears;
  const [monthStr, dayStr] = collegeConfig.graduationMonthDay.split("-");
  const month = parseInt(monthStr, 10) - 1; // 0-indexed month (5 for June)
  const day = parseInt(dayStr, 10);
  return new Date(Date.UTC(gradYear, month, day, 23, 59, 59, 999));
}

/**
 * Checks if a student account has passed the graduation deadline as of a given timestamp.
 */
export function isStudentGraduated(admissionYear: number | null | undefined, asOfDate: Date = new Date()): boolean {
  if (!admissionYear || !Number.isInteger(admissionYear)) {
    return false;
  }
  const gradDate = calculateGraduationDate(admissionYear);
  return asOfDate.getTime() >= gradDate.getTime();
}

export interface GraduationJobResult {
  deactivatedCount: number;
  studentIds: string[];
  executedAt: string;
}

/**
 * Scheduled/Cron Job: Idempotently deactivates student accounts past graduation date.
 * Deactivated users cannot sign in; data is preserved.
 */
export async function runGraduationDeactivationJob(asOfDate: Date = new Date()): Promise<GraduationJobResult> {
  const supabase = await createServerSupabaseClient();

  // Find all active students with admission_year
  const { data: students, error } = await supabase
    .from("profiles")
    .select("id, admission_year, is_deactivated")
    .eq("kind", "student")
    .eq("is_deactivated", false)
    .not("admission_year", "is", null);

  if (error || !students) {
    console.error("Graduation job error fetching students:", error);
    return { deactivatedCount: 0, studentIds: [], executedAt: asOfDate.toISOString() };
  }

  const studentsToDeactivate: string[] = [];

  for (const student of students) {
    if (isStudentGraduated(student.admission_year, asOfDate)) {
      studentsToDeactivate.push(student.id);
    }
  }

  if (studentsToDeactivate.length > 0) {
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        is_deactivated: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", studentsToDeactivate);

    if (updateErr) {
      console.error("Graduation job error deactivating accounts:", updateErr);
    } else {
      // Write audit log entry (IDs only)
      await supabase.from("audit_log").insert({
        actor_id: null,
        action: "graduation_lifecycle_deactivation",
        target: "batch:students",
        metadata: {
          count: studentsToDeactivate.length,
          student_ids: studentsToDeactivate,
          as_of_date: asOfDate.toISOString(),
        },
      });
    }
  }

  return {
    deactivatedCount: studentsToDeactivate.length,
    studentIds: studentsToDeactivate,
    executedAt: asOfDate.toISOString(),
  };
}
