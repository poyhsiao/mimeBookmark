import { RegisterForm } from '@/components/auth/register-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { Separator } from '@/components/ui/separator';
import { BookMarked } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookMarked className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">MimeBookmark</h1>
        </div>
        <p className="text-muted-foreground">
          Start organizing your bookmarks today
        </p>
      </div>
      
      <OAuthButtons isLoading={false} />
      
      <div className="w-full max-w-md my-6 relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      
      <RegisterForm />
    </div>
  );
}
