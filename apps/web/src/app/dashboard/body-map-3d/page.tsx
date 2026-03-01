"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { defaultFatigueData } from "@/lib/types";

/* Dynamic import — WebGL/Three.js cannot SSR */
const Body3DViewer = dynamic(() => import("@/components/body-map-3d/Body3DViewer"), {
	ssr: false,
	loading: () => (
		<div className="flex items-center justify-center" style={{ height: "65vh" }}>
			<div className="text-center">
				<div
					className="w-10 h-10 mx-auto mb-3 rounded-full"
					style={{
						border: "3px solid rgba(255,255,255,0.1)",
						borderTopColor: "var(--color-accent, #6366f1)",
						animation: "spin 0.8s linear infinite",
					}}
				/>
				<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
					Loading 3D viewer…
				</p>
			</div>
		</div>
	),
});

export default function BodyMap3DPage() {
	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
						Body Map — 3D View
					</h1>
					<p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
						Interactive 3D anatomy view
					</p>
				</div>
				<Link
					href="/dashboard/body-map"
					className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
					style={{
						background: "var(--color-glass-bg)",
						border: "1px solid var(--color-border)",
						color: "var(--color-text-primary)",
					}}
				>
					← Switch to 2D
				</Link>
			</div>

			{/* 3D Viewer */}
			<Body3DViewer fatigueData={defaultFatigueData} />

			{/* Attribution */}
			<p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
				3D model from{" "}
				<a
					href="https://github.com/hpfrei/body-anatomy-3d-viewer"
					target="_blank"
					rel="noopener noreferrer"
					style={{ color: "var(--color-accent)" }}
				>
					hpfrei/body-anatomy-3d-viewer
				</a>{" "}
				· Z-Anatomy dataset (CC BY-SA 4.0)
			</p>
		</div>
	);
}
