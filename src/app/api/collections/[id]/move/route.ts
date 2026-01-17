import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { id } = await params;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json(
      { error: "Collection ID is required" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    let { parent_id } = body;

    if (parent_id !== null && typeof parent_id !== "string") {
      return NextResponse.json(
        { error: "parent_id must be a string or null" },
        { status: 400 },
      );
    }

    if (typeof parent_id === "string") {
      parent_id = parent_id.trim();
      if (parent_id === "") {
        return NextResponse.json(
          { error: "parent_id must be a non-empty string or null" },
          { status: 400 },
        );
      }
    }

    if (parent_id === id) {
      return NextResponse.json(
        { error: "A collection cannot be a parent of itself" },
        { status: 400 },
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from("collections")
      .select("id, user_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 },
      );
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("collections")
        .select("id, user_id")
        .eq("id", parent_id)
        .is("deleted_at", null)
        .single();

      if (parentError || !parent || parent.user_id !== user.id) {
        return NextResponse.json(
          { error: "Parent collection not found" },
          { status: 404 },
        );
      }

      // Check for circular reference by walking ancestry
      const visited = new Set<string>();
      let currentParent: string | null = parent_id;

      while (currentParent) {
        if (currentParent === id) {
          return NextResponse.json(
            { error: "Cannot move to a descendant" },
            { status: 400 },
          );
        }

        if (visited.has(currentParent)) {
          // Cycle detected in existing data
          break;
        }
        visited.add(currentParent);

        const { data: ancestorData } = await supabase
          .from("collections")
          .select("parent_id")
          .eq("id", currentParent)
          .is("deleted_at", null)
          .single();

        currentParent = ancestorData?.parent_id || null;
      }
    }

    const { error } = await supabase
      .from("collections")
      .update({ parent_id: parent_id || null })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // Only treat JSON parsing errors as 400
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    // For other errors (database, network, etc.), return 500 or rethrow
    console.error("Move collection error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
