'use client';

import { useEffect, useState } from 'react';
import { useCollections } from '@/hooks/use-collections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CollectionCard } from '@/components/collections/collection-card';
import { CollectionModal } from '@/components/collections/collection-modal';
import { Loader2, Plus, Search, SearchX } from 'lucide-react';

interface CollectionsSectionProps {
  showHeader?: boolean;
  limit?: number;
}

export function CollectionsSection({ showHeader = true, limit }: CollectionsSectionProps) {
  const { collections, loading, error, fetchCollections, deleteCollection, toggleFavorite } = useCollections();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchCollections({
      search: debouncedSearch,
      limit,
    });
  }, [debouncedSearch, fetchCollections, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const displayedCollections = limit ? collections.slice(0, limit) : collections;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="collection-search"
              placeholder="Search collections..."
              value={search}
              onChange={handleSearch}
              className="pl-10"
              aria-label="Search collections"
            />
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Collection
          </Button>
        </div>
      )}

      {loading && collections.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayedCollections.length === 0 ? (
        <div className="text-center py-12">
          {debouncedSearch ? (
            <>
              <SearchX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No collections found</h3>
              <p className="text-muted-foreground mt-1">
                Try a different search term
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium">No collections yet</h3>
              <p className="text-muted-foreground mt-1">
                Organize your bookmarks into collections
              </p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first collection
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedCollections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onDelete={deleteCollection}
              onToggleFavorite={(id, currentIsFavorite) => toggleFavorite(id, currentIsFavorite)}
            />
          ))}
        </div>
      )}

      <CollectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => fetchCollections({ search: debouncedSearch, limit })}
      />
    </div>
  );
}
