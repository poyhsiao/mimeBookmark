import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST /api/tags/bookmarks - 为书签添加标签
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookmark_id, tag_ids } = body;

    if (
      !bookmark_id ||
      !tag_ids ||
      !Array.isArray(tag_ids) ||
      tag_ids.length === 0
    ) {
      return NextResponse.json(
        { error: "bookmark_id and tag_ids array are required" },
        { status: 400 },
      );
    }

    // 验证书签存在且属于用户
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("id", bookmark_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (bookmarkError || !bookmark) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 },
      );
    }

    // 验证所有标签存在且属于用户
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("id")
      .in("id", tag_ids)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (tagsError) {
      return NextResponse.json({ error: tagsError.message }, { status: 500 });
    }

    const validTagIds = tags?.map((t) => t.id) || [];
    const invalidTagIds = tag_ids.filter(
      (id: string) => !validTagIds.includes(id),
    );

    if (validTagIds.length === 0) {
      return NextResponse.json(
        { error: "No valid tags found" },
        { status: 400 },
      );
    }

    // 创建关联记录 - 先查询已存在的关联，然后只对不存在的记录进行 upsert
    const { data: existingLinks, error: existingLinksError } = await supabase
      .from("bookmark_tags")
      .select("tag_id")
      .eq("bookmark_id", bookmark_id)
      .in("tag_id", validTagIds);

    if (existingLinksError) {
      return NextResponse.json(
        { error: existingLinksError.message },
        { status: 500 },
      );
    }

    const existingTagIds = new Set(existingLinks?.map((l) => l.tag_id) || []);
    const newTagIds = validTagIds.filter((id) => !existingTagIds.has(id));

    if (newTagIds.length > 0) {
      const records = newTagIds.map((tag_id) => ({
        bookmark_id,
        tag_id,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("bookmark_tags")
        .upsert(records, { onConflict: "bookmark_id, tag_id" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 只有新插入的标签才更新使用计数
      const { error: rpcError } = await supabase.rpc(
        "increment_tag_usage_count",
        {
          tag_ids: newTagIds,
        },
      );

      if (rpcError) {
        console.error("Failed to update tag usage count:", rpcError);
      }
    }

    return NextResponse.json({
      success: true,
      added_tags: newTagIds,
      invalid_tags: invalidTagIds,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

// DELETE /api/tags/bookmarks - 从书签移除标签
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookmark_id = searchParams.get("bookmark_id");
    const tag_ids = searchParams
      .getAll("tag_ids")
      .flatMap((id) => id.split(","))
      .map((id) => id.trim())
      .filter(Boolean);

    if (!bookmark_id || tag_ids.length === 0) {
      return NextResponse.json(
        { error: "bookmark_id and tag_ids are required" },
        { status: 400 },
      );
    }

    // 验证书签存在且属于用户
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("id", bookmark_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (bookmarkError || !bookmark) {
      return NextResponse.json(
        { error: "Bookmark not found" },
        { status: 404 },
      );
    }

    // 验证标签存在且属于用户
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("id")
      .in("id", tag_ids)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (tagsError) {
      return NextResponse.json({ error: tagsError.message }, { status: 500 });
    }

    const validTagIds = tags?.map((t) => t.id) || [];

    if (validTagIds.length === 0) {
      return NextResponse.json(
        { error: "No valid tags found" },
        { status: 400 },
      );
    }

    // 删除关联记录
    const { data: deletedRecords, error } = await supabase
      .from("bookmark_tags")
      .delete()
      .eq("bookmark_id", bookmark_id)
      .in("tag_id", validTagIds)
      .select("tag_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 从返回的记录中提取实际删除的 tag_ids
    const deletedTagIds = deletedRecords?.map((r) => r.tag_id) || [];

    // 只有实际删除的标签才更新使用计数
    if (deletedTagIds.length > 0) {
      const { error: rpcError } = await supabase.rpc(
        "decrement_tag_usage_count",
        {
          tag_ids: deletedTagIds,
        },
      );

      if (rpcError) {
        console.error("Failed to update tag usage count:", rpcError);
      }
    }

    // 更新标签的使用计数
    const { error: rpcError } = await supabase.rpc(
      "decrement_tag_usage_count",
      {
        tag_ids: validTagIds,
      },
    );

    if (rpcError) {
      console.error("Failed to update tag usage count:", rpcError);
    }

    return NextResponse.json({ success: true, removed_tags: validTagIds });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
