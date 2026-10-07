/**
 * Structured, privacy-preserving logger for Student Project Hub.
 * Strictly avoids logging PII, passwords, auth tokens, chat message texts, or file bodies.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogPayload {
  level: LogLevel;
  event: string;
  requestId?: string;
  actorId?: string;
  targetId?: string;
  roomId?: string;
  metadata?: Record<string, unknown>;
  error?: Error | { name?: string; message?: string; stack?: string };
}

const FORBIDDEN_KEYS = [
  "token",
  "secret",
  "password",
  "key",
  "content",
  "message",
  "text",
  "body",
  "email",
  "phone",
  "prompt",
  "authorization",
];

function sanitizeLogMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 3 || obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map((item) => sanitizeLogMetadata(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = FORBIDDEN_KEYS.some((fk) => lowerKey.includes(fk));

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogMetadata(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export class Logger {
  private static formatLog(payload: LogPayload): string {
    const cleanMetadata = payload.metadata ? sanitizeLogMetadata(payload.metadata) : undefined;
    const cleanError = payload.error
      ? {
          name: payload.error.name || "Error",
          message: "[REDACTED_OR_GENERIC]",
        }
      : undefined;

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: payload.level,
      event: payload.event,
      requestId: payload.requestId,
      actorId: payload.actorId,
      targetId: payload.targetId,
      roomId: payload.roomId,
      metadata: cleanMetadata,
      error: cleanError,
    });
  }

  static info(event: string, details: Omit<LogPayload, "level" | "event"> = {}) {
    const formatted = this.formatLog({ level: "info", event, ...details });
    console.log(formatted);
    return formatted;
  }

  static warn(event: string, details: Omit<LogPayload, "level" | "event"> = {}) {
    const formatted = this.formatLog({ level: "warn", event, ...details });
    console.warn(formatted);
    return formatted;
  }

  static error(event: string, details: Omit<LogPayload, "level" | "event"> = {}) {
    const formatted = this.formatLog({ level: "error", event, ...details });
    console.error(formatted);
    return formatted;
  }

  static debug(event: string, details: Omit<LogPayload, "level" | "event"> = {}) {
    if (process.env.NODE_ENV === "development") {
      const formatted = this.formatLog({ level: "debug", event, ...details });
      console.debug(formatted);
      return formatted;
    }
    return "";
  }
}
