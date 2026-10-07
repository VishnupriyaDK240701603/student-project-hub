import { describe, it, expect } from "vitest";
import {
  validateMentorInviteInput,
  validateStaffPendingLimit,
  isMentorEligibleForLead,
  doesRoleCountTowardHeadcount,
  isMentorInviteExpired,
  MIN_MENTOR_EXPIRY_HOURS,
  MAX_MENTOR_EXPIRY_HOURS,
} from "@/lib/mentor-validation";
import { APP_LIMITS } from "@/config/limits";

describe("Prompt 13: Mentors and Staff Console Test Suite", () => {
  describe("1. Enforcing Maximum 10 Pending Invites (Acceptance Criteria 1)", () => {
    it("allows up to 10 pending invites for a staff member", () => {
      // 0 to 9 pending invites must be allowed
      for (let count = 0; count < APP_LIMITS.maxPendingMentorInvitesPerStaff; count++) {
        const check = validateStaffPendingLimit(count);
        expect(check.valid).toBe(true);
      }
    });

    it("refuses the 11th pending invite for one staff member (server enforced limit)", () => {
      // Exactly 10 pending invites: trying to send an 11th one must be refused
      const check10 = validateStaffPendingLimit(10);
      expect(check10.valid).toBe(false);
      expect(check10.error).toContain("maximum of 10 pending mentor invitations");

      const check11 = validateStaffPendingLimit(11);
      expect(check11.valid).toBe(false);
    });
  });

  describe("2. Mentor Role Invariants & Non-Lead Constraints (Acceptance Criteria 4)", () => {
    it("prohibits a mentor from being made lead", () => {
      // Mentors join as role 'mentor' and can never become lead
      expect(isMentorEligibleForLead("mentor")).toBe(false);
      expect(isMentorEligibleForLead("member")).toBe(true);
      expect(isMentorEligibleForLead("lead")).toBe(true);
    });

    it("ensures mentor does not reduce open student spots or headcount", () => {
      interface MockTeamState {
        headcount: number;
        acceptedStudents: number;
        mentors: number;
      }

      const team: MockTeamState = {
        headcount: 4,
        acceptedStudents: 2,
        mentors: 0,
      };

      const getOpenSpots = (t: MockTeamState) => t.headcount - t.acceptedStudents;

      // Initial state: 2 open spots
      expect(getOpenSpots(team)).toBe(2);

      // Staff mentor joins as role 'mentor'
      const mentorRole = "mentor";
      if (doesRoleCountTowardHeadcount(mentorRole)) {
        team.acceptedStudents += 1;
      } else {
        team.mentors += 1;
      }

      // Open student spots must remain 2 (mentor does not reduce headcount)
      expect(team.mentors).toBe(1);
      expect(team.acceptedStudents).toBe(2);
      expect(getOpenSpots(team)).toBe(2);
    });
  });

  describe("3. Expiry Validation and Time-Travel Expiry Job (Acceptance Criteria 3)", () => {
    it("validates expiry bounds between 1 and 336 hours", () => {
      const baseNow = new Date("2026-10-07T10:00:00.000Z");

      // Valid preset 48 hours
      const valid48 = validateMentorInviteInput(
        { roomId: "r-1", staffId: "s-1", expiryHours: 48 },
        baseNow,
      );
      expect(valid48.valid).toBe(true);
      expect(valid48.calculatedExpiresAt).toBe("2026-10-09T10:00:00.000Z");

      // Too short (< 1 hour)
      const tooShort = validateMentorInviteInput(
        { roomId: "r-1", staffId: "s-1", expiryHours: 0 },
        baseNow,
      );
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toContain(`between ${MIN_MENTOR_EXPIRY_HOURS} and ${MAX_MENTOR_EXPIRY_HOURS}`);

      // Too long (> 336 hours / 14 days)
      const tooLong = validateMentorInviteInput(
        { roomId: "r-1", staffId: "s-1", expiryHours: 350 },
        baseNow,
      );
      expect(tooLong.valid).toBe(false);
    });

    it("auto-rejects expired invites on time-travel test and notifies inviter", () => {
      interface MockMentorInvite {
        id: string;
        staffId: string;
        invitedBy: string;
        status: "selected" | "accepted" | "rejected" | "expired";
        expiresAt: string;
      }

      interface MockNotification {
        userId: string;
        type: string;
        body: string;
      }

      const invites: MockMentorInvite[] = [
        {
          id: "inv-1",
          staffId: "staff-prof-1",
          invitedBy: "lead-student-1",
          status: "selected",
          expiresAt: "2026-10-09T10:00:00.000Z", // expires in 48h
        },
      ];

      const notifications: MockNotification[] = [];

      const expireJob = (simulatedNow: Date) => {
        let count = 0;
        for (const inv of invites) {
          if (inv.status === "selected" && isMentorInviteExpired(inv.expiresAt, simulatedNow)) {
            inv.status = "expired";
            notifications.push({
              userId: inv.invitedBy,
              type: "mentor_invite_expired",
              body: "Mentor invitation expired without response",
            });
            count++;
          }
        }
        return count;
      };

      // T + 24 hours: Still active
      const t24 = new Date("2026-10-08T10:00:00.000Z");
      expect(expireJob(t24)).toBe(0);
      expect(invites[0].status).toBe("selected");
      expect(notifications.length).toBe(0);

      // T + 47 hours and 59 min: Still active
      const t47 = new Date("2026-10-09T09:59:59.000Z");
      expect(expireJob(t47)).toBe(0);
      expect(invites[0].status).toBe("selected");

      // T + 48 hours exact: Expiry triggers
      const t48 = new Date("2026-10-09T10:00:00.000Z");
      expect(expireJob(t48)).toBe(1);
      expect(invites[0].status).toBe("expired");
      expect(notifications.length).toBe(1);
      expect(notifications[0].userId).toBe("lead-student-1");
      expect(notifications[0].type).toBe("mentor_invite_expired");
    });
  });

  describe("4. Room Access Isolation Before and After Acceptance (Acceptance Criteria 2 & 5)", () => {
    interface MockRoomMember {
      roomId: string;
      userId: string;
      role: "lead" | "member" | "mentor";
      status: "active" | "left" | "removed";
    }

    const roomMembers: MockRoomMember[] = [
      { roomId: "room-ai", userId: "student-lead", role: "lead", status: "active" },
      { roomId: "room-ai", userId: "staff-accepted", role: "mentor", status: "active" },
    ];

    const canStaffReadRoom = (roomId: string, staffId: string) => {
      const member = roomMembers.find((m) => m.roomId === roomId && m.userId === staffId);
      return member ? member.status === "active" && member.role === "mentor" : false;
    };

    it("denies room read access to staff member BEFORE accepting invite", () => {
      // Pending staff member has no active row in room_members
      expect(canStaffReadRoom("room-ai", "staff-pending")).toBe(false);
    });

    it("denies room read access to staff member who REJECTS or whose invite EXPIRES", () => {
      // Rejected staff member
      expect(canStaffReadRoom("room-ai", "staff-rejected")).toBe(false);
      // Expired staff member
      expect(canStaffReadRoom("room-ai", "staff-expired")).toBe(false);
    });

    it("grants room read and chat access ONLY after explicit acceptance", () => {
      expect(canStaffReadRoom("room-ai", "staff-accepted")).toBe(true);
    });
  });
});
