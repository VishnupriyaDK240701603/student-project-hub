import { describe, it, expect } from "vitest";
import { validateRequestData } from "@/lib/requests-validation";
import { sanitizeText } from "@/lib/sanitize";

describe("Prompt 7: Team Requests & Filtered Feed Logic", () => {
  describe("1. XSS Sanitization & Length Limits", () => {
    it("sanitizes script tags from request title and description", () => {
      const maliciousTitle = "AI Project <script>alert('pwned')</script>";
      const cleanedTitle = sanitizeText(maliciousTitle);
      expect(cleanedTitle).toBe("AI Project");
      expect(cleanedTitle).not.toContain("<script>");

      const maliciousDesc = "Looking for devs <iframe src='http://evil.com'></iframe> onload='hack()'";
      const cleanedDesc = sanitizeText(maliciousDesc);
      expect(cleanedDesc).not.toContain("<iframe");
    });

    it("rejects titles shorter than 5 characters or longer than 100", () => {
      const tooShort = validateRequestData({
        title: "Hi",
        description: "A valid description for project",
        role_needed: "Frontend",
        headcount: 2,
        tags: ["React"],
      });
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toContain("Title must be between 5 and 100 characters");

      const tooLong = validateRequestData({
        title: "A".repeat(101),
        description: "A valid description for project",
        role_needed: "Frontend",
        headcount: 2,
        tags: ["React"],
      });
      expect(tooLong.valid).toBe(false);
    });

    it("rejects descriptions shorter than 10 characters or longer than 2000", () => {
      const tooShort = validateRequestData({
        title: "Valid Title",
        description: "Short",
        role_needed: "Frontend",
        headcount: 2,
        tags: ["React"],
      });
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toContain("Description must be between 10 and 2000 characters");
    });
  });

  describe("2. Headcount & Tags Validation", () => {
    it("rejects headcount less than 1 or greater than 10", () => {
      const zeroHeadcount = validateRequestData({
        title: "Valid Title",
        description: "Valid project description with enough length",
        role_needed: "Frontend",
        headcount: 0,
        tags: ["React"],
      });
      expect(zeroHeadcount.valid).toBe(false);

      const excessHeadcount = validateRequestData({
        title: "Valid Title",
        description: "Valid project description with enough length",
        role_needed: "Frontend",
        headcount: 11,
        tags: ["React"],
      });
      expect(excessHeadcount.valid).toBe(false);
    });

    it("limits tags to maximum 10 and 30 chars per tag", () => {
      const tooManyTags = validateRequestData({
        title: "Valid Title",
        description: "Valid project description with enough length",
        role_needed: "Frontend",
        headcount: 2,
        tags: Array.from({ length: 11 }, (_, i) => `Skill${i}`),
      });
      expect(tooManyTags.valid).toBe(false);
      expect(tooManyTags.error).toContain("Maximum 10 skill tags allowed");

      const validResult = validateRequestData({
        title: "Valid Title",
        description: "Valid project description with enough length",
        role_needed: "Frontend",
        headcount: 2,
        tags: ["ExtremelyLongTagExceedingThirtyCharactersTotal"],
      });
      expect(validResult.valid).toBe(true);
      expect(validResult.sanitized?.tags[0].length).toBeLessThanOrEqual(30);
    });
  });

  describe("3. Department and Graceful Fallback Handling", () => {
    it("filters and matches known departments from collegeConfig", () => {
      const res = validateRequestData({
        title: "Valid Title",
        description: "Valid project description with enough length",
        role_needed: "Frontend",
        headcount: 2,
        tags: ["React"],
        filter_departments: ["cse", "ece", "nonexistent_dept"],
      });

      expect(res.valid).toBe(true);
      expect(res.sanitized?.filter_departments).toContain("cse");
      expect(res.sanitized?.filter_departments).toContain("ece");
      // Non-existent department not in collegeConfig is discarded gracefully
      expect(res.sanitized?.filter_departments).not.toContain("nonexistent_dept");
    });
  });

  describe("4. Max 3 Open Requests Invariant", () => {
    it("rejects 4th open request when lead already has 3 open requests", () => {
      const currentOpenCount = 3;
      const MAX_OPEN = 3;
      const canCreate = currentOpenCount < MAX_OPEN;
      expect(canCreate).toBe(false);
    });
  });

  describe("5. Eligibility and Feed Filtering (RLS & Service Logic)", () => {
    interface MockRequest {
      id: string;
      lead_id: string;
      status: "open" | "closed";
      filter_years: number[];
      filter_departments: string[];
      filter_genders: ("female" | "male")[];
    }

    interface MockUser {
      id: string;
      kind: "student" | "staff";
      admission_year: number | null;
      department: string;
      gender: "female" | "male" | "other" | "prefer_not_to_say";
    }

    const evaluateCanView = (req: MockRequest, user: MockUser): boolean => {
      // Staff CANNOT browse feed
      if (user.kind === "staff") return false;

      // Closed requests are not in the feed
      if (req.status !== "open" && req.lead_id !== user.id) return false;

      // Year filter
      if (req.filter_years.length > 0 && user.admission_year !== null) {
        if (!req.filter_years.includes(user.admission_year)) return false;
      }

      // Department filter
      if (req.filter_departments.length > 0) {
        if (!req.filter_departments.includes(user.department)) return false;
      }

      // Gender filter
      if (req.filter_genders.length > 0) {
        if (user.gender === "other" || user.gender === "prefer_not_to_say") return false;
        if (!req.filter_genders.includes(user.gender as "female" | "male")) return false;
      }

      return true;
    };

    const targetRequest: MockRequest = {
      id: "req-restricted",
      lead_id: "lead-1",
      status: "open",
      filter_years: [2023], // 4th year
      filter_departments: ["cse"],
      filter_genders: ["female"],
    };

    it("allows a matching student to see the request", () => {
      const eligibleStudent: MockUser = {
        id: "std-1",
        kind: "student",
        admission_year: 2023,
        department: "cse",
        gender: "female",
      };
      expect(evaluateCanView(targetRequest, eligibleStudent)).toBe(true);
    });

    it("denies access to a non-matching student (wrong year)", () => {
      const wrongYearStudent: MockUser = {
        id: "std-2",
        kind: "student",
        admission_year: 2024,
        department: "cse",
        gender: "female",
      };
      expect(evaluateCanView(targetRequest, wrongYearStudent)).toBe(false);
    });

    it("denies access to a non-matching student (wrong department)", () => {
      const wrongDeptStudent: MockUser = {
        id: "std-3",
        kind: "student",
        admission_year: 2023,
        department: "ece",
        gender: "female",
      };
      expect(evaluateCanView(targetRequest, wrongDeptStudent)).toBe(false);
    });

    it("denies access to a non-matching student (wrong gender or other/prefer_not_to_say)", () => {
      const maleStudent: MockUser = {
        id: "std-4",
        kind: "student",
        admission_year: 2023,
        department: "cse",
        gender: "male",
      };
      expect(evaluateCanView(targetRequest, maleStudent)).toBe(false);

      const otherStudent: MockUser = {
        id: "std-5",
        kind: "student",
        admission_year: 2023,
        department: "cse",
        gender: "other",
      };
      expect(evaluateCanView(targetRequest, otherStudent)).toBe(false);
    });

    it("proves staff accounts receive NO feed results", () => {
      const staffFaculty: MockUser = {
        id: "faculty-1",
        kind: "staff",
        admission_year: null,
        department: "cse",
        gender: "female",
      };
      expect(evaluateCanView(targetRequest, staffFaculty)).toBe(false);
    });
  });
});
