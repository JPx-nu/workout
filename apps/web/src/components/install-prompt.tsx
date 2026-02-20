"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const [isInstalled, setIsInstalled] = useState(false);

	useEffect(() => {
		// Check if already installed (standalone mode)
		if (window.matchMedia("(display-mode: standalone)").matches) {
			setIsInstalled(true);
			return;
		}

		// Check if previously dismissed
		const dismissedAt = localStorage.getItem("pwa-install-dismissed");
		if (dismissedAt) {
			const daysSince =
				(Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
			if (daysSince < 7) {
				setDismissed(true);
				return;
			}
		}

		const handler = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
		};

		window.addEventListener("beforeinstallprompt", handler);
		return () => window.removeEventListener("beforeinstallprompt", handler);
	}, []);

	const handleInstall = async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted") {
			setIsInstalled(true);
		}
		setDeferredPrompt(null);
	};

	const handleDismiss = () => {
		setDismissed(true);
		localStorage.setItem("pwa-install-dismissed", String(Date.now()));
	};

	if (isInstalled || dismissed || !deferredPrompt) return null;

	return (
		<div
			className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 glass-card p-4 flex items-center gap-3 animate-fade-in"
			style={{
				border: "1px solid var(--color-brand)",
				boxShadow: "0 8px 32px oklch(0 0 0 / 0.3)",
			}}
		>
			<div
				className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
				style={{
					background:
						"linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
				}}
			>
				<Download size={18} />
			</div>
			<div className="flex-1 min-w-0">
				<div className="text-sm font-semibold">Install Triathlon AI</div>
				<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
					Add to your home screen for the best experience
				</div>
			</div>
			<button
				onClick={handleInstall}
				className="btn-primary text-xs px-3 py-1.5 shrink-0"
			>
				Install
			</button>
			<button
				onClick={handleDismiss}
				className="shrink-0 p-1 rounded-lg hover-surface transition-colors"
				style={{ color: "var(--color-text-muted)" }}
				aria-label="Dismiss"
			>
				<X size={14} />
			</button>
		</div>
	);
}
