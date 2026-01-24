/**
 * Escape special characters for SQL LIKE queries
 * Escapes: \ % _ '
 */
export function escapeLikePattern(pattern: string): string {
  return pattern
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "''")     // Escape single quotes
    .replace(/%/g, '\\%')    // Escape percent signs
    .replace(/_/g, '\\_');   // Escape underscores
}

/**
 * Safely parse URL and extract hostname
 * Returns fallback on error
 */
export function getHostnameFromUrl(url: string, fallback = ''): string {
  try {
    return new URL(url).hostname;
  } catch {
    return fallback;
  }
}

/**
 * Validate date string and return Date object or undefined
 */
export function parseValidDate(dateString: string | null): Date | undefined {
  if (!dateString) return undefined;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}
