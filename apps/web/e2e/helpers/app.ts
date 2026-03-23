import { expect, type Page } from "@playwright/test";
import {
	getPlaywrightBaseUrl,
	getPlaywrightCredentials,
	getSupabasePublicConfig,
} from "./live-env";

const ROUTE_MARKERS: Record<string, string> = {
	dashboard: "dashboard-page",
	"dashboard/coach": "coach-page",
	"dashboard/training": "training-page",
	"dashboard/workouts": "workouts-page",
	"dashboard/workouts/new": "workout-center-page",
};

export function buildAppUrl(pathname: string): string {
	return new URL(pathname.replace(/^\/+/, ""), getPlaywrightBaseUrl()).toString();
}

function getRouteKey(pathname: string): string {
	return pathname.replace(/^\/+/, "").split("?")[0]?.replace(/\/+$/, "") ?? "";
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function expectAppRoute(page: Page, pathname: string): Promise<void> {
	const targetUrl = new URL(buildAppUrl(pathname));
	await expect(page).toHaveURL(new RegExp(`${escapeRegex(targetUrl.pathname)}(?:\\?.*)?$`), {
		timeout: 60_000,
	});

	const marker = ROUTE_MARKERS[getRouteKey(pathname)];
	if (marker) {
		await expect(page.getByTestId(marker)).toBeVisible({ timeout: 60_000 });
	}
}

export async function gotoAppPage(page: Page, pathname: string): Promise<void> {
	await page.goto(buildAppUrl(pathname));
	await expectAppRoute(page, pathname);
}

type LiveSession = {
	accessToken: string;
	userId: string;
};

function asObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	return value as Record<string, unknown>;
}

function decodeLiveSessionCookie(value: string): LiveSession | null {
	const encoded = value.startsWith("base64-") ? value.slice("base64-".length) : value;

	try {
		const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
			access_token?: unknown;
			user?: { id?: unknown } | null;
		};
		if (typeof parsed.access_token === "string" && typeof parsed.user?.id === "string") {
			return {
				accessToken: parsed.access_token,
				userId: parsed.user.id,
			};
		}
	} catch {
		// Ignore malformed cookie payloads while scanning for the Supabase session.
	}

	return null;
}

async function extractLiveSession(page: Page): Promise<LiveSession> {
	const cookies = await page.context().cookies();
	for (const cookie of cookies) {
		if (!cookie.name.includes("auth-token")) {
			continue;
		}

		const session = decodeLiveSessionCookie(cookie.value);
		if (session) {
			return session;
		}
	}

	throw new Error("Could not find the live Supabase session cookie after sign-in.");
}

async function markCurrentAthleteOnboarded(page: Page): Promise<void> {
	const { url, publishableKey } = getSupabasePublicConfig();
	const session = await extractLiveSession(page);
	const profileUrl = new URL("/rest/v1/profiles", url);
	profileUrl.searchParams.set("select", "display_name,default_view,preferences");
	profileUrl.searchParams.set("id", `eq.${session.userId}`);

	const profileResponse = await fetch(profileUrl, {
		headers: {
			Authorization: `Bearer ${session.accessToken}`,
			apikey: publishableKey,
		},
	});

	if (!profileResponse.ok) {
		throw new Error(
			`Failed to load the live profile for Playwright onboarding setup (${profileResponse.status}).`,
		);
	}

	const profileRows = (await profileResponse.json()) as Array<Record<string, unknown>>;
	const profileRow = profileRows[0] ?? {};
	const preferences = asObject(profileRow.preferences);

	const updateUrl = new URL("/rest/v1/profiles", url);
	updateUrl.searchParams.set("id", `eq.${session.userId}`);

	const updateResponse = await fetch(updateUrl, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${session.accessToken}`,
			apikey: publishableKey,
			"Content-Type": "application/json",
			Prefer: "return=representation",
		},
		body: JSON.stringify({
			display_name:
				typeof profileRow.display_name === "string" && profileRow.display_name.trim().length > 0
					? profileRow.display_name
					: "Playwright Athlete",
			default_view:
				profileRow.default_view === "strength" || profileRow.default_view === "triathlon"
					? profileRow.default_view
					: "triathlon",
			preferences: {
				...preferences,
				onboarding_completed: true,
			},
		}),
	});

	if (!updateResponse.ok) {
		throw new Error(
			`Failed to persist onboarding completion for the live athlete (${updateResponse.status}).`,
		);
	}
}

async function ensureAuthenticatedDashboard(page: Page): Promise<void> {
	await markCurrentAthleteOnboarded(page);
	await gotoAppPage(page, "dashboard");

	if (page.url().includes("/dashboard/onboarding")) {
		throw new Error("The live test athlete is still being redirected to onboarding after setup.");
	}

	// Reload once to ensure the persisted profile state survives a fresh route guard check.
	await page.reload();
	await expectAppRoute(page, "dashboard");
	if (page.url().includes("/dashboard/onboarding")) {
		throw new Error(
			"The live test athlete returned to onboarding after reload, so setup is not durable.",
		);
	}
}

export async function signInLiveAthlete(page: Page): Promise<void> {
	const credentials = getPlaywrightCredentials();

	await gotoAppPage(page, "login");
	await page.getByTestId("login-email").fill(credentials.email);
	await page.getByTestId("login-password").fill(credentials.password);
	await page.getByTestId("login-submit").click();
	await page.waitForURL(/\/workout\/dashboard(?:\/.*)?$/, { timeout: 60_000 });

	await ensureAuthenticatedDashboard(page);
}
