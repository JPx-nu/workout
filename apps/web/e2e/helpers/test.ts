import { test as base } from "@playwright/test";

export const test = base.extend<{
	_diagnostics: undefined;
}>({
	_diagnostics: [
		async ({ page }, use, testInfo) => {
			const consoleMessages: string[] = [];
			const pageErrors: string[] = [];
			const failedRequests: string[] = [];
			const failedResponses: string[] = [];

			page.on("console", (message) => {
				if (message.type() === "error" || message.type() === "warning") {
					consoleMessages.push(`[${message.type()}] ${message.text()}`);
				}
			});

			page.on("pageerror", (error) => {
				pageErrors.push(error.stack ?? error.message);
			});

			page.on("requestfailed", (request) => {
				failedRequests.push(
					`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown error"}`,
				);
			});

			page.on("response", (response) => {
				if (response.status() >= 400) {
					failedResponses.push(
						`${response.status()} ${response.request().method()} ${response.url()}`,
					);
				}
			});

			await use(undefined);

			await testInfo.attach("final-url", {
				body: page.url(),
				contentType: "text/plain",
			});

			if (consoleMessages.length > 0) {
				await testInfo.attach("console-messages", {
					body: consoleMessages.join("\n"),
					contentType: "text/plain",
				});
			}

			if (pageErrors.length > 0) {
				await testInfo.attach("page-errors", {
					body: pageErrors.join("\n\n"),
					contentType: "text/plain",
				});
			}

			if (failedRequests.length > 0) {
				await testInfo.attach("failed-requests", {
					body: failedRequests.join("\n"),
					contentType: "text/plain",
				});
			}

			if (failedResponses.length > 0) {
				await testInfo.attach("failed-responses", {
					body: failedResponses.join("\n"),
					contentType: "text/plain",
				});
			}
		},
		{ auto: true },
	],
});

export { expect } from "@playwright/test";
