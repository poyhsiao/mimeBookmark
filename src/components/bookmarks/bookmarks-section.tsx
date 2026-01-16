'use client';

import { useEffect, useState } from 'react';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookmarkCard } from '@/components/bookmarks/bookmark-card';
import { AddBookmarkModal } from '@/components/bookmarks/add-bookmark-modal';
import { Loader2, Plus, Search, SearchX } from 'lucide-react';

export function BookmarksSection() {
  const { bookmarks, loading, error, fetchBookmarks, deleteBookmark, toggleFavorite } = useBookmarks();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    fetchBookmarks({ search: debouncedSearch });
  }, [debouncedSearch, fetchBookmarks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search and add button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bookmarks..."
            value={search}
            onChange={handleSearch}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Bookmark
        </Button>
      </div>

      {/* Bookmarks list */}
      {loading && bookmarks.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-12">
          {search ? (
            <>
              <SearchX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No bookmarks found</h3>
              <p className="text-muted-foreground mt-1">
                Try a different search term
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium">No bookmarks yet</h3>
              <p className="text-muted-foreground mt-1">
                Start saving your favorite websites
              </p>
              <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first bookmark
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={deleteBookmark}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      <AddBookmarkModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchBookmarks({ search: debouncedSearch })}
      />
    </div>
  );
}
