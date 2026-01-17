-- Function to atomically merge user preferences to prevent race conditions
-- This function uses JSONB concatenation operator (||) for atomic merge

CREATE OR REPLACE FUNCTION merge_user_preferences(
  p_user_id UUID,
  p_preferences JSONB,
  p_display_name TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL
) RETURNS TABLE (
  display_name TEXT,
  timezone TEXT,
  preferences JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_update_data JSONB := '{}'::jsonb;
  v_caller_id UUID;
BEGIN
  -- Verify caller authorization
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot update another user''s preferences';
  END IF;

  -- Build update data
  IF p_display_name IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('display_name', p_display_name);
  END IF;

  IF p_timezone IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('timezone', p_timezone);
  END IF;

  -- Update profile with atomic JSONB merge for preferences
  UPDATE profiles
  SET
    display_name = COALESCE((v_update_data->>'display_name')::text, profiles.display_name),
    timezone = COALESCE((v_update_data->>'timezone')::text, profiles.timezone),
    preferences = COALESCE(profiles.preferences, '{}'::jsonb) || COALESCE(p_preferences, '{}'::jsonb)
  WHERE id = p_user_id
  RETURNING
    profiles.display_name,
    profiles.timezone,
    profiles.preferences
  INTO display_name, timezone, preferences;

  -- Check if the update affected any rows
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user_id: %', p_user_id;
  END IF;

  RETURN NEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION merge_user_preferences(UUID, JSONB, TEXT, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION merge_user_preferences IS
  'Atomically merges user preferences using JSONB concatenation to prevent race conditions during concurrent updates';
