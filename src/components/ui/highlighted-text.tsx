'use client';

import { highlightMatch } from '@/lib/utils/highlight-search';

interface HighlightedTextProps {
  text: string | null | undefined;
  query: string;
  className?: string;
  highlightClassName?: string;
}

export function HighlightedText({
  text,
  query,
  className = '',
  highlightClassName = 'bg-yellow-200 dark:bg-yellow-800'
}: HighlightedTextProps) {
  const parts = highlightMatch(text, query);
  
  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span
          key={`${index}-${part.text.slice(0, 10)}-${part.highlight}`}
          className={part.highlight ? highlightClassName : ''}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}
