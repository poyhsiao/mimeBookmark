"use client";

import { useState, useCallback } from "react";

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

export interface CollectionNode {
  id: string;
  parent_id?: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_public: boolean;
  is_favorite: boolean;
  sort_order: number;
  bookmarks_count: number;
  children: CollectionNode[];
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
  tree: CollectionNode[];
  pagination: Pagination | null;
  loading: boolean;
  isFetching: boolean;
  isFetchingTree: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isReordering: boolean;
  error: string | null;
  fetchCollections: (options?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: "newest" | "oldest" | "name";
  }) => Promise<void>;
  fetchTree: (options?: { search?: string }) => Promise<void>;
  createCollection: (collection: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    parent_id?: string;
  }) => Promise<Collection | null>;
  updateCollection: (
    id: string,
    updates: Partial<Collection>,
  ) => Promise<boolean>;
  deleteCollection: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string, currentIsFavorite: boolean) => Promise<boolean>;
  reorderCollections: (collectionIds: string[]) => Promise<boolean>;
  moveCollection: (id: string, parent_id: string | null) => Promise<boolean>;
}

export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tree, setTree] = useState<CollectionNode[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingTree, setIsFetchingTree] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading =
    isFetching ||
    isFetchingTree ||
    isCreating ||
    isUpdating ||
    isDeleting ||
    isReordering;

  const fetchCollections = useCallback(
    async (options?: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: "newest" | "oldest" | "name";
    }) => {
      setIsFetching(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.page !== undefined)
          params.set("page", options.page.toString());
        if (options?.limit !== undefined)
          params.set("limit", options.limit.toString());
        if (options?.search) params.set("search", options.search);
        if (options?.sort) params.set("sort", options.sort);

        const response = await fetch(`/api/collections?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch collections");
        }

        setCollections(data.collections);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsFetching(false);
      }
    },
    [],
  );

  const createCollection = useCallback(
    async (collection: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      parent_id?: string;
    }): Promise<Collection | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(collection),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create collection");
        }

        setCollections((prev) => [data.collection, ...prev]);
        return data.collection;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  const updateCollection = useCallback(
    async (id: string, updates: Partial<Collection>): Promise<boolean> => {
      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch(`/api/collections/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update collection");
        }

        setCollections((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...data.collection } : c)),
        );
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  const deleteCollection = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete collection");
      }

      setCollections((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (id: string, currentIsFavorite: boolean): Promise<boolean> => {
      // Optimistic update for collections
      setCollections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_favorite: !currentIsFavorite } : c,
        ),
      );

      const updateTreeNodeWithValue = (
        nodes: CollectionNode[],
        targetId: string,
        value: boolean,
      ): CollectionNode[] => {
        return nodes.map((node) => {
          if (node.id === targetId) {
            return { ...node, is_favorite: value };
          }
          if (node.children.length > 0) {
            return {
              ...node,
              children: updateTreeNodeWithValue(node.children, targetId, value),
            };
          }
          return node;
        });
      };

      setTree((prev) => updateTreeNodeWithValue(prev, id, !currentIsFavorite));

      const success = await updateCollection(id, {
        is_favorite: !currentIsFavorite,
      });

      // Rollback on failure
      if (!success) {
        setCollections((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, is_favorite: currentIsFavorite } : c,
          ),
        );
        setTree((prev) => updateTreeNodeWithValue(prev, id, currentIsFavorite));
      }

      return success;
    },
    [updateCollection],
  );

  const fetchTree = useCallback(async (options?: { search?: string }) => {
    setIsFetchingTree(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.search) params.set("search", options.search);

      const response = await fetch(`/api/collections/tree?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch collection tree");
      }

      setTree(data.tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsFetchingTree(false);
    }
  }, []);

  const reorderCollections = useCallback(
    async (collectionIds: string[]): Promise<boolean> => {
      setIsReordering(true);
      setError(null);

      try {
        const response = await fetch("/api/collections/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collectionIds }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to reorder collections");
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setIsReordering(false);
      }
    },
    [],
  );

  const moveCollection = useCallback(
    async (id: string, parent_id: string | null): Promise<boolean> => {
      setIsUpdating(true);
      setError(null);

      try {
        const response = await fetch(`/api/collections/${id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to move collection");
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return {
    collections,
    tree,
    pagination,
    loading,
    isFetching,
    isFetchingTree,
    isCreating,
    isUpdating,
    isDeleting,
    isReordering,
    error,
    fetchCollections,
    fetchTree,
    createCollection,
    updateCollection,
    deleteCollection,
    toggleFavorite,
    reorderCollections,
    moveCollection,
  };
}
