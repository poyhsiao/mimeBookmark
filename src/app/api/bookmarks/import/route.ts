import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/server';
import { JSDOM } from 'jsdom';

export async function POST(request: NextRequest) {
  const { user } = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const fileRaw = formData.get('file');
    const overwrite = formData.get('overwrite') === 'true';

    // Safely validate the uploaded field - check for File or Blob with text() method
    if (!fileRaw || typeof fileRaw === 'string' || typeof (fileRaw as any).text !== 'function') {
      return NextResponse.json({ error: 'No file provided or invalid file' }, { status: 400 });
    }

    const file = fileRaw as File;
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
      let data;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Invalid JSON file. Please check the file format and try again.' },
          { status: 400 }
        );
      }

      // Validate that bookmarks, collections, and tags are arrays
      const rawBookmarks = data.bookmarks;
      const rawCollections = data.collections;
      const rawTags = data.tags;

      if (rawBookmarks !== undefined && !Array.isArray(rawBookmarks)) {
        return NextResponse.json(
          { error: 'Invalid bookmarks format: must be an array' },
          { status: 400 }
        );
      }
      if (rawCollections !== undefined && !Array.isArray(rawCollections)) {
        return NextResponse.json(
          { error: 'Invalid collections format: must be an array' },
          { status: 400 }
        );
      }
      if (rawTags !== undefined && !Array.isArray(rawTags)) {
        return NextResponse.json(
          { error: 'Invalid tags format: must be an array' },
          { status: 400 }
        );
      }

      bookmarks = rawBookmarks || [];
      collections = rawCollections || [];
      tags = rawTags || [];
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

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
      tagsCreated: 0,
      collectionsCreated: 0,
    };

    // Track new inserts separately for quota enforcement
    let newInserts = 0;

    // Create tags first using batch operations to avoid N+1 queries
    const tagNameToId: Record<string, string> = {};

    // Normalize tag names and filter out empty ones - defensively validate string type
    const tagNames = tags
      .filter(t => typeof t.name === 'string' && t.name.trim().length > 0)
      .map(t => t.name.toLowerCase());

    if (tagNames.length > 0) {
      // Batch query: fetch all existing tags at once
      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', user.id)
        .in('name', tagNames)
        .is('deleted_at', null);

      // Populate map with existing tags
      if (existingTags) {
        for (const tag of existingTags) {
          tagNameToId[tag.name.toLowerCase()] = tag.id;
        }
      }

      // Deduplicate tags by lower-cased name before creating
      const uniqueTagsMap = new Map<string, { name: string; color?: string }>();

      for (const tag of tags) {
        if (typeof tag.name !== 'string' || !tag.name.trim()) continue;
        const lowerName = tag.name.toLowerCase();

        // Skip if already exists in database
        if (tagNameToId[lowerName]) continue;

        // Only keep first occurrence of each unique lower-cased name
        if (!uniqueTagsMap.has(lowerName)) {
          uniqueTagsMap.set(lowerName, {
            name: tag.name,
            color: tag.color || '#6B7280',
          });
        }
      }

      // Batch insert new tags (now deduplicated)
      const tagsToCreate = Array.from(uniqueTagsMap.values());

      if (tagsToCreate.length > 0) {
        const { data: insertedTags, error: insertError } = await supabase
          .from('tags')
          .insert(
            tagsToCreate.map(tag => ({
              user_id: user.id,
              name: tag.name,
              color: tag.color,
            }))
          )
          .select('id, name');

        if (insertError) {
          console.error(
            `Failed to create tags for user ${user.id}:`,
            insertError,
            'Tags:',
            tagsToCreate.map(t => t.name)
          );
          return NextResponse.json(
            { error: 'Failed to create tags' },
            { status: 500 }
          );
        }

        if (insertedTags) {
          for (const tag of insertedTags) {
            tagNameToId[tag.name.toLowerCase()] = tag.id;
          }
          results.tagsCreated += insertedTags.length;
        }
      }
    }

    // Import bookmarks
    // Validate URL protocols first to filter out unsafe schemes
    const safeBookmarks = bookmarks.filter((bookmark) => {
      if (!bookmark.url) return false;

      try {
        const url = new URL(bookmark.url);
        // Only allow http: and https: protocols
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        // Invalid URL format
        return false;
      }
    });

    // Batch query: collect all safe bookmark URLs and check for existing ones
    const bookmarkUrls = safeBookmarks.map(b => b.url).filter(Boolean);

    // Build a map of existing bookmark URLs to their IDs
    const existingUrlMap: Record<string, string> = {};
    if (bookmarkUrls.length > 0) {
      const { data: existingBookmarks } = await supabase
        .from('bookmarks')
        .select('id, url')
        .eq('user_id', user.id)
        .in('url', bookmarkUrls)
        .is('deleted_at', null);

      if (existingBookmarks) {
        for (const eb of existingBookmarks) {
          existingUrlMap[eb.url] = eb.id;
        }
      }
    }

    for (const bookmark of safeBookmarks) {
      if (!bookmark.url) continue;

      // Check for duplicates using the pre-built map
      const existingId = existingUrlMap[bookmark.url];
      if (existingId) {
        if (overwrite) {
          // Update existing bookmark
          const { error } = await supabase
            .from('bookmarks')
            .update({
              title: bookmark.title || null,
              description: bookmark.description || null,
              favicon_url: bookmark.favicon || null,
              og_image: bookmark.image || null,
              og_title: bookmark.ogTitle || bookmark.og_title || null,
              og_description: bookmark.ogDescription || bookmark.og_description || null,
              user_notes: bookmark.notes || null,
              user_rating: bookmark.rating || null,
              is_favorite: bookmark.isFavorite || false,
              is_archived: bookmark.isArchived || false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);

          if (error) {
            results.errors.push(`Failed to update ${bookmark.url}: ${error.message}`);
          } else {
            results.imported++;

            // Apply tag links for overwritten bookmarks
            // Check if tags array is explicitly provided (including empty array)
            if (Array.isArray(bookmark.tags)) {
              // First remove existing tag links for this bookmark
              const { error: deleteError } = await supabase
                .from('bookmark_tags')
                .delete()
                .eq('bookmark_id', existingId);

              if (deleteError) {
                results.errors.push(`Failed to delete tags for ${bookmark.url}: ${deleteError.message}`);
              } else {
                // Build new tag links from valid tags only
                const tagLinks: { bookmark_id: string; tag_id: string }[] = [];

                for (const tagName of bookmark.tags) {
                  if (typeof tagName !== 'string' || !tagName.trim()) continue;
                  const tagId = tagNameToId[tagName.toLowerCase()];
                  if (tagId) {
                    tagLinks.push({
                      bookmark_id: existingId,
                      tag_id: tagId,
                    });
                  }
                }

                // Insert new tag links only if there are valid tags
                if (tagLinks.length > 0) {
                  const { error: upsertError } = await supabase.from('bookmark_tags').upsert(tagLinks);

                  if (upsertError) {
                    results.errors.push(`Failed to update tags for ${bookmark.url}: ${upsertError.message}`);
                  }
                }
                // If tagLinks is empty, all tags were cleared (already deleted above)
              }
            }
          }
        } else {
          results.skipped++;
        }
        continue;
      }

      // Check limit for new inserts using separate counter
      if (profile.bookmarks_count + newInserts >= profile.bookmarks_limit) {
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
          og_title: bookmark.ogTitle || bookmark.og_title || null,
          og_description: bookmark.ogDescription || bookmark.og_description || null,
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
          if (typeof tagName !== 'string' || !tagName.trim()) continue;
          const tagId = tagNameToId[tagName.toLowerCase()];
          if (tagId) {
            tagLinks.push({
              bookmark_id: newBookmark.id,
              tag_id: tagId,
            });
          }
        }

        if (tagLinks.length > 0) {
          const { error: upsertError } = await supabase.from('bookmark_tags').upsert(tagLinks);

          if (upsertError) {
            results.errors.push(`Failed to link tags for ${bookmark.url}: ${upsertError.message}`);
          }
        }
      }

      newInserts++;
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
  const collections: any[] = [];
  const uniqueTagNames = new Set<string>(); // Use Set for deduplication

  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const links = doc.querySelectorAll('a');

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        return;
      }

      // Safe date parsing
      const addDate = link.getAttribute('add_date');
      let createdAt = new Date().toISOString();

      if (addDate && /^\d+$/.test(addDate)) {
        // Validate it's numeric and parse
        const timestamp = parseInt(addDate, 10);
        if (Number.isFinite(timestamp)) {
          // Explicitly validate the Date before calling toISOString
          const d = new Date(timestamp * 1000);
          if (!isNaN(d.getTime()) && d.toString() !== 'Invalid Date') {
            createdAt = d.toISOString();
          }
          // If invalid date, keep the default (now)
        }
      }

      const icon = link.getAttribute('icon');
      const title = link.textContent?.trim() || href;

      // Extract tags from folder structure
      // A -> DT -> DL -> prevSibling (DT with H3)
      // OR A -> DL -> prevSibling (DT with H3) (if DT is missing)
      const extractedTags: string[] = [];
      let current = link.parentElement;

      // Traverse up to find the containing folder
      // Netscape structure: <DT><H3>Folder</H3><DL>...items...</DL>
      // Browser exports might vary slightly, but generally link is inside a DL,
      // and that DL is preceded by a Header.

      while (current) {
        if (current.tagName === 'DL') {
          // Look at previous element for the header
          const prev = current.previousElementSibling;
          if (prev) {
             // It might be a DT containing H3, or just H3
             let header = prev.querySelector('h3');
             if (!header && prev.tagName === 'H3') {
               header = prev as unknown as HTMLHeadingElement;
             }

             if (header) {
               const folderName = header.textContent?.trim();
               if (folderName && folderName !== 'Bookmarks' && folderName !== 'MimeBookmark Export') {
                 extractedTags.push(folderName);
                 // Add to unique tags set
                 uniqueTagNames.add(folderName);
                 // We only take the immediate folder as a tag for now, matching original behavior
                 break;
               }
             }
          }
        }
        current = current.parentElement;
      }

      bookmarks.push({
        url: href,
        title: title,
        favicon: icon || null,
        createdAt: createdAt,
        tags: extractedTags,
      });
    });
  } catch (e) {
    console.error('Error parsing HTML:', e);
  }

  // Convert unique tag names to tags array
  const tags = Array.from(uniqueTagNames).map(name => ({ name }));

  return { bookmarks, collections, tags };
}

