import { NextRequest, NextResponse } from 'next/server';
import { fetchMetadata } from '@/lib/metadata/metadata-service';
import { promises as dnsPromises } from 'dns';
import { isIP, isIPv4, isIPv6 } from 'net';
import { checkRateLimit } from './rate-limit';

// Trusted proxy IPs/CIDRs that can set forwarding headers
// Comma-separated list of IPs or CIDR ranges (e.g., "103.21.244.0/22,2400:cb00:1::/32")
// Set via environment variable TRUSTED_PROXY_PROXIES
const TRUSTED_PROXY_PROXIES = process.env.TRUSTED_PROXY_PROXIES ?
  process.env.TRUSTED_PROXY_PROXIES.split(',').map(s => s.trim()) : [];

// Feature flags for provider-specific headers
const CLOUDFLARE_ENABLED = process.env.CLOUDFLARE_ENABLED === 'true';
const IS_VERCEL = !!process.env.VERCEL;

// In test/development environments, we allow more lenient header handling for testing purposes
const IS_TEST_ENV = process.env.NODE_ENV === 'test';
const IS_DEV_ENV = process.env.NODE_ENV === 'development';
const IS_NON_PROD = IS_TEST_ENV || IS_DEV_ENV;

// Note: No module-level setInterval in serverless environments
// Cleanup is called opportunistically from checkRateLimit instead

/**
 * Checks if the given IP or CIDR matches any trusted proxy configuration.
 * Supports both exact IP matches and CIDR range matching for IPv4.
 * For IPv6 CIDR ranges, this is a simplified check (full CIDR parsing requires ipaddr.js).
 */
function isTrustedProxy(ip: string): boolean {
  for (const trusted of TRUSTED_PROXY_PROXIES) {
    // Exact match
    if (trusted === ip) {
      return true;
    }

    // CIDR range match (IPv4 only - simplified implementation)
    if (trusted.includes('/')) {
      const [network, prefixLength] = trusted.split('/');
      const prefix = parseInt(prefixLength, 10);

      if (isIP(network) === 4 && isIP(ip) === 4) {
        // Convert to integers for comparison
        const ipNum = ipToNumber(ip);
        const networkNum = ipToNumber(network);
        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;

        if ((ipNum & mask) === (networkNum & mask)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Converts an IPv4 address to a 32-bit integer for CIDR matching.
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Extracts the client IP address from the request using trusted proxy strategy.
 * Only trusts provider-specific headers when running on the corresponding platform.
 * Only trusts x-forwarded-for when the request source is a trusted proxy.
 *
 * Security considerations:
 * - CF-Connecting-IP: Only used when CLOUDFLARE_ENABLED === 'true'
 * - x-vercel-forwarded-for: Only used when running on Vercel (VERCEL env var set)
 * - x-forwarded-for: In production, only used when TRUSTED_PROXY_PROXIES is configured and source is trusted.
 *                   In test/dev, allowed for testing purposes.
 * - All IPs are validated with isIP() before being returned
 */
function extractClientIp(request: NextRequest): string {
  // Get the immediate connection source (if available)
  const connectionSourceIp = (request as any).ip;

  // Try Cloudflare header only when explicitly enabled
  if (CLOUDFLARE_ENABLED) {
    const cfConnectingIp = request.headers.get('CF-Connecting-IP');
    if (cfConnectingIp && isIP(cfConnectingIp) !== 0) {
      return cfConnectingIp;
    }
  }

  // Try Vercel header only when running on Vercel
  if (IS_VERCEL) {
    const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for');
    if (vercelForwardedFor && isIP(vercelForwardedFor) !== 0) {
      return vercelForwardedFor;
    }
  }

  // Generic x-forwarded-for header (only trust from known proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Extract the first IP from the comma-separated list
    const firstIp = forwardedFor.split(',')[0].trim();

    // Validate the IP format before processing
    if (firstIp && isIP(firstIp) !== 0) {
      // In test/development environments, allow x-forwarded-for for testing
      if (IS_NON_PROD) {
        return firstIp;
      }

      // In production, only use x-forwarded-for if:
      // 1. We have trusted proxy list configured, AND
      // 2. We can verify the request came from a trusted proxy
      if (TRUSTED_PROXY_PROXIES.length > 0 && connectionSourceIp && isTrustedProxy(connectionSourceIp)) {
        return firstIp;
      }
      // If we can't verify the source but have trusted proxies configured,
      // fall through to use connection source instead
    }
  }

  // Fallback to direct connection IP (platform-specific)
  // This is the safest option when we can't verify the proxy chain
  if (connectionSourceIp && isIP(connectionSourceIp) !== 0) {
    return connectionSourceIp;
  }

  return 'unknown';
}


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
  // Validate if it's a valid IP
  if (!isIP(ip)) {
    return false; // Not an IP, will be handled by hostname checks
  }

  // Check IPv4 private ranges
  if (isIPv4(ip)) {
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
  if (isIPv6(ip)) {
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
        if (isIPv4(ipv4Part)) {
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

async function isAllowedUrl(urlString: string): Promise<boolean> {
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

    // Remove brackets from IPv6 addresses
    const cleanHostname = hostname.replace(/^\[|\]$/g, '');

    if (isIP(cleanHostname)) {
      // Direct IP address - check if it's private
      if (isPrivateIP(cleanHostname)) {
        return false;
      }
      return true;
    }

    // Block common internal hostname patterns early (before DNS resolution).
    // This is an intentional, conservative optimization that may reject hostnames
    // which merely start with IP-like prefixes (e.g., "10.example.com").
    // Definitive verification happens later in the DNS resolution block below.
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

    // DNS resolution to verify the hostname doesn't resolve to private IPs
    try {
      const addresses = await dnsPromises.lookup(hostname, { all: true });

      // Check all resolved addresses
      for (const resolved of addresses) {
        if (isIP(resolved.address) && isPrivateIP(resolved.address)) {
          // Check if any resolved IP is private
          return false;
        }
      }
    } catch (dnsError) {
      // DNS resolution failed - this could mean the hostname doesn't exist
      // or there's a network issue. For security, we should block it.
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

  // Extract client IP for rate limiting using trusted proxy strategy
  const ip = extractClientIp(request);

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

  if (!(await isAllowedUrl(url))) {
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
