// src/lib/getSignalingUrl.ts
/**
 * Shared utility to build the correct signaling WebSocket URL.
 *
 * This avoids configuration drift between multiple call sites (e.g. CallEngine and ChatThreadScreen)
 * and guarantees that the correct `/ws` path is always appended to the signaling URL
 * without double-appending it if it's already specified in the environment variable.
 */
export function getSignalingUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const envUrl = (import.meta as any).env?.VITE_SIGNALING_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    let sanitizedUrl = envUrl.trim();
    // Strip trailing slash if present
    if (sanitizedUrl.endsWith("/")) {
      sanitizedUrl = sanitizedUrl.slice(0, -1);
    }
    // Append /ws if it does not already end in /ws
    if (!sanitizedUrl.endsWith("/ws")) {
      sanitizedUrl = `${sanitizedUrl}/ws`;
    }
    return sanitizedUrl;
  }

  // Same-origin fallback for local development
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
