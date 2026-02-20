"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
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
				<button onClick={reset} className="btn-primary w-full text-sm">
					Try Again
				</button>
			</div>
		</div>
	);
}
