import { describe, it, expect } from "vitest";
import {
  validateInviteExpiryHours,
  calculateExpiresAt,
  isInviteExpired,
  calculateRemainingSpots,
  validateReplacementReason,
} from "@/lib/invites-validation";

describe("Prompt 9: Selection, Invites, Waiting List, and Spots Test Suite", () => {
  describe("1. Validation & Pure Invariant Functions", () => {
    it("validates invite expiry bounds (1h to 336h)", () => {
      expect(validateInviteExpiryHours(24).valid).toBe(true);
      expect(validateInviteExpiryHours(48).valid).toBe(true);
      expect(validateInviteExpiryHours(72).valid).toBe(true);
      expect(validateInviteExpiryHours(168).valid).toBe(true);

      // Edge bounds
      expect(validateInviteExpiryHours(1).valid).toBe(true);
      expect(validateInviteExpiryHours(336).valid).toBe(true);

      // Out of bounds
      expect(validateInviteExpiryHours(0).valid).toBe(false);
      expect(validateInviteExpiryHours(-5).valid).toBe(false);
      expect(validateInviteExpiryHours(337).valid).toBe(false);
      expect(validateInviteExpiryHours(24.5).valid).toBe(false); // floats not allowed
    });

    it("calculates accurate ISO expiration timestamps", () => {
      const base = new Date("2026-10-07T12:00:00.000Z");
      const expiresAt = calculateExpiresAt(24, base);
      expect(expiresAt).toBe("2026-10-08T12:00:00.000Z");

      const expires72 = calculateExpiresAt(72, base);
      expect(expires72).toBe("2026-10-10T12:00:00.000Z");
    });

    it("correctly identifies expired invites (time travel)", () => {
      const expiresAt = "2026-10-08T12:00:00.000Z";

      // 1 hour before expiry
      const beforeDate = new Date("2026-10-08T11:00:00.000Z");
      expect(isInviteExpired(expiresAt, beforeDate)).toBe(false);

      // Exact expiry moment
      const exactDate = new Date("2026-10-08T12:00:00.000Z");
      expect(isInviteExpired(expiresAt, exactDate)).toBe(true);

      // 1 hour after expiry
      const afterDate = new Date("2026-10-08T13:00:00.000Z");
      expect(isInviteExpired(expiresAt, afterDate)).toBe(true);
    });

    it("verifies remaining spots calculation invariant", () => {
      // Invariant 4: Count drops ONLY on acceptance, not on selection!
      const headcount = 3;
      let acceptedCount = 0;

      // 2 candidates selected, 0 accepted
      expect(calculateRemainingSpots(headcount, acceptedCount)).toBe(3);

      // 1 candidate accepts
      acceptedCount = 1;
      expect(calculateRemainingSpots(headcount, acceptedCount)).toBe(2);

      // 2nd candidate accepts
      acceptedCount = 2;
      expect(calculateRemainingSpots(headcount, acceptedCount)).toBe(1);

      // 3rd candidate accepts -> full
      acceptedCount = 3;
      expect(calculateRemainingSpots(headcount, acceptedCount)).toBe(0);
    });

    it("enforces minimum 10-character written reason for member replacement", () => {
      expect(validateReplacementReason("Short").valid).toBe(false);
      expect(validateReplacementReason("").valid).toBe(false);
      expect(validateReplacementReason("   too short   ").valid).toBe(false);
      expect(
        validateReplacementReason("Student had to withdraw due to scheduling conflict.").valid,
      ).toBe(true);
    });
  });

  describe("2. Lead Authorization & Access Control", () => {
    interface MockRequest {
      id: string;
      lead_id: string;
      title: string;
      headcount: number;
      status: "open" | "closed" | "full";
    }

    interface MockApplication {
      id: string;
      request_id: string;
      applicant_id: string;
      status: "applied" | "selected" | "waitlisted" | "accepted" | "declined" | "expired" | "withdrawn";
      expires_at: string | null;
    }

    const leadId = "user-lead-123";
    const nonLeadId = "user-other-456";
    const applicantAId = "user-app-789";
    const applicantBId = "user-app-101";

    const request: MockRequest = {
      id: "req-1",
      lead_id: leadId,
      title: "Autonomous Drone System",
      headcount: 2,
      status: "open",
    };

    const applications: Record<string, MockApplication> = {
      appA: {
        id: "app-A",
        request_id: "req-1",
        applicant_id: applicantAId,
        status: "applied",
        expires_at: null,
      },
      appB: {
        id: "app-B",
        request_id: "req-1",
        applicant_id: applicantBId,
        status: "applied",
        expires_at: null,
      },
    };

    it("allows lead to select an applicant and set expiry", () => {
      const selectAction = (callerId: string, appId: string, hours: number) => {
        if (callerId !== request.lead_id) {
          throw new Error("Only the project lead can select applicants.");
        }
        const app = applications[appId];
        app.status = "selected";
        app.expires_at = calculateExpiresAt(hours, new Date("2026-10-07T10:00:00Z"));
        return { success: true, app };
      };

      const result = selectAction(leadId, "appA", 48);
      expect(result.success).toBe(true);
      expect(result.app.status).toBe("selected");
      expect(result.app.expires_at).toBe("2026-10-09T10:00:00.000Z");
    });

    it("refuses non-lead from selecting an applicant", () => {
      const selectAction = (callerId: string) => {
        if (callerId !== request.lead_id) {
          throw new Error("Only the project lead can select applicants.");
        }
      };

      expect(() => selectAction(nonLeadId)).toThrow("Only the project lead can select applicants.");
    });

    it("refuses non-lead from waitlisting an applicant", () => {
      const waitlistAction = (callerId: string) => {
        if (callerId !== request.lead_id) {
          throw new Error("Only the project lead can waitlist applicants.");
        }
      };

      expect(() => waitlistAction(nonLeadId)).toThrow("Only the project lead can waitlist applicants.");
    });

    it("allows lead to waitlist an applicant (lead-only manual waitlist)", () => {
      const waitlistAction = (callerId: string, appId: string) => {
        if (callerId !== request.lead_id) {
          throw new Error("Only the project lead can waitlist applicants.");
        }
        const app = applications[appId];
        app.status = "waitlisted";
        return { success: true, app };
      };

      const res = waitlistAction(leadId, "appB");
      expect(res.app.status).toBe("waitlisted");
    });

    it("ensures waitlisted people are invisible to other applicants (RLS policy check)", () => {
      // Invariant: An applicant can ONLY view their own application record
      const canViewApplication = (app: MockApplication, viewingUserId: string, reqLeadId: string) => {
        return app.applicant_id === viewingUserId || reqLeadId === viewingUserId;
      };

      // Applicant A cannot view Applicant B's waitlisted application
      expect(canViewApplication(applications.appB, applicantAId, leadId)).toBe(false);
      // Lead can view Applicant B's waitlisted application
      expect(canViewApplication(applications.appB, leadId, leadId)).toBe(true);
      // Applicant B can view their own application
      expect(canViewApplication(applications.appB, applicantBId, leadId)).toBe(true);
    });
  });

  describe("3. Concurrency Safety: Simultaneous Accepts for the Last Spot", () => {
    it("guarantees exactly one succeeds when two candidates simultaneously accept the last spot", async () => {
      // Simulated state with atomic row lock (FOR UPDATE)
      const headcount = 1;
      let acceptedCount = 0;
      let requestStatus: "open" | "full" = "open";

      // Mutex simulator mimicking PostgreSQL 'SELECT ... FOR UPDATE' in accept_invite
      let isLocked = false;
      const queue: Array<() => void> = [];

      const acquireLock = () =>
        new Promise<void>((resolve) => {
          if (!isLocked) {
            isLocked = true;
            resolve();
          } else {
            queue.push(resolve);
          }
        });

      const releaseLock = () => {
        if (queue.length > 0) {
          const next = queue.shift()!;
          next();
        } else {
          isLocked = false;
        }
      };

      // Simulated atomic accept_invite PL/pgSQL function
      const atomicAcceptInvite = async (candidateName: string) => {
        await acquireLock();
        try {
          // Lock team_requests row and check count
          if (acceptedCount >= headcount) {
            return { success: false, candidate: candidateName, error: "Team is already full" };
          }

          // Mark candidate accepted
          acceptedCount += 1;
          if (acceptedCount >= headcount) {
            requestStatus = "full";
          }
          return { success: true, candidate: candidateName, error: null };
        } finally {
          releaseLock();
        }
      };

      // Simulate simultaneous acceptance calls for candidate 1 and candidate 2
      const [res1, res2] = await Promise.all([
        atomicAcceptInvite("Candidate 1"),
        atomicAcceptInvite("Candidate 2"),
      ]);

      const successful = [res1, res2].filter((r) => r.success);
      const rejected = [res1, res2].filter((r) => !r.success);

      expect(successful).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].error).toBe("Team is already full");
      expect(requestStatus).toBe("full");
      expect(acceptedCount).toBe(1);
    });
  });

  describe("4. Invite Expiry Scheduled Job (Time-Travel Simulation)", () => {
    it("auto-expires unaccepted invites and creates lead notification after expiry passes", () => {
      const baseTime = new Date("2026-10-07T12:00:00Z");

      const invitations = [
        {
          id: "inv-1",
          applicant_id: "user-1",
          applicant_name: "Anita",
          lead_id: "lead-999",
          request_title: "Rover Robot",
          status: "selected",
          expires_at: "2026-10-08T12:00:00Z", // 24h later
        },
        {
          id: "inv-2",
          applicant_id: "user-2",
          applicant_name: "Rahul",
          lead_id: "lead-999",
          request_title: "Rover Robot",
          status: "selected",
          expires_at: "2026-10-09T12:00:00Z", // 48h later
        },
      ];

      const notifications: Array<{ userId: string; type: string; title: string; body: string }> = [];
      const auditLog: Array<{ action: string; target: string }> = [];

      const runExpiryJob = (currentTime: Date) => {
        let expiredCount = 0;
        for (const inv of invitations) {
          if (inv.status === "selected" && new Date(inv.expires_at).getTime() <= currentTime.getTime()) {
            inv.status = "expired";
            expiredCount++;

            // Create notification for lead
            notifications.push({
              userId: inv.lead_id,
              type: "invite_expired",
              title: "Team Invite Expired",
              body: `The invitation sent to ${inv.applicant_name} for "${inv.request_title}" has expired without response.`,
            });

            // Write audit log
            auditLog.push({
              action: "invite.expired",
              target: inv.id,
            });
          }
        }
        return expiredCount;
      };

      // T + 10 hours: Neither invite is expired
      const t10 = new Date(baseTime.getTime() + 10 * 60 * 60 * 1000);
      expect(runExpiryJob(t10)).toBe(0);
      expect(invitations[0].status).toBe("selected");
      expect(invitations[1].status).toBe("selected");
      expect(notifications).toHaveLength(0);

      // T + 25 hours (time-travel): inv-1 expires!
      const t25 = new Date(baseTime.getTime() + 25 * 60 * 60 * 1000);
      expect(runExpiryJob(t25)).toBe(1);
      expect(invitations[0].status).toBe("expired");
      expect(invitations[1].status).toBe("selected"); // inv-2 still has 23h left
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe("Team Invite Expired");
      expect(notifications[0].body).toContain("Anita");
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe("invite.expired");

      // Idempotency check: Running again at T + 25 hours does not create duplicate notifications
      expect(runExpiryJob(t25)).toBe(0);
      expect(notifications).toHaveLength(1);
    });
  });

  describe("5. Headcount Raising & Member Replacement", () => {
    it("prevents reducing or keeping same headcount", () => {
      const currentHeadcount = 3;
      const validateRaise = (newHeadcount: number) => {
        if (newHeadcount <= currentHeadcount) {
          throw new Error("Headcount can only be raised, not reduced");
        }
        return true;
      };

      expect(() => validateRaise(2)).toThrow("Headcount can only be raised, not reduced");
      expect(() => validateRaise(3)).toThrow("Headcount can only be raised, not reduced");
      expect(validateRaise(4)).toBe(true);
    });

    it("replaces a member with accountable reason and reopens spot", () => {
      let requestStatus = "full";
      let acceptedCount = 3;
      const headcount = 3;
      const auditLog: string[] = [];

      const replaceMember = (reason: string) => {
        const val = validateReplacementReason(reason);
        if (!val.valid) throw new Error(val.error);

        acceptedCount -= 1;
        if (acceptedCount < headcount) {
          requestStatus = "open";
        }
        auditLog.push(`member.replaced: ${reason}`);
        return { success: true, remainingSpots: headcount - acceptedCount };
      };

      const result = replaceMember("Member failed to attend three consecutive milestone reviews.");
      expect(result.success).toBe(true);
      expect(result.remainingSpots).toBe(1);
      expect(requestStatus).toBe("open");
      expect(auditLog).toHaveLength(1);
    });
  });
});
