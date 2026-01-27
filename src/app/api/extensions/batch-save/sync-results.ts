import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncResults, ValidationError } from './types';

export async function buildSyncResultsSince(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
  uploadedUrls: string[],
): Promise<SyncResults['downloaded']> {
  const [bookmarkRes, collectionsRes, tagsRes] = await Promise.all([
    supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', sinceIso)
      .is('deleted_at', null),
    supabase
      .from('collections')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', sinceIso)
      .is('deleted_at', null),
    supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', sinceIso)
      .is('deleted_at', null),
  ]);

  if (bookmarkRes.error) throw Object.assign(bookmarkRes.error, { status: 500, context: 'bookmarks' });
  if (collectionsRes.error) throw Object.assign(collectionsRes.error, { status: 500, context: 'collections' });
  if (tagsRes.error) throw Object.assign(tagsRes.error, { status: 500, context: 'tags' });

  return {
    bookmarks: (bookmarkRes.data || []).filter(b => !uploadedUrls.includes(b.url)),
    collections: collectionsRes.data || [],
    tags: tagsRes.data || [],
  };
}
