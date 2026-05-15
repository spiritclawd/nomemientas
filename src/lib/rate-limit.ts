// Shared rate limiter for all API endpoints
// Uses a sliding window per IP, in-memory (per-process)

const rateLimits = new Map<string, { count: number; windowStart: number }>()

interface RateLimitConfig {
  maxRequests: number   // max requests allowed
  windowMs: number      // time window in ms
}

const DEFAULT_CONFIG: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 }

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  let entry = rateLimits.get(ip)

  // Start new window if none or expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = { count: 1, windowStart: now }
    rateLimits.set(ip, entry)
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs }
  }

  entry.count++
  const remaining = Math.max(0, config.maxRequests - entry.count)
  const resetIn = config.windowMs - (now - entry.windowStart)

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetIn }
  }

  return { allowed: true, remaining, resetIn }
}

// Clean up stale entries every 5 minutes to prevent memory leak
// Schedule on first import only
let cleanupScheduled = false
if (!cleanupScheduled) {
  cleanupScheduled = true
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      const now = Date.now()
      const keys = Array.from(rateLimits.keys())
      for (const key of keys) {
        const entry = rateLimits.get(key)
        if (entry && now - entry.windowStart >= 120_000) {
          rateLimits.delete(key)
        }
      }
    }, 5 * 60_000)
  }
}

// Helper to extract IP from request
export function getClientIp(req: { headers: { get: (name: string) => string | null } }): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         'anonymous'
}
