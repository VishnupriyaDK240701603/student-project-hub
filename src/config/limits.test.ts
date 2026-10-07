import { describe, it, expect } from "vitest";
import { APP_LIMITS } from "./limits";
import { collegeConfig } from "../../college.config";

describe("College Config & Limits", () => {
  it("has valid college configuration defaults", () => {
    expect(collegeConfig.domain).toBe("rajlakshmi.edu.in");
    expect(collegeConfig.courseYears).toBe(4);
    expect(collegeConfig.graduationMonthDay).toBe("06-30");
  });

  it("validates student email pattern", () => {
    const validStudent = "john.d.22.cse@rajlakshmi.edu.in";
    const invalidStudent = "john.d@gmail.com";
    expect(collegeConfig.patterns.student.test(validStudent)).toBe(true);
    expect(collegeConfig.patterns.student.test(invalidStudent)).toBe(false);
  });

  it("enforces core system limits", () => {
    expect(APP_LIMITS.maxAiQueriesPerUserPerDay).toBe(20);
    expect(APP_LIMITS.maxFileSizeBytes).toBe(10 * 1024 * 1024);
    expect(APP_LIMITS.maxOpenRequestsPerLead).toBe(3);
    expect(APP_LIMITS.maxPendingMentorInvitesPerStaff).toBe(10);
    expect(APP_LIMITS.maxMessagesPerMinute).toBe(30);
  });
});
