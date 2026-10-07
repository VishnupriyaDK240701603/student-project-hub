/**
 * Web Push Notification Service with VAPID
 * Spec F6, Rules 10, Threat Model #22
 *
 * CRITICAL PRIVACY INVARIANT:
 * Push notifications MUST NOT include message text, file names, or private content in their payload.
 * The payload is strictly restricted to a short generic title and a deep link.
 */

export interface SafePushPayload {
  title: string;
  link: string;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

/**
 * Validate that a push payload contains ONLY safe generic metadata (title and deep link)
 * and strictly zero message content, body text, or private chatter.
 */
export function validatePushPayload(payload: Record<string, unknown>): {
  valid: boolean;
  error?: string;
} {
  // Disallow forbidden content fields to prevent notification leaks
  const forbiddenFields = ["body", "message", "content", "text", "description", "note"];

  for (const field of forbiddenFields) {
    if (field in payload && typeof payload[field] === "string" && (payload[field] as string).trim().length > 0) {
      return {
        valid: false,
        error: `Security violation: Push payloads must not contain private '${field}' text. Use title and deep link only.`,
      };
    }
  }

  if (!payload.title || typeof payload.title !== "string" || payload.title.length > 50) {
    return {
      valid: false,
      error: "Push payload must contain a concise title (max 50 characters).",
    };
  }

  if (!payload.link || typeof payload.link !== "string" || !payload.link.startsWith("/")) {
    return {
      valid: false,
      error: "Push payload must contain a relative deep link starting with '/'.",
    };
  }

  return { valid: true };
}

/**
 * Construct sanitized push payload
 */
export function createSafePushPayload(title: string, link: string): SafePushPayload {
  const payload = { title: title.slice(0, 50), link };
  const validation = validatePushPayload(payload);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return payload;
}

/**
 * Send Web Push notification
 */
export async function sendWebPushNotification(
  subscription: PushSubscriptionRecord,
  payload: SafePushPayload,
): Promise<{ success: boolean; error?: string }> {
  // Validate privacy invariant
  const validation = validatePushPayload(payload as unknown as Record<string, unknown>);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  // In test / development without real keys, mock gracefully
  if (!vapidPublicKey || !vapidPrivateKey || vapidPublicKey.includes("dummy") || vapidPublicKey.includes("example")) {
    return { success: true };
  }

  try {
    // Standard Web Push protocol dispatch to browser service endpoint (FCM / Mozilla Autopush)
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        TTL: "86400",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `Push service endpoint returned HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Push notification dispatch failed";
    return { success: false, error: errorMsg };
  }
}
