/**
 * Simple in-memory rate limiter for API endpoints
 *
 * This implementation uses a sliding window algorithm to track request counts
 * per user per time period (per minute).
 *
 * ⚠️ LIMITATIONS - Development/Non-Serverless Only:
 * - Cold starts in serverless environments reset rate limit state
 * - Instance state is not shared across multiple function instances
 * - Rate limits can be bypassed by distributing requests across instances
 *
 * TODO: For production serverless deployments, migrate to one of:
 * - Upstash Redis with @upstash/ratelimit package (recommended for edge/serverless)
 * - Edge-level throttling (Vercel WAF, API Gateway rate limiting)
 * - Redis-based distributed rate limiter
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  /** Absolute Unix timestamp in milliseconds when the rate limit will reset */
  resetTime: number | null;
  /** Seconds until the user can retry (null if allowed) */
  retryAfter: number | null;
}

export interface RateLimiter {
  check: (userId: string, endpoint: string) => RateLimitResult;
  reset: (userId: string) => void;
  destroy: () => void;
}

/**
 * Simple in-memory rate limiter implementation
 */
class SimpleRateLimiter implements RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private config: RateLimitConfig) {
    // Start cleanup interval to prune stale entries (runs every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Don't keep the process alive just for this timer
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if a request from a user to an endpoint is allowed
   * @param userId - The user ID making the request
   * @param endpoint - The endpoint being accessed (e.g., 'extensions:sync')
   * @returns Rate limit check result
   */
  check(userId: string, endpoint: string): RateLimitResult {
    const now = Date.now();
    const key = `${userId}:${endpoint}`;

    // Get or initialize request timestamps for this user:endpoint
    let timestamps = this.requests.get(key);

    if (!timestamps) {
      timestamps = [];
      this.requests.set(key, timestamps);
    }

    // Remove timestamps outside the window (e.g., older than windowMs)
    const windowStart = now - this.config.windowMs;
    timestamps = timestamps.filter((timestamp) => timestamp > windowStart);

    // Persist filtered timestamps before checking limit
    this.requests.set(key, timestamps);

    // Check if user has exceeded the limit
    if (timestamps.length >= this.config.maxRequests) {
      // User is rate limited
      const oldestTimestamp = timestamps[0];
      const absoluteReset = oldestTimestamp + this.config.windowMs;
      const retryAfterSeconds = Math.max(0, Math.ceil((absoluteReset - Date.now()) / 1000));

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: absoluteReset,
        retryAfter: retryAfterSeconds,
      };
    }

    // Add current request timestamp
    timestamps.push(now);
    this.requests.set(key, timestamps);

    // Calculate remaining requests
    const remainingRequests = this.config.maxRequests - timestamps.length;

    return {
      allowed: true,
      remainingRequests,
      resetTime: null,
      retryAfter: null,
    };
  }

  /**
   * Reset all rate limits for a specific user
   * @param userId - The user ID to reset
   */
  reset(userId: string): void {
    // Delete all timestamps for this user
    for (const key of this.requests.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Cleanup stale entries to prevent unbounded memory growth
   * Removes keys with empty timestamp arrays or with timestamps older than the window
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      // Remove timestamps outside the window
      const filteredTimestamps = timestamps.filter(t => t > windowStart);

      // If the array is empty after filtering, delete the key entirely
      if (filteredTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filteredTimestamps);
      }
    }
  }

  /**
   * Stop the cleanup interval (useful for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Rate limit configurations for different extension endpoints
 */
export const RATE_LIMITS = {
  extensionsSync: {
    maxRequests: 60, // 60 requests per minute
    windowMs: 60 * 1000, // 1 minute window
  },
  extensionsBatchSave: {
    maxRequests: 30, // 30 requests per minute
    windowMs: 60 * 1000, // 1 minute window
  },
  extensionsSearch: {
    maxRequests: 120, // 120 requests per minute
    windowMs: 60 * 1000, // 1 minute window
  },
} as const;

/**
 * Create rate limiter instances for each endpoint
 */
export const rateLimiters = {
  sync: new SimpleRateLimiter(RATE_LIMITS.extensionsSync),
  batchSave: new SimpleRateLimiter(RATE_LIMITS.extensionsBatchSave),
  search: new SimpleRateLimiter(RATE_LIMITS.extensionsSearch),
};
