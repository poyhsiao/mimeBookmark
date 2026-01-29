import { SUBSCRIPTION_PLANS } from './plans';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if a user can add more annotations based on their subscription tier
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @returns true if the user can add annotations, false if limit reached
 *
 * NOTE: This is an application-level check and has a race condition with
 * concurrent requests. For production use, implement a database-level
 * constraint (trigger or RPC) to enforce the limit atomically.
 */
export async function checkAnnotationLimit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // Check user's subscription tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  if (!profile) {
    return false;
  }

  const plan = SUBSCRIPTION_PLANS[(profile.subscription_tier as keyof typeof SUBSCRIPTION_PLANS) || 'free'];

  // Pro and Team plans have unlimited annotations
  if (plan.limits.bookmarks === -1) {
    return true;
  }

  // Free tier: check current annotation count
  // Free users get 10 annotations
  const { count, error: countError } = await supabase
    .from('annotations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (countError) {
    console.error('checkAnnotationLimit - count query failed:', countError);
    return false; // Fail closed: deny creation on error
  }

  const freeLimit = 10;
  return (count ?? 0) < freeLimit;
}
