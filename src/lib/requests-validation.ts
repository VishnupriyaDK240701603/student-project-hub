import { sanitizeText } from "@/lib/sanitize";
import { collegeConfig } from "../../college.config";
import type { GenderEnum } from "@/types/database.types";

export interface CreateRequestInput {
  title: string;
  description: string;
  role_needed: string;
  headcount: number;
  tags: string[];
  filter_years?: number[];
  filter_departments?: string[];
  filter_genders?: GenderEnum[];
  resume_required?: boolean;
}

export interface RequestFeedFilter {
  search?: string;
  department?: string;
  year?: number;
  page?: number;
  limit?: number;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Pure validation function for team request input
 */
export function validateRequestData(input: CreateRequestInput): {
  valid: boolean;
  error?: string;
  sanitized?: CreateRequestInput;
} {
  const sanitizedTitle = sanitizeText(input.title);
  if (!sanitizedTitle || sanitizedTitle.length < 5 || sanitizedTitle.length > 100) {
    return { valid: false, error: "Title must be between 5 and 100 characters." };
  }

  const sanitizedDesc = sanitizeText(input.description);
  if (!sanitizedDesc || sanitizedDesc.length < 10 || sanitizedDesc.length > 2000) {
    return { valid: false, error: "Description must be between 10 and 2000 characters." };
  }

  const sanitizedRole = sanitizeText(input.role_needed);
  if (!sanitizedRole || sanitizedRole.length < 1 || sanitizedRole.length > 100) {
    return { valid: false, error: "Role needed must be between 1 and 100 characters." };
  }

  if (typeof input.headcount !== "number" || input.headcount < 1 || input.headcount > 10) {
    return { valid: false, error: "Headcount must be between 1 and 10." };
  }

  // Validate tags (max 10, max 30 chars each)
  const sanitizedTags: string[] = [];
  if (Array.isArray(input.tags)) {
    if (input.tags.length > 10) {
      return { valid: false, error: "Maximum 10 skill tags allowed." };
    }
    for (const tag of input.tags) {
      const cleanTag = sanitizeText(tag).slice(0, 30);
      if (cleanTag.length > 0 && !sanitizedTags.includes(cleanTag)) {
        sanitizedTags.push(cleanTag);
      }
    }
  }

  // Gracefully filter department codes: keep only valid or configured departments
  const validDepartments: string[] = [];
  if (Array.isArray(input.filter_departments)) {
    for (const dept of input.filter_departments) {
      const cleanDept = dept.trim().toLowerCase();
      if (
        !collegeConfig.departments ||
        Object.keys(collegeConfig.departments).length === 0 ||
        collegeConfig.departments[cleanDept]
      ) {
        if (!validDepartments.includes(cleanDept)) {
          validDepartments.push(cleanDept);
        }
      }
    }
  }

  return {
    valid: true,
    sanitized: {
      title: sanitizedTitle,
      description: sanitizedDesc,
      role_needed: sanitizedRole,
      headcount: input.headcount,
      tags: sanitizedTags,
      filter_years: Array.isArray(input.filter_years) ? input.filter_years : [],
      filter_departments: validDepartments,
      filter_genders: Array.isArray(input.filter_genders) ? input.filter_genders : [],
      resume_required: Boolean(input.resume_required),
    },
  };
}
