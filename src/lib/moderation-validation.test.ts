import { describe, it, expect } from "vitest";
import {
  validateReportInput,
  validateJustificationInput,
  validateAppealInput,
  validateJustificationDeadlineHours,
  MODERATION_LIMITS,
} from "./moderation-validation";

describe("Prompt 17: Moderation Validation Tests", () => {
  describe("validateReportInput", () => {
    it("accepts valid user report", () => {
      const result = validateReportInput({
        target_type: "user",
        target_id: "user-123",
        reason: "Violating community standards by spamming.",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedReason).toContain("Violating community standards");
    });

    it("accepts valid request and message report types", () => {
      expect(
        validateReportInput({
          target_type: "request",
          target_id: "req-1",
          reason: "Inappropriate project request title and content.",
        }).isValid,
      ).toBe(true);

      expect(
        validateReportInput({
          target_type: "message",
          target_id: "msg-1",
          reason: "Harassing message posted in general chat.",
        }).isValid,
      ).toBe(true);
    });

    it("rejects invalid target types", () => {
      const result = validateReportInput({
        target_type: "invalid_type",
        target_id: "123",
        reason: "Valid reason with enough length here.",
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid report target type");
    });

    it("rejects empty target_id", () => {
      const result = validateReportInput({
        target_type: "user",
        target_id: "",
        reason: "Valid reason with enough length here.",
      });
      expect(result.isValid).toBe(false);
    });

    it("rejects reasons below min length (10 chars)", () => {
      const result = validateReportInput({
        target_type: "user",
        target_id: "u-1",
        reason: "too short",
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`at least ${MODERATION_LIMITS.minReasonLength}`);
    });

    it("rejects reasons above max length (1000 chars)", () => {
      const longReason = "a".repeat(MODERATION_LIMITS.maxReasonLength + 1);
      const result = validateReportInput({
        target_type: "user",
        target_id: "u-1",
        reason: longReason,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot exceed");
    });

    it("sanitizes HTML / script tags in reason", () => {
      const result = validateReportInput({
        target_type: "user",
        target_id: "u-1",
        reason: "Abusive user <script>alert('xss')</script> in room.",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedReason).not.toContain("<script>");
    });
  });

  describe("validateJustificationInput", () => {
    it("accepts valid justification", () => {
      const result = validateJustificationInput("I was discussing course material and misunderstood the prompt guidelines.");
      expect(result.isValid).toBe(true);
      expect(result.sanitizedContent).toBeDefined();
    });

    it("rejects justifications under min length", () => {
      const result = validateJustificationInput("short");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`at least ${MODERATION_LIMITS.minJustificationLength}`);
    });

    it("rejects justifications over max length (2000 chars)", () => {
      const result = validateJustificationInput("a".repeat(MODERATION_LIMITS.maxJustificationLength + 1));
      expect(result.isValid).toBe(false);
    });
  });

  describe("validateAppealInput", () => {
    it("accepts valid appeal", () => {
      const result = validateAppealInput("I believe the restriction was applied in error and I have resolved the issue.");
      expect(result.isValid).toBe(true);
    });

    it("rejects short appeals", () => {
      const result = validateAppealInput("Short");
      expect(result.isValid).toBe(false);
    });

    it("rejects oversized appeals (1000 chars)", () => {
      const result = validateAppealInput("a".repeat(MODERATION_LIMITS.maxAppealReasonLength + 1));
      expect(result.isValid).toBe(false);
    });
  });

  describe("validateJustificationDeadlineHours", () => {
    it("accepts valid hours between 24 and 168", () => {
      expect(validateJustificationDeadlineHours(24).isValid).toBe(true);
      expect(validateJustificationDeadlineHours(48).isValid).toBe(true);
      expect(validateJustificationDeadlineHours(168).isValid).toBe(true);
    });

    it("rejects under 24 hours (1 day min)", () => {
      const result = validateJustificationDeadlineHours(12);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at least 24 hours");
    });

    it("rejects over 168 hours (7 days max)", () => {
      const result = validateJustificationDeadlineHours(200);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot exceed 168 hours");
    });
  });
});
