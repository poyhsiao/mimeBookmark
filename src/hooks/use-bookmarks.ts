'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  domain: string;
  favicon_url: string | null;
  og_image: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  collections?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  fetchBookmarks: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    collection_id?: string;
    is_favorite?: boolean;
    is_archived?: boolean;
    sort?: 'newest' | 'oldest' | 'name' | 'domain' | 'clicks';
  }) => Promise<void>;
  createBookmark: (bookmark: {
    url: string;
    title?: string;
    description?: string;
    collection_id?: string;
    tags?: string[];
  }) => Promise<Bookmark | null>;
  updateBookmark: (id: string, updates: Partial<Bookmark>) => Promise<boolean>;
  deleteBookmark: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
}

export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchBookmarks = useCallback(async (options?: {
    page?: number;
    limit?: number;
    search?: string;
    collection_id?: string;
    is_favorite?: boolean;
    is_archived?: boolean;
    sort?: 'newest' | 'oldest' | 'name' | 'domain' | 'clicks';
  }) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.page) params.set('page', options.page.toString());
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.search) params.set('search', options.search);
      if (options?.collection_id) params.set('collection_id', options.collection_id);
      if (options?.is_favorite !== undefined) params.set('is_favorite', options.is_favorite.toString());
      if (options?.is_archived !== undefined) params.set('is_archived', options.is_archived.toString());
      if (options?.sort) params.set('sort', options.sort);

      const response = await fetch(`/api/bookmarks?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch bookmarks');
      }

      setBookmarks(data.bookmarks);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const createBookmark = useCallback(async (bookmark: {
    url: string;
    title?: string;
    description?: string;
    collection_id?: string;
    tags?: string[];
  }): Promise<Bookmark | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookmark),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create bookmark');
      }

      setBookmarks(prev => [data.bookmark, ...prev]);
      return data.bookmark;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBookmark = useCallback(async (id: string, updates: Partial<Bookmark>): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update bookmark');
      }

      setBookmarks(prev => prev.map(b => b.id === id ? { ...b, ...data.bookmark } : b));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBookmark = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete bookmark');
      }

      setBookmarks(prev => prev.filter(b => b.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) return false;

    return updateBookmark(id, { is_favorite: !bookmark.is_favorite });
  }, [bookmarks, updateBookmark]);

  return {
    bookmarks,
    pagination,
    loading,
    error,
    fetchBookmarks,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
  };
}
