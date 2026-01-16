'use client';

import { useState, useCallback } from 'react';

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseTagsReturn {
  tags: Tag[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  fetchTags: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'newest' | 'oldest' | 'name';
  }) => Promise<void>;
  createTag: (tag: { name: string; color?: string }) => Promise<Tag | null>;
  updateTag: (id: string, updates: Partial<Tag>) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
}

export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<Tag[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async (options?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'newest' | 'oldest' | 'name';
  }) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.page) params.set('page', options.page.toString());
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.search) params.set('search', options.search);
      if (options?.sort) params.set('sort', options.sort);

      const response = await fetch(`/api/tags?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tags');
      }

      setTags(data.tags);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTag = useCallback(async (tag: { name: string; color?: string }): Promise<Tag | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tag),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tag');
      }

      setTags(prev => [data.tag, ...prev]);
      return data.tag;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTag = useCallback(async (id: string, updates: Partial<Tag>): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tag');
      }

      setTags(prev => prev.map(t => t.id === id ? { ...t, ...data.tag } : t));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTag = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete tag');
      }

      setTags(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    tags,
    pagination,
    loading,
    error,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
  };
}
