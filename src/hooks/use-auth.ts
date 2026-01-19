'use client';

import { useUser } from './use-user';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const { user, loading } = useUser();

  return {
    user,
    isLoading: loading,
  };
}
