'use client';

import { useState, useCallback } from 'react';

export interface Collection {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_public: boolean;
  is_favorite: boolean;
  sort_order: number;
  bookmarks_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionWithBookmarks extends Collection {
  bookmarks: Array<{
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    domain: string;
    favicon_url: string | null;
    is_favorite: boolean;
    created_at: string;
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseCollectionsReturn {
  collections: Collection[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  fetchCollections: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'newest' | 'oldest' | 'name';
  }) => Promise<void>;
  createCollection: (collection: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    parent_id?: string;
  }) => Promise<Collection | null>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<boolean>;
  deleteCollection: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
}

export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async (options?: {
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

      const response = await fetch(`/api/collections?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch collections');
      }

      setCollections(data.collections);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCollection = useCallback(async (collection: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    parent_id?: string;
  }): Promise<Collection | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collection),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create collection');
      }

      setCollections(prev => [data.collection, ...prev]);
      return data.collection;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCollection = useCallback(async (id: string, updates: Partial<Collection>): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update collection');
      }

      setCollections(prev => prev.map(c => c.id === id ? { ...c, ...data.collection } : c));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCollection = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete collection');
      }

      setCollections(prev => prev.filter(c => c.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
    const collection = collections.find(c => c.id === id);
    if (!collection) return false;

    return updateCollection(id, { is_favorite: !collection.is_favorite });
  }, [collections, updateCollection]);

  return {
    collections,
    pagination,
    loading,
    error,
    fetchCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    toggleFavorite,
  };
}
