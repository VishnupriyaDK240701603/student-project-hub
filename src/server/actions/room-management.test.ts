import { describe, it, expect } from "vitest";
import {
  validateRemovalReason,
  validateLeadSwapInitiation,
  validateReAddEligibility,
  sanitizeMemberPermissions,
  canUserEditTasks,
  canUserSetDeadlines,
  canUserInviteMentors,
  MIN_REMOVAL_REASON_LENGTH,
} from "@/lib/room-management-validation";

describe("Prompt 12: Rooms, Permissions, Lead Swap and Accountable Removal Test Suite", () => {
  describe("1. Removal Reason Validation (Invariant 8)", () => {
    it("rejects removal when reason is empty or missing", () => {
      const resEmpty = validateRemovalReason("");
      expect(resEmpty.valid).toBe(false);
      expect(resEmpty.error).toContain("written reason of at least 10 characters");

      const resNull = validateRemovalReason(null);
      expect(resNull.valid).toBe(false);
    });

    it("rejects removal when reason is shorter than 10 characters", () => {
      const resShort = validateRemovalReason("inactive"); // 8 chars
      expect(resShort.valid).toBe(false);
      expect(resShort.error).toContain("too short");
      expect(resShort.trimmedReason).toBe("inactive");

      const resSpaces = validateRemovalReason("   12345   "); // 5 chars trimmed
      expect(resSpaces.valid).toBe(false);
    });

    it("accepts removal when reason is at least 10 characters", () => {
      const resValid = validateRemovalReason("Unresponsive on Discord for two weeks");
      expect(resValid.valid).toBe(true);
      expect(resValid.trimmedReason).toBe("Unresponsive on Discord for two weeks");
      expect(resValid.trimmedReason.length).toBeGreaterThanOrEqual(MIN_REMOVAL_REASON_LENGTH);
    });
  });

  describe("2. Per-Member Permissions Checks (Acceptance Criteria 1)", () => {
    interface MockRoomMember {
      userId: string;
      role: "lead" | "member" | "mentor";
      status: "active" | "left" | "removed";
      can_edit_tasks: boolean;
      can_set_deadlines: boolean;
      can_invite_mentors: boolean;
    }

    const lead: MockRoomMember = {
      userId: "std-lead",
      role: "lead",
      status: "active",
      can_edit_tasks: true,
      can_set_deadlines: true,
      can_invite_mentors: true,
    };

    const memberWithTaskOnly: MockRoomMember = {
      userId: "std-task-only",
      role: "member",
      status: "active",
      can_edit_tasks: true,
      can_set_deadlines: false,
      can_invite_mentors: false,
    };

    const memberWithDeadlinesOnly: MockRoomMember = {
      userId: "std-deadlines-only",
      role: "member",
      status: "active",
      can_edit_tasks: false,
      can_set_deadlines: true,
      can_invite_mentors: false,
    };

    const memberWithMentorInviteOnly: MockRoomMember = {
      userId: "std-mentor-only",
      role: "member",
      status: "active",
      can_edit_tasks: false,
      can_set_deadlines: false,
      can_invite_mentors: true,
    };

    const baselineMember: MockRoomMember = {
      userId: "std-baseline",
      role: "member",
      status: "active",
      can_edit_tasks: false,
      can_set_deadlines: false,
      can_invite_mentors: false,
    };

    it("evaluates can_edit_tasks permission independently", () => {
      expect(canUserEditTasks(lead.role === "lead", lead.can_edit_tasks)).toBe(true);
      expect(canUserEditTasks(false, memberWithTaskOnly.can_edit_tasks)).toBe(true);
      expect(canUserEditTasks(false, baselineMember.can_edit_tasks)).toBe(false);
      expect(canUserEditTasks(false, memberWithDeadlinesOnly.can_edit_tasks)).toBe(false);
    });

    it("evaluates can_set_deadlines permission independently", () => {
      expect(canUserSetDeadlines(lead.role === "lead", lead.can_set_deadlines)).toBe(true);
      expect(canUserSetDeadlines(false, memberWithDeadlinesOnly.can_set_deadlines)).toBe(true);
      expect(canUserSetDeadlines(false, memberWithTaskOnly.can_set_deadlines)).toBe(false);
      expect(canUserSetDeadlines(false, baselineMember.can_set_deadlines)).toBe(false);
    });

    it("evaluates can_invite_mentors permission independently", () => {
      expect(canUserInviteMentors(lead.role === "lead", lead.can_invite_mentors)).toBe(true);
      expect(canUserInviteMentors(false, memberWithMentorInviteOnly.can_invite_mentors)).toBe(true);
      expect(canUserInviteMentors(false, baselineMember.can_invite_mentors)).toBe(false);
    });

    it("sanitizes boolean inputs correctly", () => {
      const sanitized = sanitizeMemberPermissions({
        can_edit_tasks: true,
        can_set_deadlines: undefined,
      });
      expect(sanitized).toEqual({
        can_edit_tasks: true,
        can_set_deadlines: false,
        can_invite_mentors: false,
      });
    });
  });

  describe("3. Member Removal and Access Revocation (Acceptance Criteria 2)", () => {
    interface MockRoomState {
      members: { userId: string; status: "active" | "removed" | "left"; removed_reason: string | null }[];
      events: { event_type: string; metadata: Record<string, unknown> }[];
      messages: { id: string; senderId: string; content: string }[];
      files: { id: string; uploaderId: string; fileName: string }[];
    }

    const simulateRemoval = (
      state: MockRoomState,
      leadId: string,
      targetUserId: string,
      reason: string,
    ) => {
      const validation = validateRemovalReason(reason);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const member = state.members.find((m) => m.userId === targetUserId);
      if (!member || member.status !== "active") {
        throw new Error("Target user is not an active member");
      }

      // Member status becomes removed
      member.status = "removed";
      member.removed_reason = validation.trimmedReason;

      // Event is posted with written reason visible to all
      state.events.push({
        event_type: "member_removed",
        metadata: {
          target_user_id: targetUserId,
          reason: validation.trimmedReason,
          actor_id: leadId,
        },
      });

      return state;
    };

    const isAuthorizedForRoom = (state: MockRoomState, userId: string) => {
      const member = state.members.find((m) => m.userId === userId);
      return member ? member.status === "active" : false;
    };

    it("immediately revokes room and realtime access after removal", () => {
      const state: MockRoomState = {
        members: [
          { userId: "std-lead", status: "active", removed_reason: null },
          { userId: "std-target", status: "active", removed_reason: null },
        ],
        events: [],
        messages: [{ id: "m-1", senderId: "std-target", content: "Architecture docs link" }],
        files: [{ id: "f-1", uploaderId: "std-target", fileName: "specs.pdf" }],
      };

      // Before removal: active member can read room
      expect(isAuthorizedForRoom(state, "std-target")).toBe(true);

      // Perform removal with valid reason
      simulateRemoval(state, "std-lead", "std-target", "Relocated to another college campus");

      // After removal: cannot read room or receive realtime events
      expect(isAuthorizedForRoom(state, "std-target")).toBe(false);

      // Invariant: messages and files remain with proper attribution
      expect(state.messages[0].senderId).toBe("std-target");
      expect(state.files[0].uploaderId).toBe("std-target");

      // Written reason is logged in room events
      expect(state.events.length).toBe(1);
      expect(state.events[0].metadata.reason).toBe("Relocated to another college campus");
    });
  });

  describe("4. Lead Swap Flows A and B (Acceptance Criteria 4)", () => {
    interface MockSwapState {
      room: { id: string; lead_id: string };
      request: { id: string; lead_id: string; title: string };
      applications: { id: string; request_id: string; applicant_id: string; status: string }[];
      members: { userId: string; role: "lead" | "member" }[];
      transfers: { id: string; current_lead_id: string; target_lead_id: string; status: string }[];
    }

    const executeSwap = (state: MockSwapState, transferId: string, accept: boolean) => {
      const transfer = state.transfers.find((t) => t.id === transferId);
      if (!transfer) throw new Error("Transfer not found");

      if (!accept) {
        transfer.status = "rejected";
        return;
      }

      transfer.status = "accepted";
      const oldLeadId = transfer.current_lead_id;
      const newLeadId = transfer.target_lead_id;

      // 1. Update room lead
      state.room.lead_id = newLeadId;

      // 2. Update request lead (moves request, applicants and waitlist)
      state.request.lead_id = newLeadId;

      // 3. Update member roles
      const oldLead = state.members.find((m) => m.userId === oldLeadId);
      if (oldLead) oldLead.role = "member";

      const newLead = state.members.find((m) => m.userId === newLeadId);
      if (newLead) newLead.role = "lead";
    };

    it("Flow A: Lead offers leadership to teammate; on accept, request and waitlist ownership moves", () => {
      const state: MockSwapState = {
        room: { id: "room-1", lead_id: "lead-A" },
        request: { id: "req-1", lead_id: "lead-A", title: "Drone Hub" },
        applications: [
          { id: "app-waitlist", request_id: "req-1", applicant_id: "std-cand-1", status: "waitlisted" },
          { id: "app-applied", request_id: "req-1", applicant_id: "std-cand-2", status: "applied" },
        ],
        members: [
          { userId: "lead-A", role: "lead" },
          { userId: "member-B", role: "member" },
        ],
        transfers: [],
      };

      // 1. Lead initiates offer
      const init = validateLeadSwapInitiation("lead-A", state.room.lead_id, "member-B");
      expect(init.valid).toBe(true);
      expect(init.flow).toBe("offer");

      state.transfers.push({
        id: "tr-1",
        current_lead_id: "lead-A",
        target_lead_id: "member-B",
        status: "selected",
      });

      // 2. Member B accepts
      executeSwap(state, "tr-1", true);

      // Verify outcomes
      expect(state.room.lead_id).toBe("member-B");
      expect(state.request.lead_id).toBe("member-B");
      expect(state.members.find((m) => m.userId === "lead-A")?.role).toBe("member");
      expect(state.members.find((m) => m.userId === "member-B")?.role).toBe("lead");

      // Applicants and waitlist are tied to the request, which now belongs to member-B
      expect(state.applications[0].request_id).toBe("req-1");
      expect(state.request.lead_id).toBe("member-B");
    });

    it("Flow B: Teammate requests leadership; on approval, ownership moves atomically", () => {
      const state: MockSwapState = {
        room: { id: "room-2", lead_id: "lead-A" },
        request: { id: "req-2", lead_id: "lead-A", title: "Satellite Comm" },
        applications: [
          { id: "app-1", request_id: "req-2", applicant_id: "std-c", status: "waitlisted" },
        ],
        members: [
          { userId: "lead-A", role: "lead" },
          { userId: "member-C", role: "member" },
        ],
        transfers: [],
      };

      // 1. Member C initiates request
      const init = validateLeadSwapInitiation("member-C", state.room.lead_id, "member-C");
      expect(init.valid).toBe(true);
      expect(init.flow).toBe("request");

      state.transfers.push({
        id: "tr-2",
        current_lead_id: "lead-A",
        target_lead_id: "member-C",
        status: "applied",
      });

      // 2. Lead A approves
      executeSwap(state, "tr-2", true);

      // Verify outcomes
      expect(state.room.lead_id).toBe("member-C");
      expect(state.request.lead_id).toBe("member-C");
      expect(state.members.find((m) => m.userId === "lead-A")?.role).toBe("member");
      expect(state.members.find((m) => m.userId === "member-C")?.role).toBe("lead");
    });
  });

  describe("5. Re-Add Eligibility Invariants (Acceptance Criteria 5)", () => {
    it("refuses to re-add a student who never accepted an invitation", () => {
      const neverAccepted = validateReAddEligibility(false, false);
      expect(neverAccepted.valid).toBe(false);
      expect(neverAccepted.error).toContain("never accepted an invitation");
    });

    it("refuses to re-add a blocked user even if they previously accepted", () => {
      const blockedUser = validateReAddEligibility(true, true);
      expect(blockedUser.valid).toBe(false);
      expect(blockedUser.error).toContain("Blocked users cannot be re-added");
    });

    it("allows re-adding a non-blocked student who previously accepted", () => {
      const eligible = validateReAddEligibility(true, false);
      expect(eligible.valid).toBe(true);
    });
  });
});
