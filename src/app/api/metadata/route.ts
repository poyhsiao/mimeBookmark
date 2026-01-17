import { NextRequest, NextResponse } from 'next/server';
import { fetchMetadata } from '@/lib/metadata/metadata-service';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Validate URL
    new URL(url);

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
