import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { BookMarked } from 'lucide-react';
import { Suspense } from 'react';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookMarked className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">MimeBookmark</h1>
        </div>
        <p className="text-muted-foreground">
          Reset your password
        </p>
      </div>

      <Suspense fallback={<div className="w-full max-w-md animate-pulse bg-muted h-64 rounded-lg" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
