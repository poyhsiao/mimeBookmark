import type { Metadata } from './metadata-types';

/**
 * Fetch metadata from a URL
 * Extracts title, description, favicon, and Open Graph data
 */
export async function fetchMetadata(url: string): Promise<Metadata> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MimeBookmark/1.0; +http://localhost:3000)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return parseMetadata(html, url);
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Return minimal metadata on error
    const domain = extractDomain(url);
    return {
      title: '',
      description: '',
      image: '',
      siteName: domain,
      domain,
      favicon: `https://${domain}/favicon.ico`,
      url,
    };
  }
}

/**
 * Parse HTML and extract metadata
 */
function parseMetadata(html: string, url: string): Metadata {
  const domain = extractDomain(url);
  
  // Extract using regex for performance (cheerio is too heavy for edge)
  const title = extractTitle(html) || '';
  const description = extractMeta(html, 'description') || extractOgProperty(html, 'description') || '';
  const image = extractOgProperty(html, 'image') || extractTwitterProperty(html, 'image') || '';
  const siteName = extractMeta(html, 'site_name') || extractOgProperty(html, 'site_name') || domain;

  // Extract favicon
  let favicon = extractFavicon(html, url) || `https://${domain}/favicon.ico`;

  return {
    title: title.slice(0, 500), // Limit title length
    description: description.slice(0, 1000), // Limit description length
    image,
    siteName,
    domain,
    favicon,
    url,
  };
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

function extractTitle(html: string): string {
  // Try Open Graph title first
  const ogTitle = extractOgProperty(html, 'title');
  if (ogTitle) return ogTitle;

  // Fall back to regular title tag
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`, 'i'),
    new RegExp(`<meta\\s+property=["']${name}["']\\s+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+property=["']${name}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

function extractOgProperty(html: string, property: string): string {
  return extractMeta(html, `og:${property}`);
}

function extractTwitterProperty(html: string, property: string): string {
  return extractMeta(html, `twitter:${property}`);
}

function extractFavicon(html: string, url: string): string | undefined {
  // Try to find favicon link
  const patterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+\.ico)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
    /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const href = match[1];
      if (href.startsWith('http')) return href;
      if (href.startsWith('//')) return `https:${href}`;
      if (href.startsWith('/')) {
        const urlObj = new URL(url);
        return `${urlObj.protocol}//${urlObj.hostname}${href}`;
      }
    }
  }

  return undefined;
}

/**
 * Fetch favicon directly from known sources
 */
export async function fetchFavicon(url: string): Promise<string | null> {
  const domain = extractDomain(url);
  
  // Try common favicon locations
  const faviconUrls = [
    `https://${domain}/favicon.ico`,
    `https://www.${domain}/favicon.ico`,
    `https://${domain}/apple-touch-icon.png`,
    `https://www.${domain}/apple-touch-icon.png`,
  ];

  for (const faviconUrl of faviconUrls) {
    try {
      const response = await fetch(faviconUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      
      if (response.ok) return faviconUrl;
    } catch {
      continue;
    }
  }

  // Use Google Favicon service as fallback
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}
