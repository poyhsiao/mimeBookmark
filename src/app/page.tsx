import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">MimeBookmark</h1>
      <p className="text-lg text-muted-foreground mb-8 text-center max-w-md">
        Your personal bookmark manager. Organize, search, and access your bookmarks from anywhere.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="px-6 py-3 border border-input bg-background rounded-lg hover:bg-accent transition-colors"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
