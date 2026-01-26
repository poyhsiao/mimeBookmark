-- Add session management tables for extension
-- Migration: Add session management
-- Created: 2026-01-25

-- Create session_devices table FIRST (before sessions which references it)
CREATE TABLE IF NOT EXISTS public.session_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,
  platform TEXT,
  os TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sessions table to store user sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.session_devices(id) ON DELETE SET NULL,
  token_hash TEXT UNIQUE NOT NULL,
  display_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create session_activities table to track session activity
CREATE TABLE IF NOT EXISTS public.session_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON public.sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON public.sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON public.sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
-- Note: idx_sessions_token_hash is NOT needed here because token_hash is declared UNIQUE NOT NULL,
-- which automatically creates an implicit unique index in PostgreSQL.
CREATE INDEX IF NOT EXISTS idx_session_devices_user_id ON public.session_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_session_activities_session_id ON public.session_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activities_created_at ON public.session_activities(created_at DESC);

-- Create unique constraints on (user_id, device_id) for upsert operations
-- This ensures one session per user-device combination.
-- Since device_id can be NULL, we use two partial indexes to handle NULL values correctly:
-- 1. sessions_user_device_unique: enforces uniqueness when device_id IS NOT NULL
-- 2. sessions_user_null_device_unique: enforces at most one session per user when device_id IS NULL
-- PostgreSQL treats NULLs as distinct, so a single UNIQUE(user_id, device_id) would allow
-- multiple rows with the same user_id but different device_id NULL values.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_user_device_unique
  ON public.sessions(user_id, device_id)
  WHERE device_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_user_null_device_unique
  ON public.sessions(user_id)
  WHERE device_id IS NULL;

-- Add RLS policies for session_devices
ALTER TABLE public.session_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.session_devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON public.session_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON public.session_devices
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" ON public.session_devices
  FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for session_activities
ALTER TABLE public.session_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activities for their sessions" ON public.session_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE public.sessions.id = session_activities.session_id
      AND public.sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activities for their sessions" ON public.session_activities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE public.sessions.id = session_activities.session_id
      AND public.sessions.user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT ON public.session_activities TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create trigger function to auto-update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on sessions table
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
