'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bookmark } from '@/hooks/use-bookmarks';
import { useToast } from '@/hooks/use-toast';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface EditBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
  onSuccess?: () => void;
}

export function EditBookmarkModal({ isOpen, onClose, bookmark, onSuccess }: EditBookmarkModalProps) {
  const { updateBookmark, loading } = useBookmarks();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Sync form fields with bookmark data when modal opens
  useEffect(() => {
    if (bookmark && isOpen) {
      setUrl(bookmark.url);
      setTitle(bookmark.title || '');
      setDescription(bookmark.description || '');
    }
  }, [bookmark, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookmark) return;

    if (!url.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a URL',
        variant: 'destructive',
      });
      return;
    }

    const success = await updateBookmark(bookmark.id, {
      url: url.trim(),
      title: title.trim() || undefined,
      description: description.trim() || undefined,
    });

    if (success) {
      toast({ title: 'Updated', description: 'Bookmark has been updated' });
      handleClose();
      onSuccess?.();
    } else {
      toast({
        title: 'Error',
        description: 'Failed to update bookmark',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setUrl('');
    setTitle('');
    setDescription('');
    onClose();
  };

  if (!bookmark) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Bookmark"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="edit-bookmark-form" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </>
      }
    >
      <form id="edit-bookmark-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="edit-url" className="text-sm font-medium">
            URL <span className="text-destructive">*</span>
          </label>
          <Input
            id="edit-url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="edit-title"
            type="text"
            placeholder="Page title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="edit-description"
            className="w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add a description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
      </form>
    </Modal>
  );
}

function useBookmarks() {
  const [loading, setLoading] = useState(false);

  const updateBookmark = useCallback(async (id: string, updates: {
    url?: string;
    title?: string;
    description?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch(`/api/bookmarks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update');
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateBookmark, loading };
}
