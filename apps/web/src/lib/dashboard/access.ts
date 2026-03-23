import "server-only";

import type { User } from "@supabase/supabase-js";
import type { AppProfile, ProfilePreferences } from "@triathlon/types";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { DashboardAccessState } from "./types";

type ProfileRow = {
	id: string;
	display_name: string | null;
	role: AppProfile["role"] | null;
	club_id: string | null;
	avatar_url: string | null;
	timezone: string | null;
	default_view: AppProfile["defaultView"] | null;
	preferences: Record<string, unknown> | null;
	clubs: Array<{ name: string | null }> | null;
};

function toPreferences(value: unknown): ProfilePreferences {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	return value as ProfilePreferences;
}

function buildFallbackProfile(user: User): AppProfile {
	return {
		id: user.id,
		displayName: user.email?.split("@")[0] ?? "Athlete",
		role: "athlete",
		clubId: "",
		clubName: "",
		avatarUrl: null,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		email: user.email ?? "",
		defaultView: "triathlon",
		preferences: {},
	};
}

const getAuthContext = cache(async () => {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	return { supabase, user };
});

export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
	const { user } = await getAuthContext();
	return user;
});

export const getDashboardProfile = cache(async (): Promise<AppProfile | null> => {
	const { supabase, user } = await getAuthContext();
	if (!user) {
		return null;
	}

	const { data, error } = await supabase
		.from("profiles")
		.select(
			"id, display_name, role, club_id, avatar_url, timezone, default_view, preferences, clubs(name)",
		)
		.eq("id", user.id)
		.maybeSingle();

	if (error || !data) {
		return buildFallbackProfile(user);
	}

	const row = data as ProfileRow;
	const preferences = toPreferences(row.preferences);

	return {
		id: row.id,
		displayName: row.display_name ?? user.email?.split("@")[0] ?? "Athlete",
		role: row.role ?? "athlete",
		clubId: row.club_id ?? "",
		clubName: row.clubs?.[0]?.name ?? "",
		avatarUrl: row.avatar_url ?? null,
		timezone: row.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
		email: user.email ?? "",
		defaultView: row.default_view ?? "triathlon",
		preferences,
	};
});

export const getDashboardAccessState = cache(async (): Promise<DashboardAccessState | null> => {
	const user = await getAuthenticatedUser();
	if (!user) {
		return null;
	}

	const profile = (await getDashboardProfile()) ?? buildFallbackProfile(user);

	return {
		userId: user.id,
		email: profile.email,
		displayName: profile.displayName,
		clubName: profile.clubName,
		defaultView: profile.defaultView,
		isOnboarded: profile.preferences.onboarding_completed === true,
		profile,
	};
});

export async function requireAuthenticatedDashboardAccess(): Promise<DashboardAccessState> {
	const accessState = await getDashboardAccessState();
	if (!accessState) {
		redirect("/login");
	}

	return accessState;
}

export async function requireDashboardAccess(options?: {
	allowOnboarding?: boolean;
	redo?: boolean;
}): Promise<DashboardAccessState> {
	const accessState = await requireAuthenticatedDashboardAccess();
	const allowOnboarding = options?.allowOnboarding === true;
	const redo = options?.redo === true;

	if (!allowOnboarding && !accessState.isOnboarded) {
		redirect("/dashboard/onboarding");
	}

	if (allowOnboarding && accessState.isOnboarded && !redo) {
		redirect("/dashboard");
	}

	return accessState;
}
