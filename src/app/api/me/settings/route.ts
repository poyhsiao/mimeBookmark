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
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // If profile doesn't exist, create a default one
    if (error || !profile) {
      // Check if the error is due to no rows found
      const errorMessage = error?.message || "";
      const errorDetails = error?.details || "";
      if (
        errorMessage.includes("0 rows") ||
        errorDetails.includes("0 rows") ||
        !profile
      ) {
        // Use insert to create the profile without overwriting existing data
        // This prevents clobbering a user's customized display_name if profile exists
        const localName = (user.email?.split("@")[0] || "").trim();
        const { data: newProfile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email || "",
            display_name: localName || "User",
          })
          .select()
          .maybeSingle();

        const isDuplicate =
          profileError?.code === "23505" ||
          /duplicate/i.test(profileError?.message ?? "") ||
          /already exists/i.test(profileError?.details ?? "");
        if (!newProfile && (!profileError || isDuplicate)) {
          const { data: existingProfile, error: fallbackError }: { data: any, error: any } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (!fallbackError && existingProfile) {
            const settings = {
              displayName: existingProfile.display_name,
              avatarUrl: existingProfile.avatar_url,
              timezone: existingProfile.timezone,
              subscriptionTier: existingProfile.subscription_tier,
              subscriptionStatus: existingProfile.subscription_status,
              bookmarksLimit: existingProfile.bookmarks_limit,
              bookmarksCount: existingProfile.bookmarks_count,
              collectionsLimit: existingProfile.collections_limit,
              tagsLimit: existingProfile.tags_limit,
              preferences: existingProfile.preferences,
            };
            return NextResponse.json({ settings });
          }
        }

        if (profileError || !newProfile) {
          console.error("Failed to auto-create or get profile:", profileError);
          return NextResponse.json(
            { error: "Profile not found and could not be created" },
            { status: 500 },
          );
        }

        // Return the newly created profile
        const settings = {
          displayName: newProfile.display_name,
          avatarUrl: newProfile.avatar_url,
          timezone: newProfile.timezone,
          subscriptionTier: newProfile.subscription_tier,
          subscriptionStatus: newProfile.subscription_status,
          bookmarksLimit: newProfile.bookmarks_limit,
          bookmarksCount: newProfile.bookmarks_count,
          collectionsLimit: newProfile.collections_limit,
          tagsLimit: newProfile.tags_limit,
          preferences: newProfile.preferences,
        };
        return NextResponse.json({ settings });
      }
      return NextResponse.json(
        { error: errorMessage || "Unknown error" },
        { status: 500 },
      );
    }

    const settings = {
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      timezone: profile.timezone,
      subscriptionTier: profile.subscription_tier,
      subscriptionStatus: profile.subscription_status,
      bookmarksLimit: profile.bookmarks_limit,
      bookmarksCount: profile.bookmarks_count,
      collectionsLimit: profile.collections_limit,
      tagsLimit: profile.tags_limit,
      preferences: profile.preferences,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError || (error as any).name === "SyntaxError") {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 },
      );
    }
    throw error;
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { display_name, timezone, theme, language, email_notifications } = body;

  try {
    // Input validation
    if (display_name !== undefined) {
      if (typeof display_name !== "string") {
        return NextResponse.json(
          { error: "display_name must be a string" },
          { status: 400 },
        );
      }
      if (display_name.length > 255) {
        return NextResponse.json(
          { error: "display_name cannot exceed 255 characters" },
          { status: 400 },
        );
      }
    }

    if (timezone !== undefined) {
      if (typeof timezone !== "string") {
        return NextResponse.json(
          { error: "timezone must be a string" },
          { status: 400 },
        );
      }
      // Validate against IANA timezone database
      try {
        const supported = Intl.supportedValuesOf("timeZone");
        if (!supported.includes(timezone)) {
          return NextResponse.json(
            { error: "Invalid timezone" },
            { status: 400 },
          );
        }
      } catch (error) {
        console.error("Timezone validation error:", error);
        return NextResponse.json(
          { error: "Timezone validation failed" },
          { status: 500 },
        );
      }
    }

    if (theme !== undefined) {
      const validThemes = ["light", "dark", "system"];
      if (!validThemes.includes(theme)) {
        return NextResponse.json(
          { error: "theme must be one of: light, dark, system" },
          { status: 400 },
        );
      }
    }

    if (language !== undefined) {
      const validLanguages = ["en", "zh", "ja", "ko"];
      if (!validLanguages.includes(language)) {
        return NextResponse.json(
          { error: "language must be one of: en, zh, ja, ko" },
          { status: 400 },
        );
      }
    }

    if (
      email_notifications !== undefined &&
      typeof email_notifications !== "boolean"
    ) {
      return NextResponse.json(
        { error: "email_notifications must be a boolean" },
        { status: 400 },
      );
    }

    const updateData: Record<string, any> = {};

    if (display_name !== undefined) {
      updateData.display_name = display_name;
    }

    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    // Build preferences update using jsonb merge
    if (
      theme !== undefined ||
      language !== undefined ||
      email_notifications !== undefined
    ) {
      const prefsUpdate: Record<string, any> = {};
      if (theme !== undefined) prefsUpdate.theme = theme;
      if (language !== undefined) prefsUpdate.language = language;
      if (email_notifications !== undefined)
        prefsUpdate.email_notifications = email_notifications;

      // Use PostgreSQL jsonb concatenation operator for atomic merge
      const { data: profile, error } = await supabase.rpc(
        "merge_user_preferences",
        {
          p_user_id: user.id,
          p_preferences: prefsUpdate,
          p_display_name: display_name,
          p_timezone: timezone,
        },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!profile || profile.length === 0) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 },
        );
      }

      const result = profile[0];

      return NextResponse.json({
        message: "Settings updated successfully",
        settings: {
          displayName: result.display_name,
          timezone: result.timezone,
          preferences: result.preferences,
        },
      });
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No settings provided to update" },
        { status: 400 },
      );
    }

    // If only display_name or timezone, do simple update
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      // Check if the error is due to no rows found (PGRST116)
      const errorMessage = error?.message || "";
      const errorDetails = error?.details || "";
      const errorCode = (error as any)?.code || "";
      if (
        errorCode === "PGRST116" ||
        errorMessage.includes("0 rows") ||
        errorDetails.includes("0 rows")
      ) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Settings updated successfully",
      settings: {
        displayName: profile.display_name,
        timezone: profile.timezone,
        preferences: profile.preferences,
      },
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
