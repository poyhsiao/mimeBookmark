import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeSearchTerm } from "@/lib/utils/sanitize-search";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const pageRaw = searchParams.get("page") || "1";
  const limitRaw = searchParams.get("limit") || "20";

  // Parse and validate page
  const parsedPage = Number.parseInt(pageRaw, 10);
  const page = Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);

  // Parse and validate limit
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isNaN(parsedLimit)
    ? 20
    : Math.min(100, Math.max(1, parsedLimit));

  const collectionId = searchParams.get("collection_id");
  const tagId = searchParams.get("tag_id");
  const isFavorite = searchParams.get("is_favorite");
  const isArchived = searchParams.get("is_archived");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const domain = searchParams.get("domain");
  const sortBy = searchParams.get("sort") || "newest";

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let searchQuery = supabase
      .from("bookmarks")
      .select(
        `
        *,
        tags:bookmark_tags(tags!inner(
          id,
          name,
          color
        )),
        collections:collection_bookmarks(collections!inner(
          id,
          name,
          color
        )),
        collection_bookmarks(collection_id),
        bookmark_tags(tag_id)
      `,
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // Sanitize search term for PostgREST filter syntax
    const searchTerm = sanitizeSearchTerm(query);

    if (sortBy === "newest" || sortBy === "relevance") {
      searchQuery = searchQuery.order("created_at", { ascending: false });
    } else if (sortBy === "oldest") {
      searchQuery = searchQuery.order("created_at", { ascending: true });
    } else if (sortBy === "title") {
      searchQuery = searchQuery.order("title", {
        ascending: true,
        nullsFirst: false,
      });
    } else if (sortBy === "domain") {
      searchQuery = searchQuery.order("domain", { ascending: true });
    } else if (sortBy === "clicks") {
      searchQuery = searchQuery.order("clicks", { ascending: false });
    } else {
      // Default fallback
      searchQuery = searchQuery.order("created_at", { ascending: false });
    }

    searchQuery = searchQuery.or(
      `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%,user_notes.ilike.%${searchTerm}%`,
    );

    if (collectionId) {
      searchQuery = searchQuery.eq(
        "collection_bookmarks.collection_id",
        collectionId,
      );
    }

    if (tagId) {
      searchQuery = searchQuery.eq("bookmark_tags.tag_id", tagId);
    }

    if (isFavorite === "true") {
      searchQuery = searchQuery.eq("is_favorite", true);
    }

    if (isArchived === "true") {
      searchQuery = searchQuery.eq("is_archived", true);
    } else if (isArchived === "false") {
      searchQuery = searchQuery.eq("is_archived", false);
    }

    if (domain) {
      searchQuery = searchQuery.eq("domain", domain);
    }

    if (dateFrom) {
      searchQuery = searchQuery.gte("created_at", dateFrom);
    }

    if (dateTo) {
      searchQuery = searchQuery.lte("created_at", dateTo);
    }

    const { data: bookmarks, error, count } = await searchQuery.range(from, to);

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const highlightedBookmarks =
      bookmarks?.map((bookmark) => ({
        ...bookmark,
        titleHighlight: highlightSafe(bookmark.title || "", query),
        descriptionHighlight: highlightSafe(bookmark.description || "", query),
        urlHighlight: highlightSafe(bookmark.url || "", query),
      })) || [];

    return NextResponse.json({
      bookmarks: highlightedBookmarks,
      query,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

function highlightSafe(text: string, query: string): string {
  // Coerce text to string to handle null/undefined safely
  const safeText = text ? String(text) : "";

  if (!safeText || !query) return escapeHtml(safeText);

  const escapedText = escapeHtml(safeText);
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return escapedText.replace(regex, "<mark>$1</mark>");
}
