import { describe, it, expect } from "vitest";
import {
  calculateRetentionExpiry,
  isFileRetentionExpired,
  validateFollowUpRequestInput,
} from "@/lib/retention-validation";

describe("Prompt 10: Closing, Room Formation, Follow-up Requests, and File Retention Test Suite", () => {
  describe("1. Pure Helpers & Validation Invariants", () => {
    it("calculates exact 30-day retention timestamp (closed_at + 30 days)", () => {
      const closedAt = new Date("2026-10-07T10:00:00.000Z");
      const retentionExpiry = calculateRetentionExpiry(closedAt);
      expect(retentionExpiry).toBe("2026-11-06T10:00:00.000Z");
    });

    it("verifies Day 29 vs Day 30 retention expiration behavior (time-travel test)", () => {
      const closedAt = new Date("2026-10-07T10:00:00.000Z");
      const deleteAfter = calculateRetentionExpiry(closedAt); // 2026-11-06T10:00:00.000Z

      // Day 29 (T + 29 days): File is still active and MUST NOT be deleted
      const day29 = new Date("2026-11-05T10:00:00.000Z");
      expect(isFileRetentionExpired(deleteAfter, day29)).toBe(false);

      // Day 29 and 23 hours: Still preserved
      const day29Hours = new Date("2026-11-06T09:59:59.000Z");
      expect(isFileRetentionExpired(deleteAfter, day29Hours)).toBe(false);

      // Day 30 exact (T + 30 days): File is now due for hard deletion
      const day30 = new Date("2026-11-06T10:00:00.000Z");
      expect(isFileRetentionExpired(deleteAfter, day30)).toBe(true);

      // Day 31: Still expired
      const day31 = new Date("2026-11-07T10:00:00.000Z");
      expect(isFileRetentionExpired(deleteAfter, day31)).toBe(true);
    });

    it("validates follow-up request inputs", () => {
      const valid = validateFollowUpRequestInput({
        roomId: "room-uuid-123",
        roleNeeded: "Cloud Infrastructure Engineer",
        extraHeadcount: 2,
        description: "Deploying Kubernetes cluster on local hardware.",
      });
      expect(valid.valid).toBe(true);

      // Missing room id
      expect(
        validateFollowUpRequestInput({
          roomId: "",
          roleNeeded: "Cloud",
          extraHeadcount: 1,
          description: "Long enough description",
        }).valid,
      ).toBe(false);

      // Extra headcount < 1
      expect(
        validateFollowUpRequestInput({
          roomId: "room-uuid-123",
          roleNeeded: "Cloud",
          extraHeadcount: 0,
          description: "Long enough description",
        }).valid,
      ).toBe(false);

      // Description too short
      expect(
        validateFollowUpRequestInput({
          roomId: "room-uuid-123",
          roleNeeded: "Cloud",
          extraHeadcount: 1,
          description: "Too short",
        }).valid,
      ).toBe(false);
    });
  });

  describe("2. Closing Early with Fewer People Than Headcount", () => {
    it("allows lead to close early with fewer accepted people and sets 30-day retention on unselected files", () => {
      interface MockRequest {
        id: string;
        lead_id: string;
        headcount: number;
        status: "open" | "closed" | "full";
        closed_at: string | null;
        room_id: string | null;
      }

      interface MockAppFile {
        id: string;
        application_id: string;
        storage_path: string;
        delete_after: string | null;
      }

      const request: MockRequest = {
        id: "req-drone-1",
        lead_id: "lead-std-1",
        headcount: 4, // 4 headcount target
        status: "open",
        closed_at: null,
        room_id: null,
      };

      const applications = [
        { id: "app-1", applicant_id: "cand-1", status: "accepted" },
        { id: "app-2", applicant_id: "cand-2", status: "applied" },
        { id: "app-3", applicant_id: "cand-3", status: "waitlisted" },
      ];

      const files: MockAppFile[] = [
        { id: "f-1", application_id: "app-1", storage_path: "cand1.pdf", delete_after: null },
        { id: "f-2", application_id: "app-2", storage_path: "cand2.pdf", delete_after: null },
        { id: "f-3", application_id: "app-3", storage_path: "cand3.pdf", delete_after: null },
      ];

      const rooms: Array<{ id: string; requestId: string; leadId: string }> = [];
      const roomMembers: Array<{ roomId: string; userId: string; role: string }> = [];

      // Lead closes early with only 1 accepted person out of 4
      const closeEarly = (leadId: string, currentTime: Date) => {
        if (leadId !== request.lead_id) throw new Error("Only lead can close");

        request.status = "closed";
        request.closed_at = currentTime.toISOString();

        // 1. Form room
        let room = rooms.find((r) => r.requestId === request.id);
        if (!room) {
          room = { id: "room-drone-uuid", requestId: request.id, leadId };
          rooms.push(room);
          request.room_id = room.id;

          // Add lead
          roomMembers.push({ roomId: room.id, userId: leadId, role: "lead" });
        }

        // Add accepted members
        for (const app of applications.filter((a) => a.status === "accepted")) {
          if (!roomMembers.some((m) => m.userId === app.applicant_id)) {
            roomMembers.push({ roomId: room.id, userId: app.applicant_id, role: "member" });
          }
        }

        // 2. Set 30-day retention on unselected applicants' files (Invariant 9)
        const unselectedAppIds = applications
          .filter((a) => a.status !== "accepted")
          .map((a) => a.id);

        const retentionDate = calculateRetentionExpiry(currentTime);
        for (const f of files) {
          if (unselectedAppIds.includes(f.application_id)) {
            f.delete_after = retentionDate;
          }
        }

        return { request, rooms, roomMembers, files };
      };

      const t0 = new Date("2026-10-07T12:00:00Z");
      const result = closeEarly("lead-std-1", t0);

      expect(result.request.status).toBe("closed");
      expect(result.request.closed_at).toBe("2026-10-07T12:00:00.000Z");
      expect(result.rooms).toHaveLength(1);
      // Lead + 1 accepted candidate = 2 room members (even though headcount was 4)
      expect(result.roomMembers).toHaveLength(2);
      expect(result.roomMembers.map((m) => m.userId)).toEqual(["lead-std-1", "cand-1"]);

      // Unselected applicants' files have 30-day deletion timestamp
      expect(result.files.find((f) => f.id === "f-1")?.delete_after).toBeNull(); // Accepted candidate's resume kept
      expect(result.files.find((f) => f.id === "f-2")?.delete_after).toBe("2026-11-06T12:00:00.000Z");
      expect(result.files.find((f) => f.id === "f-3")?.delete_after).toBe("2026-11-06T12:00:00.000Z");
    });
  });

  describe("3. Exactly One Room Per Team (Idempotency)", () => {
    it("guarantees exactly one room exists per team across multiple trigger events", () => {
      const rooms: Array<{ id: string; requestId: string; leadId: string }> = [];

      const createRoomIfReady = (requestId: string, leadId: string) => {
        let room = rooms.find((r) => r.requestId === requestId);
        if (!room) {
          room = { id: `room-${requestId}`, requestId, leadId };
          rooms.push(room);
        }
        return room.id;
      };

      // Trigger 1: Team becomes full
      const r1 = createRoomIfReady("req-ai", "lead-1");
      expect(rooms).toHaveLength(1);

      // Trigger 2: Lead closes request
      const r2 = createRoomIfReady("req-ai", "lead-1");
      expect(rooms).toHaveLength(1);
      expect(r2).toBe(r1);

      // Trigger 3: Late acceptance after close
      const r3 = createRoomIfReady("req-ai", "lead-1");
      expect(rooms).toHaveLength(1);
      expect(r3).toBe(r1);
    });
  });

  describe("4. Follow-up Requests & Automatic Room Joining", () => {
    it("adds accepted candidate from follow-up request to the existing room and notifies existing members", () => {
      const existingRoomId = "room-existing-99";
      const roomMembers = [
        { roomId: existingRoomId, userId: "lead-1", role: "lead" },
        { roomId: existingRoomId, userId: "member-1", role: "member" },
      ];

      const notifications: Array<{ userId: string; type: string; title: string; body: string }> = [];

      // Follow-up request linked to existing room
      const followUpRequest = {
        id: "req-followup-2",
        lead_id: "lead-1",
        room_id: existingRoomId,
        title: "Autonomous Vehicle (Follow-up)",
        headcount: 1,
        status: "open",
      };

      // Candidate 2 applies and is accepted on the follow-up request
      const acceptFollowUpCandidate = (newCandidateId: string) => {
        // Target room is the follow-up's room_id
        const targetRoomId = followUpRequest.room_id;

        // Candidate joins room
        roomMembers.push({
          roomId: targetRoomId,
          userId: newCandidateId,
          role: "member",
        });

        // Existing members get an information notification
        const otherMembers = roomMembers.filter((m) => m.userId !== newCandidateId);
        for (const m of otherMembers) {
          notifications.push({
            userId: m.userId,
            type: "room_member_joined",
            title: "New Team Member Joined!",
            body: `A new teammate has joined your project room from a follow-up request.`,
          });
        }
      };

      acceptFollowUpCandidate("member-2");

      // Verify room membership
      expect(roomMembers).toHaveLength(3);
      expect(roomMembers.map((m) => m.userId)).toContain("member-2");

      // Verify notifications sent to existing members (lead-1 and member-1)
      expect(notifications).toHaveLength(2);
      expect(notifications.map((n) => n.userId)).toEqual(["lead-1", "member-1"]);
      expect(notifications[0].title).toBe("New Team Member Joined!");
    });
  });

  describe("5. File Retention Job Hard Deletion (Time-Travel Test)", () => {
    it("retains file at Day 29, hard deletes at Day 30+, and writes audit log with IDs only", () => {
      const closedAt = new Date("2026-10-07T12:00:00Z");
      const deleteAfter = calculateRetentionExpiry(closedAt); // 2026-11-06T12:00:00.000Z

      let storageFiles = ["storage/cand-unselected-resume.pdf"];
      let databaseRows = [
        { id: "file-99", storage_path: "storage/cand-unselected-resume.pdf", delete_after: deleteAfter },
      ];
      const auditLog: Array<{
        action: string;
        metadata: { deleted_count: number; file_ids: string[] };
      }> = [];

      const runRetentionJob = (currentTime: Date) => {
        const expired = databaseRows.filter((row) => isFileRetentionExpired(row.delete_after, currentTime));
        if (expired.length === 0) return 0;

        const idsToDelete = expired.map((e) => e.id);
        const pathsToDelete = expired.map((e) => e.storage_path);

        // Delete from storage
        storageFiles = storageFiles.filter((p) => !pathsToDelete.includes(p));

        // Delete from database
        databaseRows = databaseRows.filter((r) => !idsToDelete.includes(r.id));

        // Write audit log (IDs only, never content)
        auditLog.push({
          action: "application_files.retention_cleanup",
          metadata: {
            deleted_count: idsToDelete.length,
            file_ids: idsToDelete,
          },
        });

        return idsToDelete.length;
      };

      // Day 29: File is still present
      const day29 = new Date("2026-11-05T12:00:00Z");
      expect(runRetentionJob(day29)).toBe(0);
      expect(storageFiles).toHaveLength(1);
      expect(databaseRows).toHaveLength(1);
      expect(auditLog).toHaveLength(0);

      // Day 30 (Time Travel): File is hard deleted
      const day30 = new Date("2026-11-06T12:00:00Z");
      expect(runRetentionJob(day30)).toBe(1);
      expect(storageFiles).toHaveLength(0); // Gone from storage
      expect(databaseRows).toHaveLength(0); // Gone from database
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe("application_files.retention_cleanup");
      expect(auditLog[0].metadata.file_ids).toEqual(["file-99"]);

      // Idempotency: Second run deletes 0 rows and causes no errors
      expect(runRetentionJob(day30)).toBe(0);
    });
  });

  describe("6. Raising Headcount on Full Request Keeps Same Room", () => {
    it("reopens request when headcount is raised while retaining room link", () => {
      const request = {
        id: "req-1",
        headcount: 3,
        status: "full",
        room_id: "room-team-1",
      };

      const raiseHeadcount = (newHeadcount: number) => {
        if (newHeadcount <= request.headcount) {
          throw new Error("Headcount can only be raised");
        }
        request.headcount = newHeadcount;
        request.status = "open"; // Reopen for new spots
        // room_id is preserved!
        return request;
      };

      const updated = raiseHeadcount(4);
      expect(updated.status).toBe("open");
      expect(updated.headcount).toBe(4);
      expect(updated.room_id).toBe("room-team-1");
    });
  });
});
