import { getHostnameFromUrl } from '@/lib/utils/sql-escape';
import type { BookmarkToInsert, ValidationError } from './types';

export function buildBookmarksToInsert(
  tabs: Array<{ url: string; title?: string; favicon?: string }>,
  userId: string,
  collectionId: string,
  remainingSlots: number,
) {
  const validTabs = tabs.filter(tab => {
    if (!tab.url || typeof tab.url !== 'string') return false;
    try {
      new URL(tab.url);
      return true;
    } catch {
      return false;
    }
  });

  if (validTabs.length === 0) {
    const e: ValidationError = new Error('No valid tabs provided') as ValidationError;
    e.status = 400;
    throw e;
  }

  const uniqueTabs = Array.from(new Map(validTabs.map(tab => [tab.url, tab])).values());

  const bookmarksToInsert: BookmarkToInsert[] = [];
  for (const tab of uniqueTabs) {
    const domain = getHostnameFromUrl(tab.url, 'unknown');
    bookmarksToInsert.push({
      user_id: userId,
      url: tab.url,
      title: tab.title || tab.url,
      domain,
      favicon_url: tab.favicon,
      source: 'extension',
      collection_id: collectionId,
    });
  }

  if (bookmarksToInsert.length > remainingSlots) {
    const e: ValidationError = Object.assign(
      new Error('Not enough storage'),
      { status: 403, meta: { requested: bookmarksToInsert.length, remaining: remainingSlots } },
    ) as ValidationError;
    throw e;
  }

  return { bookmarksToInsert, validTabs };
}
