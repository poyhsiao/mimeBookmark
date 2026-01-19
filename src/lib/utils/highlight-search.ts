/**
 * Utility for highlighting matching text in search results
 */

/**
 * Highlight matching text in a string
 * @param text - The text to search and highlight
 * @param query - The search query to highlight
 * @returns Array of { text, highlight } objects for rendering
 */
export function highlightMatch(
  text: string | null | undefined,
  query: string
): Array<{ text: string; highlight: boolean }> {
  if (!text || !query || !query.trim()) {
    return [{ text: text || '', highlight: false }];
  }

  const result: Array<{ text: string; highlight: boolean }> = [];
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  
  let lastIndex = 0;
  let index = normalizedText.indexOf(normalizedQuery);
  
  while (index !== -1) {
    // Add non-matching text before the match
    if (index > lastIndex) {
      result.push({
        text: text.slice(lastIndex, index),
        highlight: false,
      });
    }
    
    // Add matching text
    result.push({
      text: text.slice(index, index + normalizedQuery.length),
      highlight: true,
    });

    lastIndex = index + normalizedQuery.length;
    index = normalizedText.indexOf(normalizedQuery, lastIndex);
  }
  
  // Add remaining non-matching text
  if (lastIndex < text.length) {
    result.push({
      text: text.slice(lastIndex),
      highlight: false,
    });
  }
  
  return result;
}

/**
 * Highlight multiple words in text (OR logic)
 * @param text - The text to search and highlight
 * @param queries - Array of search queries to highlight
 * @returns Array of { text, highlight } objects for rendering
 */
export function highlightMultiple(
  text: string | null | undefined,
  queries: string[]
): Array<{ text: string; highlight: boolean }> {
  if (!text || !queries.length) {
    return [{ text: text || '', highlight: false }];
  }

  // Filter and normalize queries
  const normalizedQueries = queries
    .map(q => q.trim().toLowerCase())
    .filter(Boolean);

  if (!normalizedQueries.length) {
    return [{ text: text || '', highlight: false }];
  }

  // Find all match positions
  const matches: Array<{ start: number; end: number }> = [];
  
  for (const query of normalizedQueries) {
    let index = text.toLowerCase().indexOf(query);
    while (index !== -1) {
      matches.push({ start: index, end: index + query.length });
      index = text.toLowerCase().indexOf(query, index + 1);
    }
  }

  // Sort and merge overlapping matches
  matches.sort((a, b) => a.start - b.start);
  const mergedMatches: Array<{ start: number; end: number }> = [];
  
  for (const match of matches) {
    const last = mergedMatches[mergedMatches.length - 1];
    if (!last || match.start > last.end) {
      mergedMatches.push({ ...match });
    } else {
      last.end = Math.max(last.end, match.end);
    }
  }

  // Build result array
  const result: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;
  
  for (const match of mergedMatches) {
    if (match.start > lastIndex) {
      result.push({
        text: text.slice(lastIndex, match.start),
        highlight: false,
      });
    }
    result.push({
      text: text.slice(match.start, match.end),
      highlight: true,
    });
    lastIndex = match.end;
  }
  
  if (lastIndex < text.length) {
    result.push({
      text: text.slice(lastIndex),
      highlight: false,
    });
  }
  
  return result;
}

/**
 * Extract and highlight search snippets from text
 * @param text - Full text to extract snippet from
 * @param query - Search query
 * @param maxLength - Maximum length of snippet (default: 150)
 * @returns Object with snippet and highlighted parts array
 */
export function extractHighlightedSnippet(
  text: string | null | undefined,
  query: string,
  maxLength: number = 150
): { 
  snippet: string; 
  highlightedParts: Array<{ text: string; highlight: boolean }> 
} {
  if (!text || !query) {
    const snippet = text ? text.slice(0, maxLength) : '';
    return { snippet, highlightedParts: [{ text: snippet, highlight: false }] };
  }

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();
  const queryLength = normalizedQuery.length;

  // Find the position of the query
  const position = normalizedText.indexOf(normalizedQuery);

  if (position === -1) {
    // Query not found, return beginning of text
    const snippet = text.slice(0, maxLength);
    return { snippet, highlightedParts: [{ text: snippet, highlight: false }] };
  }

  // Calculate snippet bounds
  const start = Math.max(0, position - 50);
  const end = Math.min(text.length, position + queryLength + 100);

  let snippet = text.slice(start, end);

  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  // Highlight the query in the snippet
  const highlightedParts = highlightMatch(snippet, query);

  return { snippet, highlightedParts };
}
