'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Label } from '@/components/ui/label';
import { Search, Plus } from 'lucide-react';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  domain: string;
}

export default function BookmarksPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [urlError, setUrlError] = useState('');
  const [titleError, setTitleError] = useState('');

  // Shared reset function for form state
  const resetFormState = () => {
    setUrl('');
    setTitle('');
    setUrlError('');
    setTitleError('');
  };

  const filteredBookmarks = bookmarks.filter(b =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear existing errors
    setUrlError('');
    setTitleError('');

    // Validate required fields
    if (!url) {
      setUrlError('URL is required');
      return;
    }

    if (!title) {
      setTitleError('Title is required');
      return;
    }

    // Validate URL format before parsing
    try {
      new URL(url);
    } catch {
      setUrlError('Invalid URL format');
      return;
    }

    // TODO: Implement actual bookmark creation logic
    const parsedUrl = new URL(url);
    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      url,
      title,
      domain: parsedUrl.hostname,
    };

    setBookmarks([...bookmarks, newBookmark]);
    resetFormState();
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookmarks</h1>
          <p className="text-muted-foreground">Manage your bookmarks here.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Bookmark
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search bookmarks..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search bookmarks"
        />
      </div>

      {/* Content */}
      {filteredBookmarks.length === 0 ? (
        /* Empty State - distinguish between no results and no bookmarks */
        searchTerm ? (
          /* No search results */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No results for '{searchTerm}'</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms
            </p>
          </div>
        ) : (
          /* No bookmarks at all */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No bookmarks yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by adding your first bookmark
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bookmark
            </Button>
          </div>
        )
      ) : (
        /* Bookmarks List */
        <div className="grid gap-4">
          {filteredBookmarks.map((bookmark) => (
            <div key={bookmark.id} className="p-4 border rounded-lg">
              <h3 className="font-semibold">{bookmark.title}</h3>
              <p className="text-sm text-muted-foreground">{bookmark.url}</p>
              <p className="text-xs text-muted-foreground">{bookmark.domain}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Bookmark Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetFormState();
        }}
        title="Add Bookmark"
        footer={
          <Button type="button" variant="outline" onClick={() => {
            setIsAddModalOpen(false);
            resetFormState();
          }}>
            Cancel
          </Button>
        }
      >
        <form onSubmit={handleSave}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setUrlError('');
                }}
              />
              {urlError && <p className="text-sm text-destructive">{urlError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                type="text"
                placeholder="My Bookmark"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleError('');
                }}
              />
              {titleError && <p className="text-sm text-destructive">{titleError}</p>}
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit">Save</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
