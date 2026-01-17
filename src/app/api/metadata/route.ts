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

  // If no recent requests, delete the entry to free memory
  if (recentRequests.length === 0) {
    requestLog.delete(ip);
  }

  if (recentRequests.length >= MAX_REQUESTS) {
    return false;
  }

  recentRequests.push(now);
  requestLog.set(ip, recentRequests);

  // Opportunistically clean up stale entries on each request
  // This avoids the need for a background timer in serverless environments
  cleanupStaleEntries();

  return true;
}

// Cleanup function to remove stale IP entries
// Called opportunistically from checkRateLimit to avoid background timers in serverless
const cleanupStaleEntries = () => {
  const now = Date.now();
  // Use a 10s buffer beyond the rate limit window for cleanup
  // This ensures entries are cleaned up shortly after they become irrelevant
  const staleThreshold = RATE_LIMIT_WINDOW + 10000;

  for (const [ip, timestamps] of requestLog.entries()) {
    // If the last timestamp is older than the threshold, delete the entry
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > staleThreshold) {
      requestLog.delete(ip);
    }
  }
};

// Note: No module-level setInterval in serverless environments
// Cleanup is called opportunistically from checkRateLimit instead

/**
 * Converts IPv4-mapped IPv6 hexadecimal format to dotted decimal format
 * e.g., "7f00:1" -> "127.0.0.1"
 */
function convertIPv4MappedHexToDecimal(hexPart: string): string | null {
  const hexMatch = hexPart.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hexMatch) {
    return null;
  }

  const high = parseInt(hexMatch[1], 16);
  const low = parseInt(hexMatch[2], 16);
  const byte1 = (high >> 8) & 0xff;
  const byte2 = high & 0xff;
  const byte3 = (low >> 8) & 0xff;
  const byte4 = low & 0xff;

  return `${byte1}.${byte2}.${byte3}.${byte4}`;
}

function isPrivateIP(ip: string): boolean {
  // Import net module for IP validation
  const net = require('net');

  // Validate if it's a valid IP
  if (!net.isIP(ip)) {
    return false; // Not an IP, will be handled by hostname checks
  }

  // Check IPv4 private ranges
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);

    // 0.0.0.0/8 - This network
    if (parts[0] === 0) return true;

    // 127.0.0.0/8 - Loopback
    if (parts[0] === 127) return true;

    // 10.0.0.0/8 - Private
    if (parts[0] === 10) return true;

    // 172.16.0.0/12 - Private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16 - Private
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 169.254.0.0/16 - Link-local (includes AWS metadata service)
    if (parts[0] === 169 && parts[1] === 254) return true;

    return false;
  }

  // Check IPv6 private ranges
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();

    // ::1 - Loopback
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

    // fe80::/10 - Link-local (fe80-febf)
    // The third nibble must be 8, 9, a, or b to match the /10 prefix
    if (lower.startsWith('fe')) {
      const thirdNibble = lower.charAt(2);
      if (thirdNibble === '8' || thirdNibble === '9' || thirdNibble === 'a' || thirdNibble === 'b') {
        return true;
      }
    }

    // fc00::/7 - Unique Local Address (ULA)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

    // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x or ::ffff:xxxx:xxxx)
    // Note: Node.js URL parser normalizes ::ffff:x.x.x.x to ::ffff:xxxx:xxxx format
    if (lower.includes('::ffff:')) {
      const parts = lower.split('::ffff:');
      if (parts.length === 2) {
        let ipv4Part = parts[1];

        // Handle ::ffff:0:x.x.x.x format
        if (ipv4Part.startsWith('0:')) {
          ipv4Part = ipv4Part.substring(2);
        }

        // Check if it's in dotted decimal format (x.x.x.x)
        if (net.isIPv4(ipv4Part)) {
          return isPrivateIP(ipv4Part);
        }

        // Handle hexadecimal format (xxxx:xxxx)
        const ipv4Decimal = convertIPv4MappedHexToDecimal(ipv4Part);
        if (ipv4Decimal) {
          return isPrivateIP(ipv4Decimal);
        }
      }
    }

    return false;
  }

  return false;
}

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const { hostname } = url;

    // Block localhost variations
    if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') {
      return false;
    }

    // Check if hostname is an IP address
    const net = require('net');

    // Remove brackets from IPv6 addresses
    const cleanHostname = hostname.replace(/^\[|\]$/g, '');

    if (net.isIP(cleanHostname)) {
      // Direct IP address - check if it's private
      if (isPrivateIP(cleanHostname)) {
        return false;
      }
    } else {
      // Hostname - additional DNS resolution would be needed for production
      // For now, we block known private hostname patterns
      // In production, you should resolve DNS and check all returned IPs

      // Block common internal hostnames
      const internalPatterns = [
        /^localhost$/i,
        /\.local$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
      ];

      for (const pattern of internalPatterns) {
        if (pattern.test(hostname)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const url = searchParams.get('url');

  // Extract client IP for rate limiting
  // Parse x-forwarded-for header to get the first (client) IP
  // Note: This requires a trusted reverse proxy to prevent header spoofing
  let ip = 'unknown';
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    // Take the first IP from the comma-separated list and trim whitespace
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) {
      ip = firstIp;
    }
  } else {
    // Fallback to request.ip if available (platform-specific)
    ip = (request as any).ip || 'unknown';
  }

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
