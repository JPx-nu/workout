"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
	useEffect(() => {
		if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
			return;
		}

		let isMounted = true;
		const refreshRegistration = (registration: ServiceWorkerRegistration) => {
			void registration.update().catch(() => {
				// Best-effort update check; failures should not break the app.
			});
		};

		const handleVisibilityChange = () => {
			if (!isMounted || document.visibilityState !== "visible") {
				return;
			}

			void navigator.serviceWorker.getRegistration("/workout/").then((registration) => {
				if (registration) {
					refreshRegistration(registration);
				}
			});
		};

		void navigator.serviceWorker
			.register("/workout/sw.js", {
				scope: "/workout/",
				updateViaCache: "none",
			})
			.then((registration) => {
				if (isMounted) {
					refreshRegistration(registration);
				}
			})
			.catch(() => {
				// Service worker registration is best-effort
			});

		window.addEventListener("focus", handleVisibilityChange);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			isMounted = false;
			window.removeEventListener("focus", handleVisibilityChange);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	return null;
}
