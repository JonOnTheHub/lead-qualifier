// In-memory rate limiter — no external service needed.
// Tracks submission counts per IP in a Map.
// Resets per window. Good enough for a portfolio/MVP.
// For production at scale swap for Upstash Ratelimit.

interface RateLimitEntry {
    count: number
    windowStart: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60 * 1000  // 1 minute window
const MAX_REQUESTS = 3        // max 3 submissions per IP per minute

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now()
    const entry = store.get(ip)

    if (!entry || now - entry.windowStart > WINDOW_MS) {
        // New window
        store.set(ip, { count: 1, windowStart: now })
        return { allowed: true, remaining: MAX_REQUESTS - 1 }
    }

    if (entry.count >= MAX_REQUESTS) {
        return { allowed: false, remaining: 0 }
    }

    entry.count++
    return { allowed: true, remaining: MAX_REQUESTS - entry.count }
}