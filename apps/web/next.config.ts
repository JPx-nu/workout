import path from "node:path";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
	swSrc: "src/app/sw.ts",
	swDest: "public/sw.js",
	disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
	reactCompiler: true,
	output: "standalone",
	basePath: "/workout",
	outputFileTracingRoot: path.join(__dirname, "../../"),
	transpilePackages: ["@triathlon/core", "@triathlon/types", "@triathlon/api-client"],
	turbopack: {}, // Silence dev-mode warning about webpack config from withSerwist()

	webpack(config) {
		// Resolve .js imports → .ts source in workspace packages (NodeNext uses .js extensions)
		config.resolve.extensionAlias = {
			".js": [".ts", ".tsx", ".js"],
		};
		return config;
	},

	// ── Security Headers ─────────────────────────────────────────
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
					},
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{
						key: "Content-Security-Policy",
						value: [
							"default-src 'self' capacitor://localhost ionic://localhost",
							"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com", // unsafe-eval: Three.js WASM. TODO: replace with nonce before App Store submission
							"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
							"font-src 'self' https://fonts.gstatic.com",
							"img-src 'self' data: blob: https:",
							"connect-src 'self' http://localhost:* capacitor://localhost ionic://localhost https://*.supabase.co wss://*.supabase.co https://*.openai.azure.com https://accounts.google.com https://jpx-workout-api.azurewebsites.net",
							"frame-src 'self' https://accounts.google.com",
							"worker-src 'self' blob:",
							"frame-ancestors 'none'",
							"base-uri 'self'",
							"form-action 'self'",
						].join("; "),
					},
				],
			},
		];
	},
};

export default withSerwist(nextConfig);
