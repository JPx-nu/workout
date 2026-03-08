"use client";

import { AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { defaultFatigueData } from "@/lib/types";

const Body3DViewer = dynamic(() => import("@/components/body-map-3d/Body3DViewer"), {
	ssr: false,
	loading: () => (
		<div className="flex items-center justify-center" style={{ height: "65vh" }}>
			<div className="text-center">
				<div
					className="w-10 h-10 mx-auto mb-3 rounded-full"
					style={{
						border: "3px solid rgba(255,255,255,0.1)",
						borderTopColor: "var(--color-brand)",
						animation: "spin 0.8s linear infinite",
					}}
				/>
				<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
					Loading 3D preview…
				</p>
			</div>
		</div>
	),
});

export default function BodyMap3DPage() {
	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
						Body Map - 3D Preview
					</h1>
					<p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
						Experimental anatomy preview using sample mapping data.
					</p>
				</div>
				<Link
					href="/dashboard/body-map"
					className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
					style={{
						background: "var(--color-glass-bg)",
						border: "1px solid var(--color-glass-border)",
						color: "var(--color-text-primary)",
					}}
				>
					Back to 2D
				</Link>
			</div>

			<div
				className="glass-card p-4 text-sm flex items-start gap-3"
				style={{
					border: "1px solid var(--color-glass-border)",
					color: "var(--color-text-secondary)",
				}}
			>
				<AlertTriangle
					size={16}
					className="shrink-0 mt-0.5"
					style={{ color: "var(--color-warning)" }}
				/>
				<p>
					This 3D page is not part of the supported web-v1 product surface yet. It currently renders
					sample fatigue data and should be treated as an experimental preview only.
				</p>
			</div>

			<Body3DViewer fatigueData={defaultFatigueData} />

			<p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
				3D model from{" "}
				<a
					href="https://github.com/hpfrei/body-anatomy-3d-viewer"
					target="_blank"
					rel="noopener noreferrer"
					style={{ color: "var(--color-brand)" }}
				>
					hpfrei/body-anatomy-3d-viewer
				</a>{" "}
				· Z-Anatomy dataset (CC BY-SA 4.0)
			</p>
		</div>
	);
}
