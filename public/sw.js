/**
 * Service Worker: Student Project Hub
 * 
 * Strict Security Invariant:
 * Caches ONLY the static shell and assets.
 * NEVER caches API responses, Supabase data, room chat, tasks, or uploaded files.
 * Provides offline fallback page when disconnected.
 */

const STATIC_CACHE_NAME = "sph-static-v2";
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Helper to determine if a request is an authenticated or sensitive resource
export function isSensitiveRequest(url, method, headers) {
  // Only GET requests can ever be cached
  if (method && method.toUpperCase() !== "GET") {
    return true;
  }

  const urlObj = typeof url === "string" ? new URL(url, "https://local-sph.internal") : url;
  const pathname = urlObj.pathname;
  const hostname = urlObj.hostname;

  // Never cache API endpoints
  if (pathname.startsWith("/api/")) {
    return true;
  }

  // Never cache Supabase endpoints (auth, rest, storage, realtime)
  if (
    hostname.includes("supabase.co") ||
    pathname.includes("/auth/v1/") ||
    pathname.includes("/rest/v1/") ||
    pathname.includes("/storage/v1/") ||
    pathname.includes("/realtime/v1/")
  ) {
    return true;
  }

  // Never cache dynamic authenticated application routes
  const sensitivePaths = [
    "/rooms",
    "/inbox",
    "/profile",
    "/onboarding",
    "/staff",
    "/owner",
    "/moderation",
  ];
  if (sensitivePaths.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  // Never cache if Authorization or custom Supabase auth header is present
  if (headers) {
    const hasAuth =
      (typeof headers.get === "function" &&
        (headers.get("authorization") || headers.get("apikey"))) ||
      headers["authorization"] ||
      headers["apikey"];
    if (hasAuth) {
      return true;
    }
  }

  return false;
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  // Install Event: Precache static fallback shell
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      }),
    );
    self.skipWaiting();
  });

  // Activate Event: Clear old cache versions
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE_NAME)
            .map((key) => caches.delete(key)),
        );
      }),
    );
    self.clients.claim();
  });

  // Message Event: Handle sign out or cache clearance
  self.addEventListener("message", (event) => {
    if (event.data && (event.data.type === "CLEAR_USER_CACHE" || event.data.type === "SIGN_OUT")) {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      });
    }
    if (event.data && event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  });

  // Fetch Event: Network-first for navigations, cache-first for static assets, strict bypass for sensitive
  self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // If sensitive/authenticated/api, bypass cache completely
    if (isSensitiveRequest(url, request.method, request.headers)) {
      return; // Regular network fetch, no caching
    }

    // Navigation requests: try network, fallback to offline page
    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request).catch(() => {
          return caches.match(OFFLINE_URL);
        }),
      );
      return;
    }

    // Static assets (_next/static, public icons): Stale-while-revalidate or cache-first
    if (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.json" ||
      url.pathname === "/favicon.ico"
    ) {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          });
        }),
      );
    }
  });
}
