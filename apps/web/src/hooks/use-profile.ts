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
    defaultView: 'triathlon',
};

export function useProfile(): {
    profile: Profile;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
    updateDefaultView: (view: 'triathlon' | 'strength') => Promise<void>;
    updateProfile: (fields: { displayName?: string; timezone?: string }) => Promise<void>;
} {
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
                defaultView: (data.default_view as 'triathlon' | 'strength') ?? 'triathlon',
            });
        }

        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const updateDefaultView = async (view: 'triathlon' | 'strength') => {
        if (!user) return;

        // Optimistic update
        setProfile((prev) => ({ ...prev, defaultView: view }));

        const supabase = createClient();
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ default_view: view })
            .eq('id', user.id);

        if (updateError) {
            console.error('Failed to update default view:', updateError);
            // Revert on error
            fetchProfile();
            throw updateError;
        }
    };

    const updateProfile = async (fields: { displayName?: string; timezone?: string }) => {
        if (!user) return;

        const prev = profile;
        // Optimistic update
        setProfile((p) => ({
            ...p,
            ...(fields.displayName !== undefined ? { displayName: fields.displayName } : {}),
            ...(fields.timezone !== undefined ? { timezone: fields.timezone } : {}),
        }));

        const dbFields: Record<string, string> = {};
        if (fields.displayName !== undefined) dbFields.display_name = fields.displayName;
        if (fields.timezone !== undefined) dbFields.timezone = fields.timezone;

        const supabase = createClient();
        const { error: updateError } = await supabase
            .from('profiles')
            .update(dbFields)
            .eq('id', user.id);

        if (updateError) {
            console.error('Failed to update profile:', updateError);
            setProfile(prev); // revert
            throw updateError;
        }
    };

    return { profile, isLoading, error, refetch: fetchProfile, updateDefaultView, updateProfile };
}
