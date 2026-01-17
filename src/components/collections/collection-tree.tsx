'use client';

import { useState, useEffect, useRef } from 'react';
import { CollectionNode } from '@/hooks/use-collections';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Star,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  GripVertical,
} from 'lucide-react';

interface CollectionTreeItemProps {
  node: CollectionNode;
  onToggleFavorite: (id: string, currentIsFavorite: boolean) => void;
  onDelete: (id: string) => Promise<boolean>;
  onEdit: (collection: CollectionNode) => void;
  onMove: (id: string, parent_id: string | null) => void;
}

function CollectionTreeItem({
  node,
  onToggleFavorite,
  onDelete,
  onEdit,
  onMove,
}: CollectionTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const success = await onDelete(node.id);

      if (success) {
        toast({
          title: 'Deleted',
          description: 'Collection has been deleted',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete collection',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete collection',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/dashboard/collections/${node.id}`
      );
      toast({
        title: 'Copied!',
        description: 'Collection link copied to clipboard',
      });
      setShowMenu(false);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy link. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const handleMoveToRoot = () => {
    onMove(node.id, null);
    setShowMenu(false);
  };

  const handleMoveUnder = () => {
    setShowMoveModal(true);
    setShowMenu(false);
  };

  return (
    <div className='select-none'>
      <div className='flex items-center gap-2 py-2 pr-4 hover:bg-accent/50 rounded-lg group'>
        <button
          type='button'
          className='p-0.5 hover:bg-muted rounded transition-colors'
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {node.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className='h-4 w-4 text-muted-foreground' />
            ) : (
              <ChevronRight className='h-4 w-4 text-muted-foreground' />
            )
          ) : (
            <div className='w-4' />
          )}
        </button>

        {/* GripVertical hidden until drag-and-drop is implemented */}
        {/* <GripVertical className='h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab' /> */}

        <div
          className='flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center'
          style={{ backgroundColor: `${node.color}20` }}
        >
          {isExpanded ? (
            <FolderOpen className='h-4 w-4' style={{ color: node.color }} />
          ) : (
            <Folder className='h-4 w-4' style={{ color: node.color }} />
          )}
        </div>

        <span className='flex-1 font-medium truncate'>{node.name}</span>

        <span className='text-xs text-muted-foreground'>
          {node.bookmarks_count} items
        </span>

        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(node.id, node.is_favorite);
            }}
          >
            <Star
              className={`h-4 w-4 ${
                node.is_favorite
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'text-muted-foreground'
              }`}
            />
          </Button>

          <div className='relative'>
            <Button
              variant='ghost'
              size='icon'
              className='h-8 w-8'
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
            >
              <MoreHorizontal className='h-4 w-4' />
            </Button>

            {showMenu && (
              <div ref={menuRef} className='absolute right-0 top-full mt-1 w-48 bg-popover border rounded-lg shadow-lg z-10 py-1'>
                <button
                  type='button'
                  className='w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2'
                  onClick={() => {
                    onEdit(node);
                    setShowMenu(false);
                  }}
                >
                  <Edit className='h-4 w-4' />
                  Edit
                </button>
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
                  className='w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2'
                  onClick={handleMoveToRoot}
                >
                  Move to root
                </button>
                <button
                  type='button'
                  className='w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2'
                  onClick={handleMoveUnder}
                >
                  Move under...
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

      {isExpanded && node.children.length > 0 && (
        <div className='border-l border-dashed border-muted-foreground/20 ml-8'>
          {node.children.map((child) => (
            <CollectionTreeItem
              key={child.id}
              node={child}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDelete}
              onEdit={onEdit}
              onMove={onMove}
            />
          ))}
        </div>
      )}

      {/* Move to collection modal - TODO: Replace with proper accessible modal */}
      {showMoveModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowMoveModal(false)}
        >
          <div
            className="bg-popover border rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="move-modal-title"
            aria-modal="true"
          >
            <h2 id="move-modal-title" className="text-lg font-semibold mb-4">
              Move Collection
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              This feature is under development. Please use the "Move to root" option for now.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowMoveModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CollectionTreeProps {
  tree: CollectionNode[];
  onToggleFavorite: (id: string, currentIsFavorite: boolean) => void;
  onDelete: (id: string) => Promise<boolean>;
  onEdit: (collection: CollectionNode) => void;
  onMove: (id: string, parent_id: string | null) => void;
}

export function CollectionTree({
  tree,
  onToggleFavorite,
  onDelete,
  onEdit,
  onMove,
}: CollectionTreeProps) {
  if (tree.length === 0) {
    return (
      <div className='text-center py-12'>
        <Folder className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
        <h3 className='text-lg font-medium'>No collections</h3>
        <p className='text-muted-foreground mt-1'>
          Create your first collection to get started
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-1'>
      {tree.map((node) => (
        <CollectionTreeItem
          key={node.id}
          node={node}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDelete}
          onEdit={onEdit}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
