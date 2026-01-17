import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  const { user } = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const overwrite = formData.get('overwrite') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const content = await file.text();
    const contentType = file.type;
    const fileName = file.name.toLowerCase();

    // Determine format from content type or file extension
    let bookmarks: any[] = [];
    let collections: any[] = [];
    let tags: any[] = [];

    if (
      contentType === 'application/json' ||
      contentType === 'text/json' ||
      fileName.endsWith('.json')
    ) {
      const data = JSON.parse(content);
      bookmarks = data.bookmarks || [];
      collections = data.collections || [];
      tags = data.tags || [];
    } else if (
      contentType === 'text/html' ||
      contentType === 'application/xhtml+xml' ||
      fileName.endsWith('.html') ||
      fileName.endsWith('.htm')
    ) {
      const parsed = parseNetscapeHtml(content);
      bookmarks = parsed.bookmarks;
      collections = parsed.collections;
      tags = parsed.tags;
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload JSON or HTML file.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check current usage limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('bookmarks_count, bookmarks_limit, subscription_tier')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    const existingBookmarks = bookmarks.length;
    const availableSpace = profile.bookmarks_limit - profile.bookmarks_count;

    // Skip duplicates check if not overwriting
    if (!overwrite && existingBookmarks > availableSpace) {
      return NextResponse.json(
        { 
          error: 'Not enough storage space',
          details: {
            currentCount: profile.bookmarks_count,
            limit: profile.bookmarks_limit,
            available: availableSpace,
            importing: existingBookmarks,
          }
        },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      tagsCreated: 0,
      collectionsCreated: 0,
    };

    // Create tags first
    const tagNameToId: Record<string, string> = {};
    for (const tag of tags) {
      if (!tag.name) continue;
      
      const { data: existingTag } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', tag.name)
        .is('deleted_at', null)
        .single();

      if (existingTag) {
        tagNameToId[tag.name.toLowerCase()] = existingTag.id;
      } else {
        const { data: newTag, error } = await supabase
          .from('tags')
          .insert({
            user_id: user.id,
            name: tag.name,
            color: tag.color || '#6B7280',
          })
          .select('id')
          .single();

        if (!error && newTag) {
          tagNameToId[tag.name.toLowerCase()] = newTag.id;
          results.tagsCreated++;
        }
      }
    }

    // Import bookmarks
    for (const bookmark of bookmarks) {
      if (!bookmark.url) continue;

      // Check for duplicates
      const { data: existing } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id)
        .eq('url', bookmark.url)
        .is('deleted_at', null)
        .single();

      if (existing) {
        if (overwrite) {
          // Update existing bookmark
          const { error } = await supabase
            .from('bookmarks')
            .update({
              title: bookmark.title || null,
              description: bookmark.description || null,
              favicon_url: bookmark.favicon || null,
              og_image: bookmark.image || null,
              og_title: bookmark.og_title || null,
              og_description: bookmark.og_description || null,
              user_notes: bookmark.notes || null,
              user_rating: bookmark.rating || null,
              is_favorite: bookmark.isFavorite || false,
              is_archived: bookmark.isArchived || false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (!error) {
            results.imported++;
          }
        } else {
          results.skipped++;
        }
        continue;
      }

      // Check limit
      if (!overwrite && profile.bookmarks_count + results.imported >= profile.bookmarks_limit) {
        results.errors.push(`Skipped ${bookmark.url}: storage limit reached`);
        continue;
      }

      // Insert new bookmark
      const { data: newBookmark, error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          url: bookmark.url,
          title: bookmark.title || null,
          description: bookmark.description || null,
          favicon_url: bookmark.favicon || null,
          og_image: bookmark.image || null,
          user_notes: bookmark.notes || null,
          user_rating: bookmark.rating || null,
          is_favorite: bookmark.isFavorite || false,
          is_archived: bookmark.isArchived || false,
        })
        .select('id')
        .single();

      if (error) {
        results.errors.push(`Failed to import ${bookmark.url}: ${error.message}`);
        continue;
      }

      // Link tags
      if (bookmark.tags && bookmark.tags.length > 0 && newBookmark) {
        const tagLinks: { bookmark_id: string; tag_id: string }[] = [];
        
        for (const tagName of bookmark.tags) {
          const tagId = tagNameToId[tagName.toLowerCase()];
          if (tagId) {
            tagLinks.push({
              bookmark_id: newBookmark.id,
              tag_id: tagId,
            });
          }
        }

        if (tagLinks.length > 0) {
          await supabase.from('bookmark_tags').upsert(tagLinks);
        }
      }

      results.imported++;
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import bookmarks' },
      { status: 500 }
    );
  }
}

interface ParsedNetscapeResult {
  bookmarks: any[];
  collections: any[];
  tags: any[];
}

function parseNetscapeHtml(html: string): ParsedNetscapeResult {
  const bookmarks: any[] = [];
  const tags: any[] = [];
  const collections: any[] = [];

  // Extract all anchor tags with their attributes
  const linkRegex = /<A\s+HREF="([^"]*)"\s+ADD_DATE="([^"]*)"(?:\s+ICON="([^"]*)")?[^>]*>([^<]*)<\/A>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const [, url, addDate, icon, title] = match;
    
    if (url && !url.startsWith('javascript:') && !url.startsWith('mailto:')) {
      bookmarks.push({
        url: decodeHtmlEntities(url),
        title: decodeHtmlEntities(title || url),
        favicon: icon || null,
        createdAt: new Date(parseInt(addDate) * 1000).toISOString(),
        tags: extractTagsFromContext(html, match.index),
      });
    }
  }

  return { bookmarks, collections, tags };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractTagsFromContext(html: string, matchIndex: number): string[] {
  // Look for tags in surrounding context (between <H3> and the link)
  const contextStart = Math.max(0, matchIndex - 500);
  const context = html.substring(contextStart, matchIndex);
  
  // Extract tag names from folder names (simplified approach)
  const folderMatch = context.match(/<H3[^>]*>([^<]*)<\/H3>/i);
  if (folderMatch) {
    const folderName = folderMatch[1].trim();
    if (folderName && folderName !== 'Bookmarks' && folderName !== 'MimeBookmark Export') {
      return [folderName];
    }
  }

  return [];
}
