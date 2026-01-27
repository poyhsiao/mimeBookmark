import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimiters } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimitCheck = rateLimiters.search.check(user.id, 'extensions:search');
    if (!rateLimitCheck.allowed) {
      const retrySeconds = rateLimitCheck.retryAfter ?? 0;
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${retrySeconds} seconds`,
        },
        { status: 429 },
      );

      if (rateLimitCheck.retryAfter) {
        // retryAfter is already in seconds from rate limiter
        response.headers.set('Retry-After', retrySeconds.toString());
      }

      return response;
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limitParam = searchParams.get('limit') || '10';
    const limit = Math.max(1, Math.min(parseInt(limitParam, 10) || 10, 100));
    const type = searchParams.get('type') || 'all';

    if (!query || query.length < 2) {
      return NextResponse.json({
        query,
        results: [],
        suggestions: [],
        count: 0,
      });
    }

    const queryTrimmed = query.trim();

    // Escape SQL LIKE wildcards and special characters for ilike patterns
    // Returns an unquoted, escaped string for use with wildcards
    const escapeForPostgrest = (value: string): string => {
      // First escape backslashes, then percent, underscore, and asterisk for LIKE
      let escaped = value
        .replace(/\\/g, '\\\\')   // Escape backslashes first
        .replace(/%/g, '\\%')     // Escape percent wildcard
        .replace(/_/g, '\\_')     // Escape underscore wildcard
        .replace(/\*/g, '\\*');   // Escape asterisk wildcard

      // For PostgREST quoted values, escape double quotes as ""
      escaped = escaped.replace(/"/g, '""');

      return escaped;
    };

    const escapedQuery = escapeForPostgrest(queryTrimmed.toLowerCase());

    // Build search pattern with % wildcards (standard SQL LIKE wildcards)
    // The escaped string is used with % wildcards for partial matching
    const searchPattern = `%${escapedQuery}%`;

    // Build query with filters
    let dbQuery = supabase
      .from('bookmarks')
      .select('*, collections(id, name)', { count: 'exact' })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    // Apply type filter if specified
    if (type && type !== 'all') {
      if (type === 'uncategorized') {
        dbQuery = dbQuery.is('collection_id', null);
      } else {
        dbQuery = dbQuery.eq('collection_id', type);
      }
    }

    // Apply search query if provided
    // Use escaped pattern with proper quoting for PostgREST .or() filter
    // Values must be wrapped in double quotes for proper escaping
    if (escapedQuery) {
      // Build the filter string with properly quoted values
      // Each column.ilike comparison uses the same escaped pattern
      const searchFilter = `title.ilike."${searchPattern}",url.ilike."${searchPattern}",description.ilike."${searchPattern}"`;
      dbQuery = dbQuery.or(searchFilter);
    }
    
    // Apply limit
    dbQuery = dbQuery.limit(limit);

    const { data: bookmarks, error: searchError, count: totalCount } = await dbQuery;

    if (searchError) {
      console.error('Search error:', searchError);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      query,
      results: bookmarks || [],
      count: totalCount ?? 0,
      suggestions: [],
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}