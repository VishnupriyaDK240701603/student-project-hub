import { collegeConfig } from "../../../college.config";

export interface ParsedCollegeEmail {
  kind: "student" | "staff";
  name: string;
  initial: string;
  year: number | null;
  department: string;
  email: string;
}

/**
 * Parses a college email address and extracts structured profile data.
 * 
 * Student format: name.initial.YY.dept@domain (4 segments before @)
 * Staff format:   name.initial.dept@domain    (3 segments before @)
 *
 * Returns null if the email is invalid or does not match college patterns.
 */
export function parseCollegeEmail(email: string): ParsedCollegeEmail | null {
  if (!email || typeof email !== "string") return null;

  const trimmed = email.trim().toLowerCase();

  // Reject plus-addressing (e.g., user+tag@domain)
  if (trimmed.includes("+")) return null;

  // Split local part and domain
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return null;

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  // Validate domain
  if (domain !== collegeConfig.domain) return null;

  // Split local part by dots
  const segments = localPart.split(".");

  // Reject empty segments (consecutive dots, leading/trailing dots)
  if (segments.some((s) => s.length === 0)) return null;

  // Validate each segment contains only alphanumeric characters
  const alphanumericPattern = /^[a-z0-9]+$/;
  if (!segments.every((s) => alphanumericPattern.test(s))) return null;

  if (segments.length === 4) {
    // Student: name.initial.YY.dept
    const [name, initial, yearStr, department] = segments;

    // Validate year is exactly 2 digits
    if (!/^\d{2}$/.test(yearStr)) return null;

    const year = 2000 + parseInt(yearStr, 10);

    return {
      kind: "student",
      name,
      initial,
      year,
      department: department.toUpperCase(),
      email: trimmed,
    };
  } else if (segments.length === 3) {
    // Staff: name.initial.dept
    const [name, initial, department] = segments;

    // Ensure the 3rd segment is NOT purely numeric (that would be ambiguous)
    if (/^\d+$/.test(department)) return null;

    return {
      kind: "staff",
      name,
      initial,
      year: null,
      department: department.toUpperCase(),
      email: trimmed,
    };
  }

  return null;
}

/**
 * Validates whether an email is allowed to sign in.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function validateSignIn(
  email: string,
  appEnv: string = "local",
  demoAllowedEmails: string[] = [],
): { allowed: true; parsed: ParsedCollegeEmail } | { allowed: false; reason: string } {
  const trimmed = email.trim().toLowerCase();

  // In non-production environments, check demo allowed emails
  if (appEnv !== "production" && demoAllowedEmails.length > 0) {
    const demoMatch = demoAllowedEmails.some(
      (demoEmail) => demoEmail.trim().toLowerCase() === trimmed,
    );
    if (demoMatch) {
      const parsed = parseCollegeEmail(trimmed);
      if (parsed) {
        return { allowed: true, parsed };
      }
    }
  }

  const parsed = parseCollegeEmail(trimmed);

  if (!parsed) {
    return { allowed: false, reason: "Email does not match a valid college pattern." };
  }

  return { allowed: true, parsed };
}
