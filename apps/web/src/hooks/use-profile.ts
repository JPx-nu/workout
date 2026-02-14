// ============================================================
// Service hook: useProfile
// Fetches from Supabase profiles + clubs tables
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/supabase-provider';
import type { Profile } from '@/lib/mock/profile';

const defaultProfile: Profile = {
    id: '',
    displayName: '',
    role: 'athlete',
    clubId: '',
    clubName: '',
    avatarUrl: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    email: '',
};

export function useProfile(): { profile: Profile; isLoading: boolean; error: string | null; refetch: () => void } {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile>(defaultProfile);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        if (!user) {
            setProfile(defaultProfile);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const supabase = createClient();

        const { data, error: dbError } = await supabase
            .from('profiles')
            .select('*, clubs(name)')
            .eq('id', user.id)
            .single();

        if (dbError) {
            setError(dbError.message);
            // Provide fallback from auth user data
            setProfile({
                ...defaultProfile,
                id: user.id,
                email: user.email ?? '',
                displayName: user.email?.split('@')[0] ?? 'User',
            });
        } else if (data) {
            setProfile({
                id: data.id,
                displayName: data.display_name ?? user.email?.split('@')[0] ?? 'User',
                role: data.role ?? 'athlete',
                clubId: data.club_id ?? '',
                clubName: (data.clubs as { name: string } | null)?.name ?? '',
                avatarUrl: data.avatar_url ?? null,
                timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                email: user.email ?? '',
            });
        }

        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return { profile, isLoading, error, refetch: fetchProfile };
}
