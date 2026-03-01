// ============================================================
// Service hook: useProfile
// Fetches from Supabase profiles + clubs tables
// ============================================================

import type { AppProfile as Profile, ProfilePreferences } from "@triathlon/types";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { createClient } from "@/lib/supabase/client";

function toPreferences(value: unknown): ProfilePreferences {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as ProfilePreferences;
}

const defaultProfile: Profile = {
	id: "",
	displayName: "",
	role: "athlete",
	clubId: "",
	clubName: "",
	avatarUrl: null,
	timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	email: "",
	defaultView: "triathlon",
	preferences: {},
};

export function useProfile(): {
	profile: Profile;
	isLoading: boolean;
	isOnboarded: boolean;
	error: string | null;
	refetch: () => void;
	updateDefaultView: (view: "triathlon" | "strength") => Promise<void>;
	updateProfile: (fields: { displayName?: string; timezone?: string }) => Promise<void>;
	updatePreferences: (fields: Record<string, unknown>) => Promise<void>;
} {
	const { user } = useAuth();
	const [profile, setProfile] = useState<Profile>(defaultProfile);
	const [isLoading, setIsLoading] = useState(true);
	const [isOnboarded, setIsOnboarded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchProfile = useCallback(async () => {
		if (!user) {
			setProfile(defaultProfile);
			setIsOnboarded(false);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		const supabase = createClient();

		const { data, error: dbError } = await supabase
			.from("profiles")
			.select("*, clubs(name)")
			.eq("id", user.id)
			.single();

		if (dbError) {
			setError(dbError.message);
			// Provide fallback from auth user data
			setProfile({
				...defaultProfile,
				id: user.id,
				email: user.email ?? "",
				displayName: user.email?.split("@")[0] ?? "User",
				clubId: "",
				clubName: "",
				avatarUrl: null,
				preferences: {},
			});
			setIsOnboarded(false);
		} else if (data) {
			const preferences = toPreferences(data.preferences);
			setProfile({
				id: data.id,
				displayName: data.display_name ?? user.email?.split("@")[0] ?? "User",
				role: data.role ?? "athlete",
				clubId: data.club_id ?? "",
				clubName: (data.clubs as { name: string } | null)?.name ?? "",
				avatarUrl: data.avatar_url ?? null,
				timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
				email: user.email ?? "",
				defaultView: (data.default_view as "triathlon" | "strength") ?? "triathlon",
				preferences,
			});
			setIsOnboarded(preferences.onboarding_completed === true);
		}

		setIsLoading(false);
	}, [user]);

	useEffect(() => {
		fetchProfile();
	}, [fetchProfile]);

	const updateDefaultView = async (view: "triathlon" | "strength") => {
		if (!user) return;

		// Optimistic update
		setProfile((prev: Profile) => ({ ...prev, defaultView: view }));

		const supabase = createClient();
		const { error: updateError } = await supabase
			.from("profiles")
			.update({ default_view: view })
			.eq("id", user.id);

		if (updateError) {
			fetchProfile();
			throw updateError;
		}
	};

	const updateProfile = async (fields: { displayName?: string; timezone?: string }) => {
		if (!user) return;

		const prev: Profile = profile;
		// Optimistic update
		setProfile((p: Profile) => ({
			...p,
			...(fields.displayName !== undefined ? { displayName: fields.displayName } : {}),
			...(fields.timezone !== undefined ? { timezone: fields.timezone } : {}),
		}));

		const dbFields: Record<string, string> = {};
		if (fields.displayName !== undefined) dbFields.display_name = fields.displayName;
		if (fields.timezone !== undefined) dbFields.timezone = fields.timezone;

		const supabase = createClient();
		const { error: updateError } = await supabase
			.from("profiles")
			.update(dbFields)
			.eq("id", user.id);

		if (updateError) {
			setProfile(prev);
			throw updateError;
		}
	};

	const updatePreferences = async (fields: Record<string, unknown>) => {
		if (!user) return;

		const prev: Profile = profile;
		const mergedPreferences: ProfilePreferences = {
			...profile.preferences,
			...fields,
		};

		// Optimistic update
		setProfile((p: Profile) => ({
			...p,
			preferences: mergedPreferences,
		}));
		setIsOnboarded(mergedPreferences.onboarding_completed === true);

		const supabase = createClient();
		const { error: updateError } = await supabase
			.from("profiles")
			.update({ preferences: mergedPreferences })
			.eq("id", user.id);

		if (updateError) {
			setProfile(prev);
			setIsOnboarded(prev.preferences.onboarding_completed === true);
			throw updateError;
		}
	};

	return {
		profile,
		isLoading,
		isOnboarded,
		error,
		refetch: fetchProfile,
		updateDefaultView,
		updateProfile,
		updatePreferences,
	};
}
