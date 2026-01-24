import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

/**
 * Normalize and validate the site URL from environment
 */
function normalizeSiteUrl(url: string | undefined): string {
  const defaultUrl = 'https://mimebookmark.app';

  if (!url) {
    return defaultUrl;
  }

  try {
    // Add https:// if missing a scheme
    const urlWithScheme = url.match(/^https?:\/\//i) ? url : `https://${url}`;

    // Validate by constructing URL
    const validatedUrl = new URL(urlWithScheme);

    // Ensure it's http or https
    if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
      console.warn(`Invalid protocol in NEXT_PUBLIC_APP_URL: ${validatedUrl.protocol}. Using default.`);
      return defaultUrl;
    }

    // Preserve pathname if present, normalize trailing slash
    let pathname = validatedUrl.pathname;
    if (!pathname || pathname === '/') {
      return validatedUrl.origin;
    }
    // Ensure pathname starts with / and has no trailing slash
    pathname = pathname.startsWith('/') ? pathname : '/' + pathname;
    pathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    return validatedUrl.origin + pathname;
  } catch (error) {
    console.warn(`Invalid NEXT_PUBLIC_APP_URL: ${url}. Using default.`, error);
    return defaultUrl;
  }
}

const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_APP_URL);

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: 'MimeBookmark - Your Personal Bookmark Manager',
    template: '%s | MimeBookmark',
  },
  description: 'Organize, search, and manage your bookmarks across all platforms. Cross-platform bookmark management with AI-powered organization.',
  keywords: ['bookmarks', 'bookmark manager', 'organization', 'productivity', 'pwa', 'cross-platform'],
  authors: [{ name: 'MimeBookmark Team' }],
  creator: 'MimeBookmark',
  publisher: 'MimeBookmark',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'MimeBookmark',
    title: 'MimeBookmark - Your Personal Bookmark Manager',
    description: 'Organize, search, and manage your bookmarks across all platforms.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'MimeBookmark Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MimeBookmark - Your Personal Bookmark Manager',
    description: 'Organize, search, and manage your bookmarks across all platforms.',
    images: [`${siteUrl}/og-image.png`],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MimeBookmark',
    startupImage: [
      '/icons/icon-512x512.png',
      { url: '/icons/apple-splash-640-1136.png', media: '(device-width: 320px) and (device-height: 568px)' },
      { url: '/icons/apple-splash-750-1334.png', media: '(device-width: 375px) and (device-height: 667px)' },
      { url: '/icons/apple-splash-1242-2688.png', media: '(device-width: 414px) and (device-height: 896px)' },
      { url: '/icons/apple-splash-1125-2436.png', media: '(device-width: 375px) and (device-height: 812px)' },
      { url: '/icons/apple-splash-1536-2048.png', media: '(device-width: 768px) and (device-height: 1024px)' },
    ],
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#6366f1',
    'msapplication-tap-highlight': 'no',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
