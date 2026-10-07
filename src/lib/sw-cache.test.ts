import { describe, it, expect } from "vitest";
import { isSensitiveRequest } from "../../public/sw.js";

describe("Service Worker Cache Isolation Policy", () => {
  it("rejects non-GET requests from caching", () => {
    expect(isSensitiveRequest("/api/test", "POST")).toBe(true);
    expect(isSensitiveRequest("/rooms/42", "DELETE")).toBe(true);
    expect(isSensitiveRequest("/requests", "PUT")).toBe(true);
  });

  it("proves API endpoints are NEVER cached", () => {
    expect(isSensitiveRequest("/api/auth/hook", "GET")).toBe(true);
    expect(isSensitiveRequest("/api/requests", "GET")).toBe(true);
  });

  it("proves Supabase auth, database, and storage endpoints are NEVER cached", () => {
    expect(isSensitiveRequest("https://xyz.supabase.co/rest/v1/messages", "GET")).toBe(true);
    expect(isSensitiveRequest("https://xyz.supabase.co/auth/v1/token", "GET")).toBe(true);
    expect(isSensitiveRequest("https://xyz.supabase.co/storage/v1/object/resumes/cv.pdf", "GET")).toBe(true);
    expect(isSensitiveRequest("https://xyz.supabase.co/realtime/v1/websocket", "GET")).toBe(true);
  });

  it("proves dynamic authenticated room, chat, and profile routes are NEVER cached", () => {
    expect(isSensitiveRequest("/rooms/room-123", "GET")).toBe(true);
    expect(isSensitiveRequest("/rooms/room-123/chat", "GET")).toBe(true);
    expect(isSensitiveRequest("/inbox", "GET")).toBe(true);
    expect(isSensitiveRequest("/profile", "GET")).toBe(true);
    expect(isSensitiveRequest("/staff/mentor-inbox", "GET")).toBe(true);
    expect(isSensitiveRequest("/owner/audit", "GET")).toBe(true);
    expect(isSensitiveRequest("/moderation/reports", "GET")).toBe(true);
  });

  it("proves requests with Authorization or apikey headers are NEVER cached", () => {
    const headersWithAuth = new Headers({
      Authorization: "Bearer secret-token",
    });
    expect(isSensitiveRequest("/some-route", "GET", headersWithAuth)).toBe(true);

    const headersWithApikey = new Headers({
      apikey: "anon-public-key",
    });
    expect(isSensitiveRequest("/another-route", "GET", headersWithApikey)).toBe(true);
  });

  it("allows static shell and static assets to be cached", () => {
    expect(isSensitiveRequest("/_next/static/chunks/main.js", "GET")).toBe(false);
    expect(isSensitiveRequest("/icons/icon-192.png", "GET")).toBe(false);
    expect(isSensitiveRequest("/manifest.json", "GET")).toBe(false);
    expect(isSensitiveRequest("/favicon.ico", "GET")).toBe(false);
  });
});
