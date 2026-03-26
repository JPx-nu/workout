/**
 * @param {import('puppeteer').Browser} browser
 * @param {{url: string, options: object}} _context
 */
module.exports = async (browser, _context) => {
	const page = await browser.newPage();
	const baseOrigin = process.env.LIGHTHOUSE_BASE_ORIGIN || "http://127.0.0.1:3100";
	const email = process.env.PLAYWRIGHT_TEST_EMAIL || "demo@jpx.nu";
	const password = process.env.PLAYWRIGHT_TEST_PASSWORD || "demo1234";

	await page.goto(`${baseOrigin}/workout/login`, {
		waitUntil: "networkidle2",
	});
	await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
	await page.type('[data-testid="login-email"]', email);
	await page.type('[data-testid="login-password"]', password);
	await page.click('[data-testid="login-submit"]');
	await page.waitForNavigation({
		waitUntil: "networkidle2",
		timeout: 60_000,
	});
	await page.waitForSelector('[data-testid="dashboard-page"]', { timeout: 60_000 });
	await page.close();
};
