import { describe, it, expect } from "vitest";
import { calculateGraduationDate, isStudentGraduated } from "./graduation";

describe("Prompt 18: Student Account Lifecycle & Graduation Deactivation", () => {
  describe("Graduation Date Calculation", () => {
    it("computes 30 June of (joining year + 4 years)", () => {
      const gradDate2022 = calculateGraduationDate(2022);
      expect(gradDate2022.getUTCFullYear()).toBe(2026);
      expect(gradDate2022.getUTCMonth()).toBe(5); // June (0-indexed)
      expect(gradDate2022.getUTCDate()).toBe(30);

      const gradDate2024 = calculateGraduationDate(2024);
      expect(gradDate2024.getUTCFullYear()).toBe(2028);
      expect(gradDate2024.getUTCMonth()).toBe(5);
      expect(gradDate2024.getUTCDate()).toBe(30);
    });
  });

  describe("Acceptance Criteria 1: Time-Travel Graduation Test for 2022 Joiner", () => {
    it("does NOT deactivate a 2022 joiner before 30 June 2026", () => {
      // 1 January 2026 (Final year semester)
      const dateJan2026 = new Date("2026-01-15T12:00:00.000Z");
      expect(isStudentGraduated(2022, dateJan2026)).toBe(false);

      // 29 June 2026 (Day before graduation)
      const dateJune29_2026 = new Date("2026-06-29T23:59:59.000Z");
      expect(isStudentGraduated(2022, dateJune29_2026)).toBe(false);
    });

    it("deactivates a 2022 joiner on 30 June 2026 at end of day and thereafter", () => {
      // 30 June 2026 at 23:59:59.999Z
      const gradDate = calculateGraduationDate(2022);
      expect(isStudentGraduated(2022, gradDate)).toBe(true);

      // 1 July 2026 (Post-graduation)
      const dateJuly1_2026 = new Date("2026-07-01T00:00:00.000Z");
      expect(isStudentGraduated(2022, dateJuly1_2026)).toBe(true);

      // 1 October 2026
      const dateOct2026 = new Date("2026-10-01T12:00:00.000Z");
      expect(isStudentGraduated(2022, dateOct2026)).toBe(true);
    });

    it("verifies a 2023 joiner remains active through June 2026 and deactivates on 30 June 2027", () => {
      const dateJune2026 = new Date("2026-06-30T23:59:59.999Z");
      expect(isStudentGraduated(2023, dateJune2026)).toBe(false);

      const dateJune2027 = calculateGraduationDate(2023);
      expect(isStudentGraduated(2023, dateJune2027)).toBe(true);
    });

    it("handles null or undefined admission year gracefully", () => {
      expect(isStudentGraduated(null, new Date())).toBe(false);
      expect(isStudentGraduated(undefined, new Date())).toBe(false);
    });
  });
});
