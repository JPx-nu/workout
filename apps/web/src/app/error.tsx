"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log to external error tracking service in production
		console.error("Unhandled error:", error);
	}, [error]);

	return (
		<div
			className="flex min-h-screen items-center justify-center p-4"
			style={{ background: "var(--color-bg-primary)" }}
		>
			<div className="glass-card p-8 max-w-sm w-full text-center space-y-4">
				<div
					className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mx-auto"
					style={{ background: "oklch(0.40 0.15 25 / 0.15)" }}
				>
					<AlertTriangle size={28} style={{ color: "oklch(0.70 0.15 25)" }} />
				</div>
				<h2 className="text-lg font-semibold">Something went wrong</h2>
				<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
					{error.message || "An unexpected error occurred. Please try again."}
				</p>
				{error.digest && (
					<p
						className="text-xs font-mono"
						style={{ color: "var(--color-text-muted)", opacity: 0.6 }}
					>
						Error ID: {error.digest}
					</p>
				)}
				<div className="flex gap-2">
					<button type="button" onClick={reset} className="btn-primary flex-1 text-sm">
						Try Again
					</button>
					<a
						href="/workout"
						className="btn-primary flex-1 text-sm inline-flex items-center justify-center"
						style={{
							background: "var(--color-bg-secondary)",
							color: "var(--color-text-primary)",
						}}
					>
						Go Home
					</a>
				</div>
			</div>
		</div>
	);
}
