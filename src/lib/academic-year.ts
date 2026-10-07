import { collegeConfig } from "../../college.config";

/**
 * Returns the start calendar year of the current academic year.
 * E.g., If current date is October 2026 and academic year starts in June (month 6),
 * the current academic year started in 2026.
 */
export function getCurrentAcademicStartYear(date: Date = new Date()): number {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1; // 1-indexed (1-12)

  if (currentMonth >= collegeConfig.academicYearStartMonth) {
    return currentYear;
  }
  return currentYear - 1;
}

/**
 * Converts a study level (1 for 1st year, 2 for 2nd year, etc.)
 * to the corresponding admission year batch.
 */
export function studyLevelToAdmissionYear(
  level: number,
  referenceDate: Date = new Date(),
): number {
  const startYear = getCurrentAcademicStartYear(referenceDate);
  return startYear - (level - 1);
}

/**
 * Converts an admission year batch into a human-readable study level.
 * E.g., Admission year 2024 in academic year 2026 -> 3rd Year
 */
export function admissionYearToStudyLevel(
  admissionYear: number,
  referenceDate: Date = new Date(),
): number {
  const startYear = getCurrentAcademicStartYear(referenceDate);
  return startYear - admissionYear + 1;
}

/**
 * Human readable label for study level
 */
export function getStudyLevelLabel(level: number): string {
  switch (level) {
    case 1:
      return "1st Year";
    case 2:
      return "2nd Year";
    case 3:
      return "3rd Year";
    case 4:
      return "4th Year (Final)";
    default:
      return `${level}th Year`;
  }
}
