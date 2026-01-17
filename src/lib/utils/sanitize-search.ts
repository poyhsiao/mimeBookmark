/**
 * Sanitizes search terms for PostgREST filter syntax
 * Escapes special characters that could cause injection issues in LIKE/ilike patterns
 *
 * For PostgREST LIKE/ilike patterns, only backslash, % and _ need escaping.
 *
 * @param query - The raw search query from user input
 * @returns Sanitized search term safe for use in PostgREST LIKE/ilike filters
 */
export function sanitizeSearchTerm(query: string): string {
  return query.trim()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
