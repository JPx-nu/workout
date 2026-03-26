import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

type AccessibilityOptions = {
	exclude?: string[];
	rules?: Record<string, { enabled: boolean }>;
};

const DEFAULT_EXCLUDE_SELECTORS = ["button[aria-label='Open Next.js Dev Tools']", "nextjs-portal"];

export async function expectNoSeriousA11yViolations(
	page: Page,
	testInfo: TestInfo,
	options: AccessibilityOptions = {},
) {
	const builder = new AxeBuilder({ page })
		.include("body")
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

	for (const selector of [...DEFAULT_EXCLUDE_SELECTORS, ...(options.exclude ?? [])]) {
		builder.exclude(selector);
	}

	if (options.rules) {
		builder.options({
			rules: options.rules,
		});
	}

	const results = await builder.analyze();
	const seriousViolations = results.violations.filter(
		(violation) => violation.impact === "serious" || violation.impact === "critical",
	);

	if (seriousViolations.length > 0) {
		await testInfo.attach("axe-violations", {
			body: JSON.stringify(seriousViolations, null, 2),
			contentType: "application/json",
		});
	}

	if (seriousViolations.length > 0 && process.env.PLAYWRIGHT_STRICT_A11Y === "true") {
		const summary = seriousViolations
			.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
			.join("\n");
		throw new Error(`Serious accessibility violations found:\n${summary}`);
	}
}
