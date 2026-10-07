/**
 * Robust fetch wrapper with configurable timeouts, exponential backoff, and graceful fallback.
 */

export interface RetryOptions {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
  factor?: number;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const {
    retries = 2,
    backoffMs = 300,
    timeoutMs = 8000,
    factor = 2,
  } = options;

  let lastError: unknown;
  let delay = backoffMs;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // If server returned 5xx and we have retries left, retry
      if (response.status >= 500 && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= factor;
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= factor;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Network request failed after retries.");
}
