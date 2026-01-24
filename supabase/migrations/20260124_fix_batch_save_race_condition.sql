-- Fix batch-save race condition with atomic quota check
-- Migration: Add atomic quota check and bookmark insert
-- Created: 2026-01-24

-- Create stored procedure to handle batch bookmark save with atomic quota check
CREATE OR REPLACE FUNCTION insert_bookmarks_with_quota_check(
  p_user_id UUID,
  p_urls JSONB,
  p_collection_id UUID,
  p_tags JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_limit INT;
  v_count INT;
  v_remaining INT;
  v_existing_urls TEXT[] := ARRAY[]::TEXT[];
  v_skipped INT := 0;
  v_saved INT := 0;
  v_result JSONB;
BEGIN
  -- Set safe search_path to prevent search-path injection
  SET LOCAL search_path = public, pg_catalog;

  -- Read user's quota
  SELECT bookmarks_limit, bookmarks_count INTO v_limit, v_count
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;  -- Lock the row to prevent concurrent modifications

  -- Calculate remaining slots
  v_remaining := GREATEST(0, v_limit - v_count);

  -- Convert JSONB URLs to array for processing
  v_urls_array := ARRAY SELECT (url)::TEXT FROM jsonb_array_elements_text(p_urls);

  -- Get existing bookmarks for these URLs (to avoid duplicates)
  FOR i IN 1..array_length(v_urls_array, 1) LOOP
    v_url := v_urls_array[i];

    SELECT INTO v_count_new
      COUNT(*)
    FROM public.bookmarks
    WHERE user_id = p_user_id
    AND url = v_url
    AND deleted_at IS NULL;

    IF v_count_new = 0 THEN
      -- This URL doesn't exist, we'll insert it later
      CONTINUE;
    ELSE
      -- URL already exists, skip it
      v_skipped := v_skipped + 1;
      v_existing_urls := array_append(v_existing_urls, v_url);
    END IF;
  END LOOP;

  -- Remove URLs that already exist from the list to insert
  IF array_length(v_urls_array, 1) > 0 THEN
    v_urls_array := ARRAY(
      SELECT url
      FROM unnest(v_urls_array) url
      WHERE url <> ALL(v_existing_urls)
    );
  END IF;

  -- Check quota again (in case concurrent requests freed up space)
  -- Read fresh count for quota check
  SELECT COUNT(*) INTO v_count FROM public.bookmarks WHERE user_id = p_user_id AND deleted_at IS NULL;

  v_remaining := GREATEST(0, v_limit - v_count);

  -- If no new bookmarks to insert, return early
  IF array_length(v_urls_array, 1) = 0 OR v_remaining = 0 THEN
    v_result := jsonb_build_object(
      'success', true,
      'saved', 0,
      'skipped', v_skipped,
      'bookmarks', jsonb_build_array(),
      'warnings', jsonb_build_array(
        CASE WHEN v_remaining = 0 THEN 'Not enough storage space'
             WHEN array_length(v_urls_array, 1) = 0 THEN 'All bookmarks already exist'
        END
      )
    );
    RETURN v_result;
  END IF;

  -- Check if we have enough quota for all bookmarks
  IF v_remaining < array_length(v_urls_array, 1) THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', 'Not enough storage',
      'requested', array_length(v_urls_array, 1),
      'remaining', v_remaining
    );
    RETURN v_result;
  END IF;

  -- Insert new bookmarks
  INSERT INTO public.bookmarks (user_id, url, title, domain, source, created_at, updated_at)
  SELECT
    p_user_id,
    url,
    COALESCE(title, url) as title,
    CASE
      WHEN url ~ '^https?://' THEN regexp_replace(url, '^https?://([^/]+).*', '\1')
      ELSE 'unknown'
    END as domain,
    'extension' as source,
    NOW() as created_at,
    NOW() as updated_at
  FROM unnest(v_urls_array) WITH ORDINALITY AS t(url, idx)
  ORDER BY idx
  ON CONFLICT (user_id, url) DO NOTHING
  RETURNING id, url, title;

  -- Get inserted bookmarks
  GET DIAGNOSTICS v_saved = ROW_COUNT;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'saved', v_saved,
    'skipped', v_skipped,
    'bookmarks', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'url', url,
          'title', title
        )
      )
      FROM public.bookmarks
      WHERE id IN (
        SELECT id FROM public.bookmarks ORDER BY created_at DESC LIMIT v_saved
      )
    ),
    'warnings', jsonb_build_array()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_bookmarks_with_quota_check(UUID, JSONB, UUID, JSONB) TO authenticated;
