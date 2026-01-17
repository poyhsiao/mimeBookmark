// Rate limiting utilities for metadata API
// Exported for testing purposes
export const requestLog = new Map<string, number[]>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;
// Probability of running cleanup on each request (0.05 = 5%)
// This balances cleanup frequency with request latency in serverless environments
export const CLEANUP_PROBABILITY = 0.05;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = requestLog.get(ip) || [];

  // Filter out requests older than window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);

  // If no recent requests, delete the entry to free memory
  if (recentRequests.length === 0) {
    requestLog.delete(ip);
  }

  if (recentRequests.length >= MAX_REQUESTS) {
    return false;
  }

  recentRequests.push(now);
  requestLog.set(ip, recentRequests);

  // Opportunistically clean up stale entries with a probability
  // This avoids the need for a background timer in serverless environments
  // while minimizing the per-request latency impact of O(n) cleanup
  if (Math.random() < CLEANUP_PROBABILITY) {
    cleanupStaleEntries();
  }

  return true;
}

// Cleanup function to remove stale IP entries
// Called opportunistically from checkRateLimit to avoid background timers in serverless
// Exported for testing purposes
export const cleanupStaleEntries = () => {
  const now = Date.now();
  // Use a 10s buffer beyond the rate limit window for cleanup
  // This ensures entries are cleaned up shortly after they become irrelevant
  const staleThreshold = RATE_LIMIT_WINDOW + 10000;

  for (const [ip, timestamps] of requestLog.entries()) {
    // If the last timestamp is older than the threshold, delete the entry
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > staleThreshold) {
      requestLog.delete(ip);
    }
  }
};
