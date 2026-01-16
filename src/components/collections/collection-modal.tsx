"use client";

import { useState, useEffect } from "react";
import { useCollections } from "@/hooks/use-collections";
import { useToast } from "@/hooks/use-toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#6366F1",
];

export function CollectionModal({
  isOpen,
  onClose,
  onSuccess,
}: CollectionModalProps) {
  const { createCollection, loading } = useCollections();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setColor(COLORS[0]);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a collection name",
        variant: "destructive",
      });
      return;
    }

    const collection = await createCollection({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });

    if (collection) {
      toast({
        title: "Collection created",
        description: "Your collection has been created",
      });
      handleClose();
      onSuccess?.();
    } else {
      toast({
        title: "Error",
        description: "Failed to create collection",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='Create Collection'
      footer={
        <>
          <Button variant='outline' onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type='submit' form='collection-form' disabled={loading}>
            {loading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating...
              </>
            ) : (
              <>
                <Plus className='mr-2 h-4 w-4' />
                Create Collection
              </>
            )}
          </Button>
        </>
      }
    >
      <form id='collection-form' onSubmit={handleSubmit} className='space-y-4'>
        <div className='space-y-2'>
          <label htmlFor='name' className='text-sm font-medium'>
            Name <span className='text-destructive'>*</span>
          </label>
          <Input
            id='name'
            type='text'
            placeholder='My Collection'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className='space-y-2'>
          <label htmlFor='description' className='text-sm font-medium'>
            Description
          </label>
          <textarea
            id='description'
            className='w-full min-h-[80px] px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
            placeholder='Add a description (optional)'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>

        <fieldset className='space-y-2'>
          <legend className='text-sm font-medium'>Color</legend>
          <div role='radiogroup' className='flex flex-wrap gap-2'>
            {COLORS.map((c) => (
              <button
                key={c}
                type='button'
                role='radio'
                aria-checked={color === c ? 'true' : 'false'}
                tabIndex={color === c ? 0 : -1}
                className={`w-8 h-8 rounded-full transition-transform color-btn-${COLORS.indexOf(
                  c
                )} ${
                  color === c
                    ? "ring-2 ring-offset-2 ring-primary scale-110"
                    : ""
                }`}
                onClick={() => setColor(c)}
                disabled={loading}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
