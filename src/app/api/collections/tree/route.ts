import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface CollectionNode {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_public: boolean;
  is_favorite: boolean;
  sort_order: number;
  bookmarks_count: number;
  children: CollectionNode[];
}

function buildTree(collections: any[]): CollectionNode[] {
  const map = new Map<string, CollectionNode>();
  const roots: CollectionNode[] = [];

  // First pass: create all nodes
  collections.forEach((col) => {
    map.set(col.id, {
      id: col.id,
      name: col.name,
      description: col.description,
      color: col.color,
      icon: col.icon,
      is_public: col.is_public,
      is_favorite: col.is_favorite,
      sort_order: col.sort_order,
      bookmarks_count: col.bookmarks_count || 0,
      children: [],
    });
  });

  // Second pass: link children to parents
  collections.forEach((col) => {
    const node = map.get(col.id)!;
    if (col.parent_id && map.has(col.parent_id)) {
      const parent = map.get(col.parent_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort each level by sort_order
  const sortNodes = (nodes: CollectionNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const search = request.nextUrl.searchParams.get("search");

    let query = supabase
      .from("collections")
      .select(
        "id, name, description, color, icon, is_public, is_favorite, sort_order, parent_id, bookmarks_count",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: collections, error } = await query.order("sort_order", {
      ascending: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tree = buildTree(collections || []);

    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Get collection tree error:", error);
    return NextResponse.json(
      { error: "Failed to get collection tree" },
      { status: 500 },
    );
  }
}
