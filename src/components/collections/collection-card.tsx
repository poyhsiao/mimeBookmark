"use client";

import { useState } from "react";
import Link from "next/link";
import { Collection } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Folder,
  FolderOpen,
  Star,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
} from "lucide-react";

interface CollectionCardProps {
  collection: Collection;
  onDelete: (id: string) => Promise<boolean>;
  onToggleFavorite: (
    id: string,
    currentIsFavorite: boolean
  ) => Promise<boolean>;
}

export function CollectionCard({
  collection,
  onDelete,
  onToggleFavorite,
}: CollectionCardProps) {
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/dashboard/collections/${collection.id}`
      );
      toast({
        title: "Copied!",
        description: "Collection link copied to clipboard",
      });
      setShowMenu(false);
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy link. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this collection? Bookmarks will not be deleted."
      )
    )
      return;

    setIsDeleting(true);
    try {
      const success = await onDelete(collection.id);

      if (success) {
        toast({
          title: "Deleted",
          description: "Collection has been deleted",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete collection",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete collection",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
    setShowMenu(false);
  };

  return (
    <div className='group relative bg-card border rounded-lg p-4 hover:shadow-md transition-shadow'>
      <div className='flex items-start gap-3'>
        <div
          className='collection-card-icon flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center'
          style={
            {
              "--collection-bg": `${collection.color}20`,
            } as React.CSSProperties
          }
        >
          <FolderOpen
            className='dynamic-icon-color h-5 w-5'
            style={
              {
                "--icon-color": collection.color,
              } as React.CSSProperties
            }
          />
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <Link
              href={`/dashboard/collections/${collection.id}`}
              className='font-medium text-foreground hover:text-primary transition-colors line-clamp-1'
            >
              {collection.name}
            </Link>

            <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavorite(collection.id, collection.is_favorite);
                }}
              >
                <Star
                  className={`h-4 w-4 ${
                    collection.is_favorite
                      ? "fill-yellow-500 text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
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
                      onClick={handleCopyLink}
                    >
                      <Copy className='h-4 w-4' />
                      Copy link
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

          {collection.description && (
            <p className='text-sm text-muted-foreground mt-1 line-clamp-2'>
              {collection.description}
            </p>
          )}

          <div className='flex items-center gap-2 mt-3 text-xs text-muted-foreground'>
            <Folder className='h-3 w-3' />
            <span>{collection.bookmarks_count} bookmarks</span>
          </div>
        </div>
      </div>

      {showMenu && (
        <button
          type='button'
          className='fixed inset-0 z-0'
          onClick={() => setShowMenu(false)}
          aria-label='Close menu'
        />
      )}
    </div>
  );
}
