-- Update track_recommendation_event to be atomic (insert analytics + update user_recommendations)
-- Migration: Update recommendation event tracking to use atomic transactions
-- Created: 2026-01-22

-- Drop the old function first to allow return type change
DROP FUNCTION IF EXISTS track_recommendation_event(UUID, UUID, TEXT, INT, JSONB);

CREATE FUNCTION track_recommendation_event(
  p_rule_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_revenue_cents INT DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(analytics_id UUID) AS $$
DECLARE
  v_analytics_id UUID;
BEGIN
  -- Set safe search_path to prevent search-path injection
  SET LOCAL search_path = public, pg_catalog;

  -- Validate that the caller can only insert events for themselves
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot track events for other users';
  END IF;

  -- Insert analytics event and capture the ID
  INSERT INTO public.recommendation_analytics (rule_id, user_id, event_type, revenue_cents, metadata)
  VALUES (p_rule_id, p_user_id, p_event_type, p_revenue_cents, p_metadata)
  RETURNING id INTO v_analytics_id;

  -- Update user_recommendations based on event type
  IF p_event_type = 'dismiss' THEN
    UPDATE public.user_recommendations
    SET
      is_dismissed = TRUE,
      dismissed_at = NOW()
    WHERE
      rule_id = p_rule_id
      AND user_id = p_user_id
      AND clicked_at IS NULL;
  ELSIF p_event_type = 'click' THEN
    UPDATE public.user_recommendations
    SET
      clicked_at = NOW()
    WHERE
      rule_id = p_rule_id
      AND user_id = p_user_id
      AND clicked_at IS NULL;
  ELSIF p_event_type = 'impression' THEN
    UPDATE public.user_recommendations
    SET
      impression_count = COALESCE(impression_count, 0) + 1,
      last_shown_at = NOW()
    WHERE
      rule_id = p_rule_id
      AND user_id = p_user_id;
  ELSIF p_event_type = 'conversion' THEN
    UPDATE public.user_recommendations
    SET
      clicked_at = COALESCE(clicked_at, NOW())
    WHERE
      rule_id = p_rule_id
      AND user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Unknown event_type: %. Expected one of: dismiss, click, impression, conversion', p_event_type;
  END IF;

  -- Return the analytics ID
  RETURN QUERY SELECT v_analytics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION track_recommendation_event(UUID, UUID, TEXT, INT, JSONB) TO authenticated;
