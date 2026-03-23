import { requireDashboardAccess } from "@/lib/dashboard/access";
import OnboardingPageClient from "./onboarding-page-client";

type OnboardingPageSearchParams = Promise<{
	redo?: string | string[];
}>;

function getSingleValue(value: string | string[] | undefined): string | null {
	if (typeof value === "string") {
		return value;
	}

	return value?.[0] ?? null;
}

export default async function OnboardingPage({
	searchParams,
}: {
	searchParams: OnboardingPageSearchParams;
}) {
	const params = await searchParams;
	await requireDashboardAccess({
		allowOnboarding: true,
		redo: getSingleValue(params.redo) === "1",
	});

	return <OnboardingPageClient />;
}
