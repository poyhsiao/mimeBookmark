-- Add unique constraint on session_devices to prevent duplicate device fingerprints
-- Migration: Add session_devices unique constraint
-- Created: 2026-01-25

-- Clean up any existing duplicates BEFORE creating the unique index
-- Keep the oldest entry (lowest created_at) for each duplicate group
WITH ranked_devices AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, device_name, platform, os
           ORDER BY created_at ASC
         ) AS rn
  FROM public.session_devices
  WHERE device_name IS NOT NULL AND platform IS NOT NULL AND os IS NOT NULL
)
DELETE FROM public.session_devices
WHERE id IN (
  SELECT id FROM ranked_devices WHERE rn > 1
);

-- Create unique index on (user_id, device_name, platform, os)
-- This prevents duplicate device entries for the same user with identical fingerprint data
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_devices_fingerprint
ON public.session_devices(user_id, device_name, platform, os)
WHERE device_name IS NOT NULL AND platform IS NOT NULL AND os IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_session_devices_fingerprint IS 'Prevents duplicate device fingerprint entries per user';
