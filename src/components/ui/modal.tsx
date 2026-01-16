'use client';

import { useEffect, useRef, useId } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef<string>('');
  const titleId = useId();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      // Store previously focused element and overflow value
      previousFocusRef.current = document.activeElement as HTMLElement;
      previousOverflowRef.current = document.body.style.overflow;

      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      // Focus the dialog when opened
      if (dialogRef.current) {
        dialogRef.current.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);

      // Restore previous overflow value
      document.body.style.overflow = previousOverflowRef.current;

      // Restore focus when modal closes
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md bg-background rounded-lg shadow-lg"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 p-4 border-t bg-muted/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
