import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      // Check if the error is due to no rows found
      const errorMessage = error?.message || '';
      const errorDetails = error?.details || '';
      if (errorMessage.includes('0 rows') || errorDetails.includes('0 rows') || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({ error: errorMessage || 'Unknown error' }, { status: 500 });
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
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      display_name,
      timezone,
      theme,
      language,
      email_notifications,
    } = body;

    // Input validation
    if (display_name !== undefined) {
      if (typeof display_name !== 'string') {
        return NextResponse.json({ error: 'display_name must be a string' }, { status: 400 });
      }
      if (display_name.length > 255) {
        return NextResponse.json({ error: 'display_name cannot exceed 255 characters' }, { status: 400 });
      }
    }

    if (timezone !== undefined) {
      if (typeof timezone !== 'string') {
        return NextResponse.json({ error: 'timezone must be a string' }, { status: 400 });
      }
      // Validate against IANA timezone database
      try {
        const supported = Intl.supportedValuesOf('timeZone');
        if (!supported.includes(timezone)) {
          return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
        }
      } catch (error) {
        console.error('Timezone validation error:', error);
        return NextResponse.json({ error: 'Timezone validation failed' }, { status: 500 });
      }
    }

    if (theme !== undefined) {
      const validThemes = ['light', 'dark', 'system'];
      if (!validThemes.includes(theme)) {
        return NextResponse.json({ error: 'theme must be one of: light, dark, system' }, { status: 400 });
      }
    }

    if (language !== undefined) {
      const validLanguages = ['en', 'zh', 'ja', 'ko'];
      if (!validLanguages.includes(language)) {
        return NextResponse.json({ error: 'language must be one of: en, zh, ja, ko' }, { status: 400 });
      }
    }

    if (email_notifications !== undefined && typeof email_notifications !== 'boolean') {
      return NextResponse.json({ error: 'email_notifications must be a boolean' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};

    if (display_name !== undefined) {
      updateData.display_name = display_name;
    }

    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    // Build preferences update using jsonb merge
    if (theme !== undefined || language !== undefined || email_notifications !== undefined) {
      const prefsUpdate: Record<string, any> = {};
      if (theme !== undefined) prefsUpdate.theme = theme;
      if (language !== undefined) prefsUpdate.language = language;
      if (email_notifications !== undefined) prefsUpdate.email_notifications = email_notifications;

      // Use PostgreSQL jsonb concatenation operator for atomic merge
      const { data: profile, error } = await supabase.rpc('merge_user_preferences', {
        p_user_id: user.id,
        p_preferences: prefsUpdate,
        p_display_name: display_name,
        p_timezone: timezone,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!profile || profile.length === 0) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      const result = profile[0];

      return NextResponse.json({
        message: 'Settings updated successfully',
        settings: {
          displayName: result.display_name,
          timezone: result.timezone,
          preferences: result.preferences,
        },
      });
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No settings provided to update' }, { status: 400 });
    }

    // If only display_name or timezone, do simple update
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      // Check if the error is due to no rows found (PGRST116)
      const errorMessage = error?.message || '';
      const errorDetails = error?.details || '';
      const errorCode = (error as any)?.code || '';
      if (errorCode === 'PGRST116' || errorMessage.includes('0 rows') || errorDetails.includes('0 rows')) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: {
        displayName: profile.display_name,
        timezone: profile.timezone,
        preferences: profile.preferences,
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
