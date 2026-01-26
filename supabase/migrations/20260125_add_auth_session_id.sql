-- Add auth_session_id column to sessions table
-- Migration: Add auth_session_id for proper current session tracking
-- Created: 2026-01-25

-- Add auth_session_id column to store Supabase Auth session ID
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS auth_session_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_auth_session_id ON public.sessions(auth_session_id);

-- Add comment for documentation
COMMENT ON COLUMN public.sessions.auth_session_id IS 'Supabase Auth session ID for identifying the current session';
