import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/server';

// Export bookmarks in JSON format
export async function GET(request: NextRequest) {
  const { user } = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get('format') || 'json';

  const supabase = await createClient();

  // Fetch all bookmarks with their tags
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select(`
      id, url, title, description, domain, favicon_url, og_image,
      og_title, og_description, is_favorite, is_archived,
      created_at, updated_at, user_notes, user_rating, collection_id,
      tags:bookmark_tags(tags(id, name, color))
    `)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }

  // Fetch collections
  const { data: collections, error: collectionsError } = await supabase
    .from('collections')
    .select('id, name, description, color, icon, parent_id, created_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('name');

  if (collectionsError) {
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }

  // Fetch tags
  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, color')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('name');

  if (format === 'html') {
    const html = generateNetscapeHtml(
      bookmarks || [],
      collections || [],
      tags || [],
      user.email || 'User'
    );

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="mimebookmark-export-${new Date().toISOString().split('T')[0]}.html"`,
      },
    });
  }

    // Default JSON format
    return NextResponse.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      userEmail: user.email,
      bookmarks: (bookmarks || []).map((b: any) => ({
        url: b.url,
        title: b.title,
        description: b.description,
        domain: b.domain,
        favicon: b.favicon_url,
        image: b.og_image,
        isFavorite: b.is_favorite,
        isArchived: b.is_archived,
        notes: b.user_notes,
        rating: b.user_rating,
        createdAt: b.created_at,
        tags: b.tags?.map((t: any) => t.tags.name).filter(Boolean) || [],
      })),
      collections: (collections || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
        color: c.color,
        icon: c.icon,
        parentId: c.parent_id,
      })),
      tags: (tags || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
  }, {
    headers: {
      'Content-Disposition': `attachment; filename="mimebookmark-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  });
}

// Generate Netscape bookmark HTML format
function generateNetscapeHtml(bookmarks: any[], collections: any[], tags: any[], userEmail: string): string {
  const now = new Date().toISOString();

  let bookmarkFolders = '';

  // Generate folder for each collection
  for (const collection of collections) {
    const collectionBookmarks = bookmarks.filter((b: any) => b.collection_id === collection.id);

    if (collectionBookmarks.length > 0) {
      bookmarkFolders += `
    <DT><H3 ADD_DATE="${Math.floor(new Date(collection.created_at).getTime() / 1000)}" >${escapeHtml(collection.name)}</H3>
    <DL><p>
${collectionBookmarks.map((b: any) => generateBookmarkEntry(b)).join('\n')}
    </DL><p>
`;
    }
  }

  // Generate folder for unorganized bookmarks
  const unorganizedBookmarks = bookmarks.filter((b: any) => !b.collection_id && !b.is_archived);

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${bookmarkFolders || ''}
${unorganizedBookmarks.length > 0 ? `
    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}">MimeBookmark Export</H3>
    <DL><p>
${unorganizedBookmarks.map((b: any) => generateBookmarkEntry(b)).join('\n')}
    </DL><p>
` : ''}
</DL><p>
`;
}

function generateBookmarkEntry(bookmark: any): string {
  const addDate = Math.floor(new Date(bookmark.created_at || Date.now()).getTime() / 1000);
  const title = escapeHtml(bookmark.title || bookmark.url);
  const url = escapeHtml(bookmark.url);
  const icon = bookmark.favicon_url ? `ICON="${escapeHtml(bookmark.favicon_url)}"` : '';

  return `    <DT><A HREF="${url}" ADD_DATE="${addDate}" ${icon}>${title}</A>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
