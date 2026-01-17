import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: searchHistory, error } = await supabase
      .from("search_history")
      .select("id, query, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Search history error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const groupedHistory = groupSearchHistory(searchHistory || []);

    return NextResponse.json({ history: groupedHistory });
  } catch (error) {
    console.error("Search history error:", error);
    return NextResponse.json(
      { error: "Failed to get search history" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("search_history")
      .update({ deleted_at: new Date().toISOString() })
      .is("deleted_at", null)
      .eq("user_id", user.id);

    if (error) {
      console.error("Delete search history error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete search history error:", error);
    return NextResponse.json(
      { error: "Failed to delete search history" },
      { status: 500 },
    );
  }
}

function groupSearchHistory(
  history: Array<{ id: string; query: string; created_at: string }>,
) {
  const grouped: Record<
    string,
    { query: string; count: number; lastSearched: string }
  > = {};

  for (const item of history) {
    const query = item.query.toLowerCase().trim();
    if (!query) continue;

    if (grouped[query]) {
      grouped[query].count += 1;
    } else {
      grouped[query] = {
        query: item.query,
        count: 1,
        lastSearched: item.created_at,
      };
    }
  }

  return Object.values(grouped)
    .sort(
      (a, b) =>
        new Date(b.lastSearched).getTime() - new Date(a.lastSearched).getTime(),
    )
    .slice(0, 10);
}
