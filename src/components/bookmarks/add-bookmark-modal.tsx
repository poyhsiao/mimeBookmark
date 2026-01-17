'use client';

import { useState, useEffect } from 'react';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { useToast } from '@/hooks/use-toast';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus } from 'lucide-react';

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddBookmarkModal({ isOpen, onClose, onSuccess }: AddBookmarkModalProps) {
  const { createBookmark, loading } = useBookmarks();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [favicon, setFavicon] = useState('');
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // Helper to validate URL
  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  // Fetch metadata when URL changes (debounced)
  useEffect(() => {
    if (!url || !isValidUrl(url)) {
      setFavicon('');
      return;
    }

    const fetchMetadata = async () => {
      setIsFetchingMetadata(true);
      try {
        const params = new URLSearchParams({ url: url.trim() });
        const response = await fetch(`/api/metadata?${params}`);
        
        if (response.ok) {
          const metadata = await response.json();
          // Only auto-fill if fields are empty (user hasn't edited them)
          if (!title) setTitle(metadata.title || '');
          if (!description) setDescription(metadata.description || '');
          setFavicon(metadata.favicon || '');
        }
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      } finally {
        setIsFetchingMetadata(false);
      }
    };

    const timer = setTimeout(fetchMetadata, 500); // Debounce 500ms
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a URL',
        variant: 'destructive',
      });
      return;
    }

    try {
      const bookmark = await createBookmark({
        url: url.trim(),
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (bookmark) {
        toast({
          title: 'Bookmark added',
          description: 'Your bookmark has been saved',
        });
        handleClose();
        onSuccess?.();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add bookmark',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setUrl('');
    setTitle('');
    setDescription('');
    setFavicon('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Bookmark"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="add-bookmark-form" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Bookmark
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="add-bookmark-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="url" className="text-sm font-medium">
            URL <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading}
              className={isFetchingMetadata ? 'pr-10' : ''}
            />
            {isFetchingMetadata && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {favicon && !isFetchingMetadata && (
              <img
                src={favicon}
                alt=""
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
            {isFetchingMetadata && !title && (
              <span className="ml-2 text-xs text-muted-foreground">(fetching...)</span>
            )}
          </label>
          <Input
            id="title"
            type="text"
            placeholder="Page title (auto-fetched if empty)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
            {isFetchingMetadata && !description && (
              <span className="ml-2 text-xs text-muted-foreground">(fetching...)</span>
            )}
          </label>
          <textarea
            id="description"
            className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity50"
            placeholder="Page description (auto-fetched if empty)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
      </form>
    </Modal>
  );
}
