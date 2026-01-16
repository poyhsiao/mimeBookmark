-- Atomic function to update bookmark tags
-- This ensures that delete and insert operations happen as a single transaction
CREATE OR REPLACE FUNCTION update_bookmark_tags(
  p_bookmark_id UUID,
  p_tag_ids UUID[]
) RETURNS VOID AS $$
BEGIN
  -- Delete existing tag associations
  DELETE FROM bookmark_tags
  WHERE bookmark_id = p_bookmark_id;

  -- Insert new tag associations if provided
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    INSERT INTO bookmark_tags (bookmark_id, tag_id)
    SELECT p_bookmark_id, unnest(p_tag_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_bookmark_tags(UUID, UUID[]) TO authenticated;

-- Atomic function to update bookmark collections
CREATE OR REPLACE FUNCTION update_bookmark_collection(
  p_bookmark_id UUID,
  p_collection_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Delete existing collection association
  DELETE FROM collection_bookmarks
  WHERE bookmark_id = p_bookmark_id;

  -- Insert new collection association if provided
  IF p_collection_id IS NOT NULL THEN
    INSERT INTO collection_bookmarks (bookmark_id, collection_id)
    VALUES (p_bookmark_id, p_collection_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_bookmark_collection(UUID, UUID) TO authenticated;
