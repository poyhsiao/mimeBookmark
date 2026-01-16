"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bookmark } from "@/hooks/use-bookmarks";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { EditBookmarkModal } from "./edit-bookmark-modal";
import {
  Star,
  MoreHorizontal,
  Trash2,
  Archive,
  Copy,
  Edit2,
} from "lucide-react";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onDelete: (id: string) => Promise<boolean>;
  onToggleFavorite: (id: string) => Promise<boolean>;
  onUpdate?: () => void;
}

export function BookmarkCard({
  bookmark,
  onDelete,
  onToggleFavorite,
  onUpdate,
}: BookmarkCardProps) {
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  // Reset favicon error state when bookmark URL or favicon_url changes
  useEffect(() => {
    setFaviconError(false);
  }, [bookmark.url, bookmark.favicon_url]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      toast({ title: "Copied!", description: "URL copied to clipboard" });
      setShowMenu(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this bookmark?")) return;

    setIsDeleting(true);
    try {
      const success = await onDelete(bookmark.id);
      if (success) {
        toast({ title: "Deleted", description: "Bookmark has been deleted" });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete bookmark",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete bookmark",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onToggleFavorite(bookmark.id);
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  return (
    <>
      <div className='group relative bg-card border rounded-lg p-4 hover:shadow-md transition-shadow'>
        <div className='flex items-start gap-3'>
          <div className='flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden'>
            {bookmark.favicon_url ? (
              faviconError ? (
                bookmark.domain && (
                  <span className='text-xs'>
                    {bookmark.domain[0].toUpperCase()}
                  </span>
                )
              ) : (
                <Image
                  src={bookmark.favicon_url}
                  alt=''
                  width={24}
                  height={24}
                  className='w-6 h-6 object-contain'
                  onError={() => setFaviconError(true)}
                  unoptimized
                />
              )
            ) : getFaviconUrl(bookmark.url) ? (
              faviconError ? (
                bookmark.domain && (
                  <span className='text-xs'>
                    {bookmark.domain[0].toUpperCase()}
                  </span>
                )
              ) : (
                <Image
                  src={getFaviconUrl(bookmark.url) || ""}
                  alt=''
                  width={24}
                  height={24}
                  className='w-6 h-6 object-contain'
                  onError={() => setFaviconError(true)}
                  unoptimized
                />
              )
            ) : (
              bookmark.domain && (
                <span className='text-xs'>
                  {bookmark.domain[0].toUpperCase()}
                </span>
              )
            )}
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                <Link
                  href={bookmark.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-medium text-foreground hover:text-primary line-clamp-1 transition-colors'
                >
                  {bookmark.title || bookmark.url}
                </Link>
                <p className='text-sm text-muted-foreground line-clamp-1'>
                  {bookmark.domain}
                </p>
              </div>

              <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={handleToggleFavorite}
                >
                  <Star
                    className={`h-4 w-4 ${
                      bookmark.is_favorite
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-muted-foreground"
                    }`}
                  />
                </Button>

                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setShowEditModal(true)}
                >
                  <Edit2 className='h-4 w-4 text-muted-foreground' />
                </Button>

                <div className='relative'>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    onClick={() => setShowMenu(!showMenu)}
                  >
                    <MoreHorizontal className='h-4 w-4' />
                  </Button>

                  {showMenu && (
                    <div className='absolute right-0 top-full mt-1 w-48 bg-popover border rounded-lg shadow-lg z-10 py-1'>
                      <button
                        type='button'
                        className='w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2'
                        onClick={handleCopyUrl}
                      >
                        <Copy className='h-4 w-4' />
                        Copy URL
                      </button>
                      <button
                        type='button'
                        className='w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2'
                        onClick={() => setShowMenu(false)}
                      >
                        <Archive className='h-4 w-4' />
                        Archive
                      </button>
                      <button
                        type='button'
                        className='w-full px-4 py-2 text-left text-sm hover:bg-accent text-destructive flex items-center gap-2'
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        <Trash2 className='h-4 w-4' />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {bookmark.description && (
              <p className='text-sm text-muted-foreground mt-2 line-clamp-2'>
                {bookmark.description}
              </p>
            )}

            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className='flex flex-wrap gap-1 mt-3'>
                {bookmark.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className='bookmark-tag inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'
                    style={
                      {
                        "--tag-bg": `${tag.color}20`,
                        "--tag-color": tag.color,
                      } as React.CSSProperties
                    }
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {showMenu && (
          <button
            type='button'
            className='fixed inset-0 z-0'
            onClick={() => setShowMenu(false)}
            aria-label='Close menu'
            title='Close menu'
          />
        )}
      </div>

      <EditBookmarkModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        bookmark={bookmark}
        onSuccess={onUpdate}
      />
    </>
  );
}
