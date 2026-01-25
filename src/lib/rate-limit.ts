// Rate limiting utility for extension APIs
// Uses in-memory Map for rate limiting with sliding window algorithm
// Note: For production, consider using Redis or Upstash for distributed systems

interface RateLimitConfig {
  endpoint: string;
  requests: number;
  windowMs: number;
}

interface RateLimitStore {
  count: number;
  windowStart: number;
  history: number[];
}

const store = new Map<string, RateLimitStore>();

// Store TTL/eviction configuration
const STORE_ENTRY_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_STORE_SIZE = 10000; // Maximum number of entries before forced cleanup
let cleanupScheduled = false;

// Default configurations with endpoint names
const DEFAULT_CONFIGS: RateLimitConfig[] = [
  { endpoint: 'default', requests: 60, windowMs: 60000 },
  { endpoint: 'metadata', requests: 30, windowMs: 30000 },
  { endpoint: 'batch-save', requests: 120, windowMs: 60000 },
];

export function getConfig(endpoint: string): RateLimitConfig {
  return DEFAULT_CONFIGS.find(
    config => config.endpoint === endpoint
  ) || DEFAULT_CONFIGS[0];
}

/**
 * Cleanup expired entries from the store to prevent unbounded growth.
 * This is called opportunistically when the store size exceeds a threshold.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, userStore] of store.entries()) {
    // Check if entry is expired (no activity for more than TTL)
    // Use most recent activity (index 0 since we unshift newest timestamps first)
    const mostRecentTimestamp = userStore.history[0];
    const age = mostRecentTimestamp ? now - mostRecentTimestamp : now - userStore.windowStart;

    if (age > STORE_ENTRY_TTL) {
      keysToDelete.push(key);
    }
  }

  // Delete expired entries
  for (const key of keysToDelete) {
    store.delete(key);
  }

  // If store is still too large, force cleanup oldest entries
  if (store.size > MAX_STORE_SIZE) {
    const entries = Array.from(store.entries());
    // Sort by most recent activity time (index 0 since we unshift newest timestamps first)
    entries.sort(([, a], [, b]) => {
      const aMostRecent = a.history[0] || a.windowStart;
      const bMostRecent = b.history[0] || b.windowStart;
      return aMostRecent - bMostRecent;
    });

    // Remove oldest entries
    const toRemove = entries.slice(0, store.size - MAX_STORE_SIZE);
    for (const [key] of toRemove) {
      store.delete(key);
    }
  }

  cleanupScheduled = false;
}

/**
 * Perform opportunistic cleanup if needed.
 * This avoids running cleanup on every request.
 */
function maybeCleanup(): void {
  if (!cleanupScheduled && store.size > 1000) {
    cleanupScheduled = true;
    // Schedule cleanup for next tick to avoid blocking current request
    Promise.resolve().then(cleanupExpiredEntries);
  }
}

/**
 * Get user store entry and clean up expired entries on access.
 */
function getUserStore(key: string, now: number): RateLimitStore {
  let userStore = store.get(key);

  if (!userStore) {
    userStore = {
      count: 0,
      windowStart: now,
      history: [],
    };
    store.set(key, userStore);
    return userStore;
  }

  // Clean up expired history entries on access
  // Extract endpoint from key by finding the last colon
  // Key format is: "userId:endpoint" or "endpoint" (for anonymous)
  // Use lastIndexOf to handle userIds that contain colons
  const colonIndex = key.lastIndexOf(':');
  const endpoint = colonIndex !== -1 && colonIndex < key.length - 1
    ? key.substring(colonIndex + 1)
    : 'default';
  const config = getConfig(endpoint);
  const cutoffTime = now - config.windowMs;
  userStore.history = userStore.history.filter(
    timestamp => timestamp >= cutoffTime
  );

  // If no valid history, the entry is stale - reset it
  if (userStore.history.length === 0 && (now - userStore.windowStart) > STORE_ENTRY_TTL) {
    userStore.count = 0;
    userStore.windowStart = now;
    userStore.history = [];
  }

  store.set(key, userStore);
  return userStore;
}

/**
 * Atomic operation: check rate limit and record request in one step.
 * This prevents TOCTOU (time-of-check to time-of-use) race conditions
 * where concurrent requests could pass the check before the count is updated.
 *
 * @param endpoint - The endpoint identifier for rate limiting
 * @param userId - Optional user ID for per-user rate limiting
 * @returns Object with allowed status and optional retryAfter seconds
 */
export function checkAndRecordRequest(
  endpoint: string,
  userId: string | undefined
): { allowed: boolean, retryAfter?: number } {
  const config = getConfig(endpoint);
  const now = Date.now();

  const key = `${userId || 'anonymous'}:${endpoint}`;
  const userStore = getUserStore(key, now);

  // Trigger opportunistic cleanup if store is growing
  maybeCleanup();

  const timeSinceWindow = now - userStore.windowStart;

  // Check if window has expired
  if (timeSinceWindow > config.windowMs) {
    // Reset window and record the new request
    userStore.count = 1;
    userStore.windowStart = now;
    userStore.history = [now];
    store.set(key, userStore);

    return { allowed: true };
  }

  // Check if user has exceeded their limit
  if (userStore.count >= config.requests) {
    // Calculate remaining seconds in current window
    const remainingSeconds = Math.ceil((userStore.windowStart + config.windowMs - now) / 1000);
    return {
      allowed: false,
      retryAfter: Math.max(1, remainingSeconds),
    };
  }

  // Increment count and record the request (atomic operation)
  userStore.count++;
  userStore.history.unshift(now);
  store.set(key, userStore);

  return { allowed: true };
}

/**
 * Check if request should be rate limited (without recording).
 * NOTE: If you use this function, you must call recordRequest() immediately after.
 * For most use cases, prefer checkAndRecordRequest() which is atomic.
 *
 * @deprecated Prefer checkAndRecordRequest() for atomicity
 */
export function checkRateLimit(
  endpoint: string,
  userId: string | undefined
): { allowed: boolean, retryAfter?: number } {
  const config = getConfig(endpoint);
  const now = Date.now();

  const key = `${userId || 'anonymous'}:${endpoint}`;
  const userStore = getUserStore(key, now);

  // Trigger opportunistic cleanup if store is growing
  maybeCleanup();

  const timeSinceWindow = now - userStore.windowStart;

  // Check if window has expired
  if (timeSinceWindow > config.windowMs) {
    userStore.count = 0;
    userStore.windowStart = now;
    userStore.history = [];
    store.set(key, userStore);

    return { allowed: true };
  }

  // Check if user has exceeded their limit
  if (userStore.count >= config.requests) {
    // Calculate remaining seconds in current window
    const remainingSeconds = Math.ceil((userStore.windowStart + config.windowMs - now) / 1000);
    return {
      allowed: false,
      retryAfter: Math.max(1, remainingSeconds),
    };
  }

  return { allowed: true };
}

/**
 * Record a request (after calling checkRateLimit).
 * NOTE: For atomicity, prefer checkAndRecordRequest() instead.
 *
 * @deprecated Prefer checkAndRecordRequest() for atomicity
 */
export function recordRequest(
  endpoint: string,
  userId: string | undefined
): void {
  const config = getConfig(endpoint);
  const now = Date.now();

  const key = `${userId || 'anonymous'}:${endpoint}`;
  const userStore = getUserStore(key, now);

  // Trigger opportunistic cleanup if store is growing
  maybeCleanup();

  // Add new timestamp first
  userStore.history.unshift(now);

  // Filter out old timestamps
  const cutoffTime = now - config.windowMs;
  userStore.history = userStore.history.filter(
    timestamp => timestamp >= cutoffTime
  );

  // Set count to match filtered history length
  userStore.count = userStore.history.length;

  // Persist once with consistent count and history
  store.set(key, userStore);
}

// Get rate limit status for user (for logging/debugging)
export function getRateLimitStatus(userId: string | undefined, endpoint: string = 'default') {
  const key = `${userId || 'anonymous'}:${endpoint}`;
  const config = getConfig(endpoint);
  const now = Date.now();
  const userStore = store.get(key);

  if (!userStore) {
    return {
      config,
      count: 0,
      windowStart: now,
      remaining: config.requests,
      windowExpired: false,
      nextResetTime: now + config.windowMs,
      history: [],
    };
  }

  const windowStart = userStore.windowStart;
  const timeSinceWindow = now - windowStart;
  const windowExpired = timeSinceWindow > config.windowMs;
  const remaining = Math.max(0, config.requests - userStore.count);
  const nextResetTime = windowStart + config.windowMs;

  return {
    config,
    count: userStore.count,
    windowStart,
    remaining,
    windowExpired,
    nextResetTime,
    history: userStore.history,
  };
}
