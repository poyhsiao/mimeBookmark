import { NextRequest, NextResponse } from 'next/server';
import { fetchMetadata } from '@/lib/metadata/metadata-service';

// Basic rate limiting implementation using in-memory usage tracking (not persistent across serverless restarts)
// For production, use Redis or database
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;
const requestLog = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = requestLog.get(ip) || [];

  // Filter out requests older than window
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= MAX_REQUESTS) {
    return false;
  }

  recentRequests.push(now);
  requestLog.set(ip, recentRequests);
  return true;
}

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const { hostname } = url;

    // Block localhost
    if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') {
      return false;
    }

    // Block private IP ranges (IPv4)
    if (
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      (hostname.startsWith('172.') &&
       parseInt(hostname.split('.')[1], 10) >= 16 &&
       parseInt(hostname.split('.')[1], 10) <= 31)
    ) {
      return false;
    }

    // AWS Instance Metadata Service (block exact match)
    if (hostname === '169.254.169.254') {
        return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const url = searchParams.get('url');

  // Basic IP extraction for rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  if (!checkRateLimit(ip)) {
     return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  if (!isAllowedUrl(url)) {
    return NextResponse.json(
      { error: 'Invalid URL: Private or restricted URLs are not allowed' },
      { status: 400 }
    );
  }

  try {
    const metadata = await fetchMetadata(url);

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Metadata fetch error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 400 }
    );
  }
}
