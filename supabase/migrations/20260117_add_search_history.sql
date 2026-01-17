-- Search history table for storing user search queries
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Index for efficient user search history retrieval
CREATE INDEX IF NOT EXISTS idx_search_history_user_id
  ON search_history(user_id)
  WHERE deleted_at IS NULL;

-- Index for grouping and counting searches
CREATE INDEX IF NOT EXISTS idx_search_history_user_query
  ON search_history(user_id, left(query, 50))
  WHERE deleted_at IS NULL;

-- RLS for search_history
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search history" ON search_history
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own search history" ON search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete own search history" ON search_history
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Function to enforce that only deleted_at can be updated
CREATE OR REPLACE FUNCTION enforce_soft_delete_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow update only if deleted_at is the only changed column
  IF (OLD.query IS DISTINCT FROM NEW.query OR
      OLD.results_count IS DISTINCT FROM NEW.results_count OR
      OLD.created_at IS DISTINCT FROM NEW.created_at OR
      OLD.user_id IS DISTINCT FROM NEW.user_id OR
      OLD.id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'Only deleted_at column can be updated on search_history';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to enforce soft-delete-only updates
CREATE TRIGGER trg_enforce_soft_delete_only
  BEFORE UPDATE ON search_history
  FOR EACH ROW
  EXECUTE FUNCTION enforce_soft_delete_only();

-- Function to record search query
CREATE OR REPLACE FUNCTION record_search_query(
  p_query TEXT,
  p_results_count INTEGER DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_history_id UUID;
  v_user_id UUID;
BEGIN
  -- Check if user is authenticated
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to record search query';
  END IF;

  INSERT INTO public.search_history (user_id, query, results_count)
  VALUES (v_user_id, p_query, p_results_count)
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION record_search_query(TEXT, INTEGER) TO authenticated;
