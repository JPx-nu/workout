/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, Serwist, StaleWhileRevalidate } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `self.__SW_MANIFEST`.
declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

const LEGACY_RUNTIME_CACHES = new Set([
	"apis",
	"cross-origin",
	"next-data",
	"others",
	"pages",
	"pages-rsc",
	"pages-rsc-prefetch",
	"static-data-assets",
]);

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: [
		{
			matcher({ request, url }) {
				return (
					url.origin === self.location.origin &&
					url.pathname.startsWith("/workout/_next/static/") &&
					(request.destination === "script" ||
						request.destination === "style" ||
						request.destination === "worker")
				);
			},
			handler: new CacheFirst({
				cacheName: "next-static-assets",
			}),
		},
		{
			matcher({ request }) {
				return request.destination === "font";
			},
			handler: new CacheFirst({
				cacheName: "font-assets",
			}),
		},
		{
			matcher({ request }) {
				return request.destination === "image";
			},
			handler: new StaleWhileRevalidate({
				cacheName: "image-assets",
			}),
		},
	],
});

serwist.addEventListeners();

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			await Promise.all(
				cacheNames
					.filter((cacheName) => LEGACY_RUNTIME_CACHES.has(cacheName))
					.map((cacheName) => caches.delete(cacheName)),
			);
		})(),
	);
});
