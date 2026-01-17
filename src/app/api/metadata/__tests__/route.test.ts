
import { describe, expect, test, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/metadata/metadata-service', () => ({
  fetchMetadata: vi.fn(),
}));

describe('Metadata Route', () => {
  function createRequest(urlParam: string) {
    return new NextRequest(`http://localhost/api/metadata?url=${encodeURIComponent(urlParam)}`);
  }

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
});
