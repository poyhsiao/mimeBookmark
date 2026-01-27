import type { SupabaseClient } from '@supabase/supabase-js';
import type { UpsertedBookmark } from './types';

export async function syncTagsForBookmarks(
  supabase: SupabaseClient,
  userId: string,
  tags: unknown,
  bookmarks: UpsertedBookmark[],
): Promise<number> {
  const tagNames = (Array.isArray(tags) ? tags : [])
    .filter(t => typeof t === 'string' && t.trim().length > 0)
    .map(t => t.toLowerCase());

  if (tagNames.length === 0 || bookmarks.length === 0) return 0;

  const tagNameToId: Record<string, string> = {};

  const { data: existingTags } = await supabase
    .from('tags')
    .select('id, name')
    .eq('user_id', userId)
    .in('name', tagNames)
    .is('deleted_at', null);

  if (existingTags) {
    for (const tag of existingTags) {
      tagNameToId[tag.name.toLowerCase()] = tag.id;
    }
  }

  const lowerToCanonical: Record<string, string> = {};
  for (const t of tagNames) {
    if (!tagNameToId[t] && !lowerToCanonical[t]) {
      lowerToCanonical[t] = t;
    }
  }

  const tagsToCreate = Object.values(lowerToCanonical);

  if (tagsToCreate.length > 0) {
    const { data: insertedTags, error: insertError } = await supabase
      .from('tags')
      .insert(
        tagsToCreate.map(tag => ({
          user_id: userId,
          name: tag,
          color: '#6B7280',
        }))
      )
      .select('id, name');

    if (insertError) {
      console.error('Failed to create tags:', insertError);
      const { data: fallbackTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', userId)
        .in('name', tagNames)
        .is('deleted_at', null);

      if (fallbackTags) {
        for (const tag of fallbackTags) {
          tagNameToId[tag.name.toLowerCase()] = tag.id;
        }
      }
    } else if (insertedTags) {
      for (const tag of insertedTags) {
        tagNameToId[tag.name.toLowerCase()] = tag.id;
      }
    }
  }

  const tagLinks: { bookmark_id: string; tag_id: string }[] = [];
  for (const bookmark of bookmarks) {
    for (const tagName of tagNames) {
      if (typeof tagName !== 'string' || !tagName.trim()) continue;
      const tagId = tagNameToId[tagName.toLowerCase()];
      if (tagId) {
        tagLinks.push({
          bookmark_id: bookmark.id,
          tag_id: tagId,
        });
      }
    }
  }

  if (tagLinks.length > 0) {
    const { error: tagLinksError } = await supabase
      .from('bookmark_tags')
      .upsert(tagLinks);

    if (tagLinksError) {
      console.error('Failed to link tags to bookmarks:', tagLinksError);
      return 0;
    }
  }

  return new Set(tagLinks.map(link => link.tag_id)).size;
}
