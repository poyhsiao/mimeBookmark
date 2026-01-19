"use client";

import { useState, useCallback } from "react";

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

export interface UseTagsReturn {
  tags: Tag[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  hotTags: Tag[];
  fetchTags: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: "newest" | "oldest" | "name";
  }) => Promise<void>;
  fetchHotTags: (limit?: number) => Promise<void>;
  createTag: (tag: { name: string; color?: string }) => Promise<Tag | null>;
  updateTag: (id: string, updates: Partial<Tag>) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
  addTagsToBookmark: (bookmarkId: string, tagIds: string[]) => Promise<boolean>;
  removeTagsFromBookmark: (
    bookmarkId: string,
    tagIds: string[],
  ) => Promise<boolean>;
}

export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<Tag[]>([]);
  const [hotTags, setHotTags] = useState<Tag[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadingCount, setLoadingCount] = useState(0);
  const loading = loadingCount > 0;
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(
    async (options?: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: "newest" | "oldest" | "name";
    }) => {
      setLoadingCount((c) => c + 1);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.page !== undefined)
          params.set("page", options.page.toString());
        if (options?.limit !== undefined)
          params.set("limit", options.limit.toString());
        if (options?.search) params.set("search", options.search);
        if (options?.sort) params.set("sort", options.sort);

        const response = await fetch(`/api/tags?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch tags");
        }

        setTags(data.tags);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoadingCount((c) => c - 1);
      }
    },
    [],
  );

  const createTag = useCallback(
    async (tag: { name: string; color?: string }): Promise<Tag | null> => {
      setLoadingCount((c) => c + 1);
      setError(null);

      try {
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tag),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create tag");
        }

        setTags((prev) => [data.tag, ...prev]);
        return data.tag;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return null;
      } finally {
        setLoadingCount((c) => c - 1);
      }
    },
    [],
  );

  const updateTag = useCallback(
    async (id: string, updates: Partial<Tag>): Promise<boolean> => {
      setLoadingCount((c) => c + 1);
      setError(null);

      try {
        const response = await fetch(`/api/tags/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update tag");
        }

        setTags((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...data.tag } : t)),
        );
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setLoadingCount((c) => c - 1);
      }
    },
    [],
  );

  const fetchHotTags = useCallback(
    async (limit: number = 10): Promise<void> => {
      setLoadingCount((c) => c + 1);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", limit.toString());

        const response = await fetch(`/api/tags/hot?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch hot tags");
        }

        setHotTags(data.tags);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoadingCount((c) => c - 1);
      }
    },
    [],
  );

  const deleteTag = useCallback(async (id: string): Promise<boolean> => {
    setLoadingCount((c) => c + 1);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete tag");
      }

      setTags((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setLoadingCount((c) => c - 1);
    }
  }, []);

  const addTagsToBookmark = useCallback(
    async (bookmarkId: string, tagIds: string[]): Promise<boolean> => {
      setLoadingCount((c) => c + 1);
      setError(null);

      try {
        const response = await fetch("/api/tags/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmark_id: bookmarkId, tag_ids: tagIds }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to add tags to bookmark");
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setLoadingCount((c) => c - 1);
      }
    },
    [],
  );

  const removeTagsFromBookmark = useCallback(
    async (bookmarkId: string, tagIds: string[]): Promise<boolean> => {
      setLoadingCount((c) => c + 1);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("bookmark_id", bookmarkId);
        params.set("tag_ids", tagIds.join(","));

        const response = await fetch(`/api/tags/bookmarks?${params}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove tags from bookmark");
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setLoadingCount((c) => c - 1);
      }
    },
    [],
  );

  return {
    tags,
    pagination,
    loading,
    error,
    hotTags,
    fetchTags,
    fetchHotTags,
    createTag,
    updateTag,
    deleteTag,
    addTagsToBookmark,
    removeTagsFromBookmark,
  };
}
