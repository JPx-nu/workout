// ============================================================
// Service hook: useProfile
// Fetches from Supabase profiles + clubs tables
// ============================================================

import type { AppProfile as Profile, ProfilePreferences } from "@triathlon/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboardAccess } from "@/components/dashboard-access-context";
import { useAuth } from "@/components/supabase-provider";
import { createClient } from "@/lib/supabase/client";

function toPreferences(value: unknown): ProfilePreferences {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as ProfilePreferences;
}

function getClubName(value: unknown): string {
	if (Array.isArray(value)) {
		const firstClub = value[0];
		if (firstClub && typeof firstClub === "object" && "name" in firstClub) {
			return typeof firstClub.name === "string" ? firstClub.name : "";
		}
		return "";
	}

	if (value && typeof value === "object" && "name" in value) {
		return typeof value.name === "string" ? value.name : "";
	}

	return "";
}

export const defaultProfile: Profile = {
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

function getFallbackProfile(user: { id: string; email?: string | null }): Profile {
	return {
		...defaultProfile,
		id: user.id,
		email: user.email ?? "",
		displayName: user.email?.split("@")[0] ?? "User",
	};
}

export function useProfile(initialProfile?: Profile): {
	profile: Profile;
	isHydrating: boolean;
	isRefreshing: boolean;
	isOnboarded: boolean;
	error: string | null;
	refetch: () => Promise<void>;
	updateDefaultView: (view: "triathlon" | "strength") => Promise<void>;
	updateProfile: (fields: { displayName?: string; timezone?: string }) => Promise<void>;
	updatePreferences: (fields: Record<string, unknown>) => Promise<void>;
} {
	const { user } = useAuth();
	const accessState = useDashboardAccess();
	const bootstrappedProfile = initialProfile ?? accessState?.profile ?? defaultProfile;
	const bootstrappedOnboarded = accessState?.isOnboarded ?? false;
	const [profile, setProfile] = useState<Profile>(bootstrappedProfile);
	const [isHydrating, setIsHydrating] = useState(bootstrappedProfile.id.length === 0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isOnboarded, setIsOnboarded] = useState(bootstrappedOnboarded);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (bootstrappedProfile.id.length === 0) {
			return;
		}

		setProfile(bootstrappedProfile);
		setIsOnboarded(bootstrappedOnboarded);
		setIsHydrating(false);
	}, [bootstrappedProfile, bootstrappedOnboarded]);

	const fetchProfile = useCallback(
		async (options?: { background?: boolean }) => {
			if (!user) {
				if (bootstrappedProfile.id.length === 0) {
					setProfile(defaultProfile);
					setIsOnboarded(false);
				}
				setIsHydrating(false);
				setIsRefreshing(false);
				return;
			}

			const background = options?.background ?? profile.id.length > 0;
			if (background) {
				setIsRefreshing(true);
			} else {
				setIsHydrating(true);
			}
			setError(null);

			const supabase = createClient();
			const { data, error: dbError } = await supabase
				.from("profiles")
				.select("*, clubs(name)")
				.eq("id", user.id)
				.single();

			if (dbError) {
				setError(dbError.message);
				setProfile(getFallbackProfile(user));
				setIsOnboarded(false);
			} else if (data) {
				const preferences = toPreferences(data.preferences);
				setProfile({
					id: data.id,
					displayName: data.display_name ?? user.email?.split("@")[0] ?? "User",
					role: data.role ?? "athlete",
					clubId: data.club_id ?? "",
					clubName: getClubName(data.clubs),
					avatarUrl: data.avatar_url ?? null,
					timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
					email: user.email ?? "",
					defaultView: (data.default_view as "triathlon" | "strength") ?? "triathlon",
					preferences,
				});
				setIsOnboarded(preferences.onboarding_completed === true);
			}

			if (background) {
				setIsRefreshing(false);
			} else {
				setIsHydrating(false);
			}
		},
		[bootstrappedProfile.id.length, profile.id.length, user],
	);

	useEffect(() => {
		if (!user) {
			if (bootstrappedProfile.id.length === 0) {
				setIsHydrating(false);
			}
			return;
		}

		void fetchProfile({
			background: bootstrappedProfile.id.length > 0,
		});
	}, [bootstrappedProfile.id.length, fetchProfile, user]);

	const updateDefaultView = useCallback(
		async (view: "triathlon" | "strength") => {
			if (!user) return;

			setProfile((prev: Profile) => ({ ...prev, defaultView: view }));

			const supabase = createClient();
			const { error: updateError } = await supabase
				.from("profiles")
				.update({ default_view: view })
				.eq("id", user.id);

			if (updateError) {
				await fetchProfile({ background: profile.id.length > 0 });
				throw updateError;
			}
		},
		[fetchProfile, profile.id.length, user],
	);

	const updateProfile = useCallback(
		async (fields: { displayName?: string; timezone?: string }) => {
			if (!user) return;

			const previousProfile: Profile = profile;
			setProfile((current: Profile) => ({
				...current,
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
				setProfile(previousProfile);
				throw updateError;
			}
		},
		[profile, user],
	);

	const updatePreferences = useCallback(
		async (fields: Record<string, unknown>) => {
			if (!user) return;

			const previousProfile: Profile = profile;
			const mergedPreferences: ProfilePreferences = {
				...profile.preferences,
				...fields,
			};

			setProfile((current: Profile) => ({
				...current,
				preferences: mergedPreferences,
			}));
			setIsOnboarded(mergedPreferences.onboarding_completed === true);

			const supabase = createClient();
			const { error: updateError } = await supabase
				.from("profiles")
				.update({ preferences: mergedPreferences })
				.eq("id", user.id);

			if (updateError) {
				setProfile(previousProfile);
				setIsOnboarded(previousProfile.preferences.onboarding_completed === true);
				throw updateError;
			}
		},
		[profile, user],
	);

	return useMemo(
		() => ({
			profile,
			isHydrating,
			isRefreshing,
			isOnboarded,
			error,
			refetch: () => fetchProfile({ background: profile.id.length > 0 }),
			updateDefaultView,
			updateProfile,
			updatePreferences,
		}),
		[
			error,
			fetchProfile,
			isHydrating,
			isOnboarded,
			isRefreshing,
			profile,
			updateDefaultView,
			updatePreferences,
			updateProfile,
		],
	);
}
