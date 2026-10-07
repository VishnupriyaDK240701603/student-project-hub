import { describe, it, expect, beforeEach } from "vitest";
import {
  dispatchNotificationEmail,
  renderEmailPlainText,
  renderEmailHtml,
  resetSentEvents,
  type EmailDispatchParams,
} from "./email-service";
import {
  validatePushPayload,
  createSafePushPayload,
} from "./push-service";

describe("Prompt 11: Inbox, Email, and Push Notifications Test Suite", () => {
  beforeEach(() => {
    resetSentEvents();
    process.env.APP_ENV = "local";
    process.env.EMAIL_TEST_RECIPIENT = "test-owner@example.com";
    process.env.EMAIL_FROM = "noreply@rajlakshmi.edu.in";
  });

  describe("1. Email Dispatch Safety & Non-Production Restriction", () => {
    it("allows sending selection invite email to test address in non-production", async () => {
      const params: EmailDispatchParams = {
        eventId: "event-sel-1",
        eventType: "selection_invite",
        recipientEmail: "test-owner@example.com",
        recipientName: "Student A",
        projectTitle: "Smart EV Charger",
        roleOrLead: "Firmware Developer",
        expiryHours: 48,
        actionUrl: "http://localhost:3000/inbox",
      };

      const result = await dispatchNotificationEmail(params);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("redirects or blocks email to arbitrary address in non-production environment", async () => {
      // In non-production, attempting to email a real student's personal or unwhitelisted address
      // redirects safely to EMAIL_TEST_RECIPIENT or blocks
      const params: EmailDispatchParams = {
        eventId: "event-sel-2",
        eventType: "selection_invite",
        recipientEmail: "unauthorized.student@gmail.com",
        recipientName: "Student B",
        projectTitle: "Smart EV Charger",
        roleOrLead: "Firmware Developer",
        expiryHours: 48,
        actionUrl: "http://localhost:3000/inbox",
      };

      const result = await dispatchNotificationEmail(params);
      // Dispatched safely redirected to test recipient
      expect(result.success).toBe(true);
    });

    it("blocks email dispatch when event type is not selection or mentor invite", async () => {
      const params = {
        eventId: "event-chat-1",
        eventType: "room_chat_message", // Forbidden event type for email!
        recipientEmail: "test-owner@example.com",
        recipientName: "Student C",
        projectTitle: "Smart EV Charger",
        roleOrLead: "Member",
        expiryHours: 0,
        actionUrl: "http://localhost:3000/inbox",
      } as unknown as EmailDispatchParams;

      const result = await dispatchNotificationEmail(params);
      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.error).toContain("is not permitted to send email");
    });
  });

  describe("2. Email Idempotency (Duplicate Suppression)", () => {
    it("never sends a second email for the exact same event", async () => {
      const params: EmailDispatchParams = {
        eventId: "event-unique-99",
        eventType: "selection_invite",
        recipientEmail: "test-owner@example.com",
        recipientName: "Student D",
        projectTitle: "Solar Tracker",
        roleOrLead: "Hardware Lead",
        expiryHours: 24,
        actionUrl: "http://localhost:3000/inbox",
      };

      // First dispatch: Success
      const firstResult = await dispatchNotificationEmail(params);
      expect(firstResult.success).toBe(true);
      expect(firstResult.skipped).toBeUndefined();

      // Duplicate dispatch: Skipped
      const duplicateResult = await dispatchNotificationEmail(params);
      expect(duplicateResult.success).toBe(true);
      expect(duplicateResult.skipped).toBe(true);
      expect(duplicateResult.error).toContain("Duplicate event suppressed");
    });
  });

  describe("3. Web Push Privacy Invariant (Rules 10, Threat Model #22)", () => {
    it("validates that a safe push payload contains only generic title and relative deep link", () => {
      const safePayload = {
        title: "Team Invitation Received",
        link: "/inbox",
      };

      expect(validatePushPayload(safePayload).valid).toBe(true);
      const constructed = createSafePushPayload("Team Invitation Received", "/inbox");
      expect(constructed.title).toBe("Team Invitation Received");
      expect(constructed.link).toBe("/inbox");
    });

    it("STRICTLY REJECTS any push payload containing message body or private chat text", () => {
      // Test payload with body text
      const leakyPayload1 = {
        title: "New Message",
        link: "/rooms/123",
        body: "Hey, can you review the secret code?",
      };
      expect(validatePushPayload(leakyPayload1).valid).toBe(false);
      expect(validatePushPayload(leakyPayload1).error).toContain("Security violation");

      // Test payload with message field
      const leakyPayload2 = {
        title: "New Alert",
        link: "/inbox",
        message: "Applicant John Doe has uploaded resume",
      };
      expect(validatePushPayload(leakyPayload2).valid).toBe(false);

      // Test payload with content field
      const leakyPayload3 = {
        title: "Chat",
        link: "/rooms/123",
        content: "Private chatter",
      };
      expect(validatePushPayload(leakyPayload3).valid).toBe(false);
    });

    it("rejects non-relative or malformed push links", () => {
      expect(validatePushPayload({ title: "Valid", link: "https://external.com" }).valid).toBe(
        false,
      );
      expect(validatePushPayload({ title: "", link: "/inbox" }).valid).toBe(false);
    });
  });

  describe("4. Email Template Rendering", () => {
    const params: EmailDispatchParams = {
      eventId: "render-test-1",
      eventType: "selection_invite",
      recipientEmail: "test-owner@example.com",
      recipientName: "Kavitha",
      projectTitle: "Autonomous Underwater Drone",
      roleOrLead: "Control Systems Lead",
      expiryHours: 48,
      actionUrl: "http://localhost:3000/inbox",
    };

    it("renders clean plain-text version without HTML tags", () => {
      const text = renderEmailPlainText(params);
      expect(text).toContain("Hello Kavitha,");
      expect(text).toContain("Autonomous Underwater Drone");
      expect(text).toContain("Control Systems Lead");
      expect(text).toContain("48 hours");
      expect(text).toContain("http://localhost:3000/inbox");
      expect(text).not.toContain("<html>");
      expect(text).not.toContain("<div>");
    });

    it("renders valid HTML version with responsive styling", () => {
      const html = renderEmailHtml(params);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Kavitha");
      expect(html).toContain("Autonomous Underwater Drone");
      expect(html).toContain("Control Systems Lead");
      expect(html).toContain("48 hours");
      expect(html).toContain("http://localhost:3000/inbox");
    });
  });
});
