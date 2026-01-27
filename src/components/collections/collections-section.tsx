"use client";

import { useEffect, useState, useCallback } from "react";
import { useCollections, CollectionNode } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollectionCard } from "@/components/collections/collection-card";
import { CollectionModal } from "@/components/collections/collection-modal";
import { CollectionTree } from "@/components/collections/collection-tree";
import {
  Loader2,
  Plus,
  Search,
  SearchX,
  Grid3X3,
  ListTree,
} from "lucide-react";

interface CollectionsSectionProps {
  showHeader?: boolean;
  limit?: number;
}

type ViewMode = "grid" | "tree";

export function CollectionsSection({
  showHeader = true,
  limit,
}: CollectionsSectionProps) {
  const {
    collections,
    tree,
    loading,
    error,
    fetchCollections,
    fetchTree,
    deleteCollection,
    toggleFavorite,
    moveCollection,
  } = useCollections();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [editingCollection, setEditingCollection] =
    useState<CollectionNode | null>(null);

  useEffect(() => {
    fetchCollections({
      search: debouncedSearch,
      limit,
    });
  }, [debouncedSearch, limit, fetchCollections]);

  useEffect(() => {
    fetchTree({ search: debouncedSearch });
  }, [debouncedSearch, fetchTree]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleEditCollection = useCallback((collection: CollectionNode) => {
    setEditingCollection(collection);
    setShowModal(true);
  }, []);

  const handleMoveCollection = useCallback(
    async (id: string, parent_id: string | null) => {
      const success = await moveCollection(id, parent_id);
      if (success) {
        fetchTree({ search: debouncedSearch });
      }
    },
    [moveCollection, fetchTree, debouncedSearch],
  );

  const handleToggleFavorite = useCallback(
    async (id: string, currentIsFavorite: boolean) => {
      const success = await toggleFavorite(id, currentIsFavorite);
      if (success) {
        fetchTree({ search: debouncedSearch });
      }
      return success;
    },
    [toggleFavorite, fetchTree, debouncedSearch],
  );

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      const success = await deleteCollection(id);
      if (success) {
        fetchTree({ search: debouncedSearch });
      }
      return success;
    },
    [deleteCollection, fetchTree, debouncedSearch],
  );

  const displayedCollections = limit
    ? collections.slice(0, limit)
    : collections;

  if (error) {
    return (
      <div className='text-center py-12'>
        <p className='text-destructive'>{error}</p>
      </div>
    );
  }

  return (
    <div className='collections-section space-y-6'>
      {showHeader && (
        <div className='flex flex-col sm:flex-row gap-4'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              id='collection-search'
              placeholder='Search collections...'
              value={search}
              onChange={handleSearch}
              className='pl-10'
              aria-label='Search collections'
            />
          </div>
          <div className='flex items-center gap-2'>
            <div className='flex items-center border rounded-lg p-1'>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size='icon'
                className='h-8 w-8'
                onClick={() => setViewMode("grid")}
                aria-label='Grid view'
              >
                <Grid3X3 className='h-4 w-4' />
              </Button>
              <Button
                variant={viewMode === "tree" ? "secondary" : "ghost"}
                size='icon'
                className='h-8 w-8'
                onClick={() => setViewMode("tree")}
                aria-label='Tree view'
              >
                <ListTree className='h-4 w-4' />
              </Button>
            </div>
            <Button onClick={() => setShowModal(true)}>
              <Plus className='mr-2 h-4 w-4' />
              Add Collection
            </Button>
          </div>
        </div>
      )}

      {loading &&
      (viewMode === "tree" ? tree.length === 0 : collections.length === 0) ? (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      ) : viewMode === "tree" ? (
        <>
          {tree.length === 0 ? (
            <div className='text-center py-12'>
              <h3 className='text-lg font-medium'>No collections yet</h3>
              <p className='text-muted-foreground mt-1'>
                Organize your bookmarks into collections
              </p>
              <Button className='mt-4' onClick={() => setShowModal(true)}>
                <Plus className='mr-2 h-4 w-4' />
                Add Collection
              </Button>
            </div>
          ) : (
            <CollectionTree
              tree={tree}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDeleteCollection}
              onEdit={handleEditCollection}
              onMove={handleMoveCollection}
            />
          )}
        </>
      ) : displayedCollections.length === 0 ? (
        <div className='text-center py-12'>
          {debouncedSearch ? (
            <>
              <SearchX className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <h3 className='text-lg font-medium'>No collections found</h3>
              <p className='text-muted-foreground mt-1'>
                Try a different search term
              </p>
            </>
          ) : (
            <>
              <h3 className='text-lg font-medium'>No collections yet</h3>
              <p className='text-muted-foreground mt-1'>
                Organize your bookmarks into collections
              </p>
              <Button className='mt-4' onClick={() => setShowModal(true)}>
                <Plus className='mr-2 h-4 w-4' />
                Add Collection
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {displayedCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onDelete={handleDeleteCollection}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      <CollectionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingCollection(null);
        }}
        collection={editingCollection}
        onSuccess={() => {
          fetchCollections({ search: debouncedSearch, limit });
          fetchTree({ search: debouncedSearch });
          setEditingCollection(null);
        }}
      />
    </div>
  );
}
