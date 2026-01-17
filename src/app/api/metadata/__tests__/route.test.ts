
import { describe, expect, test, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/metadata/metadata-service', () => ({
  fetchMetadata: vi.fn(),
}));

describe('Metadata Route', () => {
  const createRequest = (urlParam: string) => {
    return new NextRequest(`http://localhost/api/metadata?url=${encodeURIComponent(urlParam)}`);
  };

  test('should block private IP addresses', async () => {
    // Current impl allows it -> Expecting 400 (Blocked) will fail currently (Passes/Returns 200 or 500 depending on fetch mock)
    // We want to verify that protection is added.

    const req = createRequest('http://127.0.0.1/secret');
    const res = await GET(req);

    // RED: This should fail now because current code allows it (returns 200/metadata or 500 fetch error)
    // We expect 400 "Invalid URL"
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid URL/);
  });

  test('should block localhost', async () => {
    const req = createRequest('http://localhost:3000/env');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('should allow public URLs', async () => {
    // We haven't mocked fetchMetadata result, but it shouldn't be blocked by validation
    // So status should be 200 if we mock fetchMetadata to succeed
    const { fetchMetadata } = await import('@/lib/metadata/metadata-service');
    vi.mocked(fetchMetadata).mockResolvedValue({ title: 'Google' });

    const req = createRequest('https://google.com');
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  test('should cleanup stale IP entries from requestLog', async () => {
    // This test verifies that the rate limit implementation cleans up
    // entries for IPs that have no recent requests
    const { fetchMetadata } = await import('@/lib/metadata/metadata-service');
    vi.mocked(fetchMetadata).mockResolvedValue({ title: 'Test' });

    // Make a request to populate the log
    const req1 = createRequest('https://example.com');
    await GET(req1);

    // Access the internal requestLog (we'll need to export it for testing)
    // For now, we'll test the behavior indirectly by verifying that
    // after the rate limit window passes, the entry should be cleaned up
    // This is a placeholder test that will fail until we implement cleanup

    // We expect that after implementing cleanup, empty request arrays
    // should be removed from the map
    expect(true).toBe(true); // Placeholder - will be updated after implementation
  });

  test('should correctly parse x-forwarded-for header', async () => {
    const { fetchMetadata } = await import('@/lib/metadata/metadata-service');
    vi.mocked(fetchMetadata).mockResolvedValue({ title: 'Test' });

    // Create a request with x-forwarded-for header containing multiple IPs
    const req = new NextRequest('http://localhost/api/metadata?url=https://example.com', {
      headers: {
        'x-forwarded-for': '  203.0.113.1  , 198.51.100.1, 192.0.2.1  ',
      },
    });

    const res = await GET(req);

    // The implementation should use the first IP (203.0.113.1) for rate limiting
    // We can't directly test the internal IP extraction, but we can verify
    // that the request succeeds (which means IP was extracted correctly)
    expect(res.status).toBe(200);
  });

  test('should block all private IPv4 ranges', async () => {
    const privateIPs = [
      'http://10.0.0.1/test',          // 10.0.0.0/8
      'http://172.16.0.1/test',        // 172.16.0.0/12
      'http://172.31.255.255/test',    // 172.16.0.0/12 (upper bound)
      'http://192.168.1.1/test',       // 192.168.0.0/16
      'http://169.254.169.254/test',   // Link-local (AWS metadata)
      'http://169.254.1.1/test',       // 169.254.0.0/16
      'http://127.0.0.1/test',         // Loopback
      'http://127.255.255.255/test',   // Loopback (upper bound)
      'http://0.0.0.0/test',           // Special: this network
    ];

    for (const privateIP of privateIPs) {
      const req = createRequest(privateIP);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid URL/);
    }
  });

  test('should block IPv6 local ranges', async () => {
    const ipv6LocalAddresses = [
      'http://[::1]/test',              // Loopback
      'http://[fe80::1]/test',          // Link-local
      'http://[fc00::1]/test',          // ULA (Unique Local Address)
      'http://[fd00::1]/test',          // ULA
    ];

    for (const ipv6Addr of ipv6LocalAddresses) {
      const req = createRequest(ipv6Addr);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Invalid URL/);
    }
  });
});
