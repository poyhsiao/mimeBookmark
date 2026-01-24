-- Recommendation System Tables
-- Migration: Add recommendation system tables
-- Created: 2026-01-21

-- Create recommendation_rules table
CREATE TABLE IF NOT EXISTS public.recommendation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  min_tier TEXT DEFAULT 'free' CHECK (min_tier IN ('free', 'pro', 'team')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_recommendations table
CREATE TABLE IF NOT EXISTS public.user_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.recommendation_rules(id) ON DELETE CASCADE,
  bookmark_url TEXT,
  title TEXT,
  description TEXT,
  cta_text TEXT,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  impression_count INT DEFAULT 0,
  last_shown_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create recommendation_analytics table for tracking
CREATE TABLE IF NOT EXISTS public.recommendation_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.recommendation_rules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'dismiss', 'conversion')),
  revenue_cents INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_rules_active ON public.recommendation_rules(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_rules_tier ON public.recommendation_rules(min_tier);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendation_rules_name ON public.recommendation_rules(name);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_user ON public.user_recommendations(user_id, is_dismissed, clicked_at);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_rule ON public.user_recommendations(rule_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_rule ON public.recommendation_analytics(rule_id, event_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_created ON public.recommendation_analytics(created_at);

-- Enable RLS for recommendation tables
ALTER TABLE public.recommendation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendation_rules
-- Allow authenticated users to read active rules
CREATE POLICY "Authenticated users can select active rules" ON public.recommendation_rules
  FOR SELECT TO authenticated USING (
    is_active = true
  );

-- Allow admins to manage all rules
CREATE POLICY "Admins can manage recommendation rules" ON public.recommendation_rules
  FOR ALL USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  ) WITH CHECK (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

-- RLS Policies for user_recommendations (user only sees their own)
CREATE POLICY "Users can view own recommendations" ON public.user_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations" ON public.user_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendations" ON public.user_recommendations
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations" ON public.user_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for recommendation_analytics (admin only for SELECT, restricted INSERT)
CREATE POLICY "Admins can view recommendation analytics" ON public.recommendation_analytics
  FOR SELECT USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin'
  );

CREATE POLICY "Users can insert own recommendation analytics" ON public.recommendation_analytics
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Insert default recommendation rules
INSERT INTO public.recommendation_rules (name, description, conditions, recommendations, priority, min_tier, is_active)
VALUES
  (
    'New User Welcome',
    'Welcome message for new users',
    '{"contexts": ["sidebar"], "minBookmarksCount": 0}',
    '[{"type": "promotion", "title": "Welcome to MimeBookmark!", "description": "Start organizing your bookmarks today. Import from Chrome, Firefox, or other browsers.", "ctaText": "Get Started", "impressionsPerUser": 1}]',
    100,
    'free',
    TRUE
  ),
  (
    'Power User Tips',
    'Tips for users with many bookmarks',
    '{"contexts": ["sidebar"], "minBookmarksCount": 100}',
    '[{"type": "promotion", "title": "Unlock Pro Features", "description": "You have over 100 bookmarks! Upgrade to Pro for unlimited storage and advanced search.", "ctaText": "Upgrade Now", "impressionsPerUser": 3}]',
    80,
    'free',
    TRUE
  ),
  (
    'Tag Suggestion',
    'Suggest tags based on bookmark content',
    '{"contexts": ["sidebar"], "requiredTags": []}',
    '[{"type": "external_link", "title": "Discover Related Content", "description": "Explore more resources on topics you bookmark frequently.", "ctaText": "Explore", "url": "/discover", "impressionsPerUser": 5}]',
    50,
    'free',
    TRUE
  )
ON CONFLICT (name) DO NOTHING;

-- Create function to track recommendation analytics
CREATE OR REPLACE FUNCTION track_recommendation_event(
  p_rule_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_revenue_cents INT DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  -- Set safe search_path to prevent search-path injection
  SET LOCAL search_path = public, pg_catalog;

  -- Validate that the caller can only insert events for themselves
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot track events for other users';
  END IF;

  INSERT INTO public.recommendation_analytics (rule_id, user_id, event_type, revenue_cents, metadata)
  VALUES (p_rule_id, p_user_id, p_event_type, p_revenue_cents, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at trigger for recommendation_rules
CREATE OR REPLACE FUNCTION update_recommendation_rules_updated_at()
RETURNS trigger AS $$
BEGIN
  SET LOCAL search_path = public, pg_catalog;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_recommendation_rules_updated_at
  BEFORE UPDATE ON public.recommendation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendation_rules_updated_at();

-- Update updated_at trigger for user_recommendations
CREATE OR REPLACE FUNCTION update_user_recommendations_updated_at()
RETURNS trigger AS $$
BEGIN
  SET LOCAL search_path = public, pg_catalog;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_user_recommendations_updated_at
  BEFORE UPDATE ON public.user_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_recommendations_updated_at();
