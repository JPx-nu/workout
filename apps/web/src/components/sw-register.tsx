"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
	useEffect(() => {
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register("/workout/sw.js").catch(() => {
				// Service worker registration is best-effort
			});
		}
	}, []);

	return null;
}
