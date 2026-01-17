-- Create avatar storage bucket
-- Run this in Supabase Storage dashboard or via SQL

-- Create storage bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set bucket constraints
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Create policy for public read access to avatars
CREATE POLICY "Public avatars are viewable by everyone"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

-- Create policy for users to upload their own avatars
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create policy for users to update their own avatars
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create policy for users to delete their own avatars
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Grant authenticated users access
GRANT USAGE ON SCHEMA storage TO authenticated;

-- RLS policies are scoped to bucket_id = 'avatars' above.
-- We avoid broad GRANT/REVOKE on storage.objects and storage.buckets
-- to prevent affecting other buckets in the same project.
-- Authenticated users rely on the specific RLS policies defined above
-- (FOR SELECT, INSERT, UPDATE, DELETE) which are filtered by bucket_id.

-- Note: USAGE on schema storage is still required for RLS to function
GRANT USAGE ON SCHEMA storage TO authenticated;

