'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bookmark } from '@/hooks/use-bookmarks';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Star, ExternalLink, MoreHorizontal, Trash2, Archive, Copy } from 'lucide-react';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onDelete: (id: string) => Promise<boolean>;
  onToggleFavorite: (id: string) => Promise<boolean>;
  onUpdate?: () => void;
}

export function BookmarkCard({ bookmark, onDelete, onToggleFavorite }: BookmarkCardProps) {
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      toast({
        title: 'Copied!',
        description: 'URL copied to clipboard',
      });
      setShowMenu(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy URL to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bookmark?')) return;

    setIsDeleting(true);
    try {
      const success = await onDelete(bookmark.id);

      if (success) {
        toast({
          title: 'Deleted',
          description: 'Bookmark has been deleted',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete bookmark',
          variant: 'destructive',
        });
      }
      setShowMenu(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete bookmark',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsFavoriteLoading(true);

    try {
      const success = await onToggleFavorite(bookmark.id);

      if (!success) {
        toast({
          title: 'Error',
          description: 'Failed to update favorite status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update favorite',
        variant: 'destructive',
      });
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  const handleFaviconError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const parent = target.parentElement;

    if (parent && bookmark.domain && bookmark.domain.length > 0) {
      // Remove the image
      target.style.display = 'none';

      // Create a span element safely
      const span = document.createElement('span');
      span.className = 'text-xs';
      span.textContent = bookmark.domain[0].toUpperCase();

      // Append the span to parent
      parent.appendChild(span);
    }
  };

  return (
    <div className="group relative bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Favicon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {bookmark.favicon_url ? (
            <img
              src={bookmark.favicon_url}
              alt=""
              className="w-6 h-6 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <img
              src={getFaviconUrl(bookmark.url) || ''}
              alt=""
              className="w-6 h-6 object-contain"
              onError={handleFaviconError}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary line-clamp-1 transition-colors"
              >
                {bookmark.title || bookmark.url}
              </Link>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {bookmark.domain}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleFavorite}
                disabled={isFavoriteLoading}
              >
                <Star
                  className={`h-4 w-4 ${
                    bookmark.is_favorite
                      ? 'fill-yellow-500 text-yellow-500'
                      : 'text-muted-foreground'
                  }`}
                />
              </Button>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-lg shadow-lg z-10 py-1">
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                      onClick={handleCopyUrl}
                    >
                      <Copy className="h-4 w-4" />
                      Copy URL
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                      onClick={() => {
                        setShowMenu(false);
                      }}
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm hover:bg-accent text-destructive flex items-center gap-2"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {bookmark.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {bookmark.description}
            </p>
          )}

          {/* Tags */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {bookmark.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close menu"
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
              setShowMenu(false);
            }
          }}
        />
      )}
    </div>
  );
}
