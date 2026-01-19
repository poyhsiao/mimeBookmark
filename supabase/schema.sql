-- MimeBookmark Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PGroonga extension for full-text search
CREATE EXTENSION IF NOT EXISTS pgroonga;

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'team')),
  subscription_status TEXT DEFAULT 'active',
  subscription_id TEXT,
  stripe_customer_id TEXT,
  bookmarks_limit INTEGER DEFAULT 500,
  collections_limit INTEGER DEFAULT 10,
  tags_limit INTEGER DEFAULT 50,
  bookmarks_count INTEGER DEFAULT 0,
  storage_used_bytes BIGINT DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'folder',
  is_public BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  bookmarks_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  domain TEXT NOT NULL,
  favicon_url TEXT,
  og_image TEXT,
  og_title TEXT,
  og_description TEXT,
  metadata JSONB DEFAULT '{}',
  clicks INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_read_later BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'web' CHECK (source IN ('web', 'extension', 'import', 'api')),
  cached_content TEXT,
  cached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  user_notes TEXT,
  user_rating INTEGER CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
  -- Prevent duplicate active URLs per user (soft-deleted URLs can be re-added)
  CONSTRAINT bookmarks_user_url_unique UNIQUE (user_id, url)
);

-- Create partial unique index to enforce uniqueness only on non-deleted bookmarks
-- This allows soft-deleted bookmarks to be re-created with the same URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_url_unique
  ON bookmarks(user_id, url)
  WHERE deleted_at IS NULL;

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  -- Case-insensitive unique constraint on tag names per user
  CONSTRAINT tags_user_name_unique UNIQUE (user_id, LOWER(name))
);

-- Create index for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name_unique
  ON tags(user_id, LOWER(name));

-- Bookmark-Tags junction table
CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bookmark_id, tag_id)
);

-- Collection-Bookmarks junction table
CREATE TABLE IF NOT EXISTS collection_bookmarks (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, bookmark_id)
);

-- Annotations table
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'note' CHECK (content_type IN ('note', 'summary', 'highlights', 'custom')),
  highlight_start INTEGER,
  highlight_end INTEGER,
  highlight_text TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_domain ON bookmarks(domain);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_favorite ON bookmarks(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_active ON bookmarks(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_parent_id ON collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_id ON bookmark_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_collection_bookmarks_collection_id ON collection_bookmarks(collection_id);
CREATE INDEX IF NOT EXISTS idx_annotations_bookmark_id ON annotations(bookmark_id);

-- Full-text search index using pgroonga
CREATE INDEX IF NOT EXISTS idx_bookmarks_search ON bookmarks USING pgroonga
  (title, description, url, domain, user_notes);

-- Row Level Security Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmark_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Collections: Users can only access their own collections
CREATE POLICY "Users can view own collections" ON collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collections" ON collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections" ON collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections" ON collections
  FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks: Users can only access their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks" ON bookmarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Tags: Users can only access their own tags
CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Bookmark-Tags: Users can manage their own bookmark-tag relationships
-- Updated to verify both bookmark and tag ownership
CREATE POLICY "Users can manage bookmark_tags" ON bookmark_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM bookmarks WHERE id = bookmark_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM tags WHERE id = tag_id AND user_id = auth.uid())
  );

-- Collection-Bookmarks: Users can manage their own collection-bookmark relationships
-- Updated to verify both collection and bookmark ownership
CREATE POLICY "Users can manage collection_bookmarks" ON collection_bookmarks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM collections WHERE id = collection_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM bookmarks WHERE id = bookmark_id AND user_id = auth.uid())
  );

-- Annotations: Users can only access their own annotations
CREATE POLICY "Users can view own annotations" ON annotations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own annotations" ON annotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations" ON annotations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations" ON annotations
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookmarks_updated_at BEFORE UPDATE ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Robust function to extract domain from URL
CREATE OR REPLACE FUNCTION extract_domain(url TEXT)
RETURNS TEXT AS $$
DECLARE
  domain_result TEXT;
  parsed_url TEXT;
  hostname TEXT;
BEGIN
  -- Reject file:// protocol and completely malformed input
  IF url IS NULL OR url = '' OR url ~* '^file://' THEN
    RETURN 'unknown';
  END IF;

  -- Add https:// if no protocol is present
  IF url !~ '^[a-zA-Z][a-zA-Z0-9+.-]*://' THEN
    parsed_url := 'https://' || url;
  ELSE
    parsed_url := url;
  END IF;

  -- Extract hostname using regex
  -- Pattern matches protocol://[userinfo@]hostname[:port][/path]
  hostname := substring(parsed_url FROM '://(?:([^@/]+)@)?([^/:]+)');

  IF hostname IS NULL OR hostname = '' THEN
    -- Fallback: try to extract domain-like string
    hostname := substring(url FROM '(?:https?://)?(?:www\.)?([^/\s:]+)');
  END IF;

  -- Remove userinfo if present (everything before @)
  IF hostname ~ '@' THEN
    hostname := substring(hostname FROM '@(.+)$');
  END IF;

  -- Remove port number if present
  hostname := substring(hostname FROM '^([^:]+)');

  -- Handle IPv6 addresses (remove brackets)
  IF hostname ~ '^\[.*\]$' THEN
    hostname := substring(hostname FROM '^\[(.*)\]$');
  END IF;

  -- Validate result
  IF hostname IS NULL OR hostname = '' OR length(hostname) < 2 THEN
    RETURN 'unknown';
  END IF;

  RETURN lower(hostname);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to set domain on bookmark insert and update
CREATE OR REPLACE FUNCTION set_bookmark_domain()
RETURNS TRIGGER AS $$
BEGIN
  NEW.domain = extract_domain(NEW.url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_bookmark_domain_insert ON bookmarks;
CREATE TRIGGER set_bookmark_domain_insert
  BEFORE INSERT ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION set_bookmark_domain();

-- Trigger to update domain when URL is changed
DROP TRIGGER IF EXISTS set_bookmark_domain_update ON bookmarks;
CREATE TRIGGER set_bookmark_domain_update
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  WHEN (NEW.url IS DISTINCT FROM OLD.url)
  EXECUTE FUNCTION set_bookmark_domain();

-- RPC function to merge user preferences (used by settings API)
CREATE OR REPLACE FUNCTION merge_user_preferences(
  p_user_id UUID,
  p_preferences JSONB,
  p_display_name TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  timezone TEXT,
  preferences JSONB,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verify the caller is authorized to update this user's preferences
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only update your own preferences';
  END IF;

  -- First merge preferences into existing JSONB
  UPDATE profiles
  SET
    preferences = COALESCE(profiles.preferences, '{}'::jsonb) || COALESCE(p_preferences, '{}'::jsonb),
    display_name = COALESCE(p_display_name, profiles.display_name),
    timezone = COALESCE(p_timezone, profiles.timezone),
    updated_at = NOW()
  WHERE profiles.id = p_user_id;

  -- Return the updated profile with qualified column names
  RETURN QUERY
  SELECT
    profiles.id AS id,
    profiles.display_name AS display_name,
    profiles.timezone AS timezone,
    profiles.preferences AS preferences,
    profiles.updated_at AS updated_at
  FROM profiles
  WHERE profiles.id = p_user_id;
END;
$$;

-- Data retention cleanup function (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Clean up old audit logs (keep 90 days) - only if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  END IF;

  -- Clean up old search history (keep 90 days) - only if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'search_history') THEN
    DELETE FROM search_history WHERE created_at < NOW() - INTERVAL '90 days';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Schedule data cleanup (run daily at 3 AM)
-- Unschedule existing job if it exists to make this idempotent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-data') THEN
    PERFORM cron.unschedule('cleanup-old-data');
  END IF;
END;
$$;

SELECT cron.schedule(
  'cleanup-old-data',
  '0 3 * * *',
  'SELECT cleanup_old_data()'
);
