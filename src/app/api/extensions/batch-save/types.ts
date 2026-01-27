export type BookmarkToInsert = {
  user_id: string;
  url: string;
  title: string;
  description?: string;
  domain: string;
  favicon_url?: string;
  og_image?: string;
  og_title?: string;
  og_description?: string;
  source: 'extension';
  collection_id?: string;
};

export type UpsertedBookmark = BookmarkToInsert & {
  id: string;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
  is_archived?: boolean;
  is_read_later?: boolean;
  clicks?: number;
  last_opened_at?: string | null;
  user_notes?: string | null;
  user_rating?: number | null;
  deleted_at?: string | null;
};

export type SyncResults = {
  uploaded: { bookmarks: number; collections: number; tags: number };
  downloaded: {
    bookmarks: Array<Record<string, unknown>>;
    collections: Array<Record<string, unknown>>;
    tags: Array<Record<string, unknown>>;
  };
};

export type BatchSaveBody = {
  collectionId: string;
  tags?: string[];
  tabs: Array<{ url: string; title?: string; favicon?: string }>;
};

export type ValidationError = Error & { status?: number; meta?: Record<string, unknown> };
