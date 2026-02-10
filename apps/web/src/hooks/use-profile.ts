// ============================================================
// @mock — Service hook: useProfile
// STATUS: Using mock data
// SWAP TO: Supabase auth.getUser() + profiles table join
// ============================================================

import { mockProfile, type Profile } from '@/lib/mock';

/**
 * Returns the current user's profile.
 *
 * @mock Currently returns hardcoded mock data.
 * @real Will use:
 *   const { data: { user } } = await supabase.auth.getUser()
 *   const { data: profile } = await supabase
 *     .from('profiles')
 *     .select('*, clubs(name)')
 *     .eq('id', user.id)
 *     .single()
 */
export function useProfile(): { profile: Profile; isLoading: boolean } {
    // @mock — swap this block
    return {
        profile: mockProfile,
        isLoading: false,
    };
}
