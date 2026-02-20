import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Triathlon AI — Intelligent Coaching Platform",
		short_name: "Triathlon AI",
		description:
			"AI-powered triathlon coaching with personalised training plans, real-time health insights, and team gamification.",
		start_url: "/workout/dashboard",
		display: "standalone",
		orientation: "portrait-primary",
		background_color: "#0a0a0f",
		theme_color: "#0a0a0f",
		categories: ["health", "fitness", "sports"],
		prefer_related_applications: false,
		icons: [
			{
				src: "/workout/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/workout/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
			{
				src: "/workout/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
