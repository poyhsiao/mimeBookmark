import { escapeLikePattern } from './sql-escape';

/**
 * Escapes user input for use in a PostgREST ilike pattern with double-quoted value
 * Reuses the existing LIKE-escaping utility and adds PostgREST-specific quote escaping
 */
export function escapePostgrestIlikeValue(value: string): string {
  // Reuse the LIKE-escaping we already have
  const likeEscaped = escapeLikePattern(value);
  // Then escape double quotes for PostgREST-quoted literals
  return likeEscaped.replace(/"/g, '""');
}

/**
 * Builds a PostgREST .or() filter string for ilike operations on multiple columns
 * @param columns - Array of column names to search in
 * @param pattern - The escaped search pattern to use
 * @returns A comma-separated filter string for use with .or()
 */
export function buildIlikeOrFilter(columns: string[], pattern: string): string {
  return columns
    .map((col) => `${col}.ilike."${pattern}"`)
    .join(',');
}
