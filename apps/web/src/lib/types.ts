// ============================================================
// Frontend Domain Types — Web-only
// Types specific to the web app's UI layer.
// Shared domain types live in @triathlon/core and @triathlon/types.
// ============================================================

import type { MuscleFatigue } from "@triathlon/core";

// ── Training ──────────────────────────────────────────────────

export type TrainingSession = {
	day: string;
	session: string;
	type: "SWIM" | "BIKE" | "RUN" | "STRENGTH";
	done: boolean;
	durationMin?: number;
};

export type TrainingPlan = {
	id: string;
	name: string;
	eventDate: string;
	eventName: string;
	currentWeek: number;
	totalWeeks: number;
	status: "draft" | "active" | "completed" | "archived";
	thisWeek: TrainingSession[];
};

export type UpcomingEvent = {
	id: string;
	name: string;
	date: string;
	type: "SPRINT" | "OLYMPIC" | "HALF_IRONMAN" | "IRONMAN" | "CUSTOM";
	location: string;
};

// ── AI Coach ──────────────────────────────────────────────────

export type Message = {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
	metadata?: {
		sources?: string[];
		confidence?: number;
		toolCalls?: string[];
		imageUrls?: string[];
	};
};

export type Conversation = {
	id: string;
	title: string;
	messages: Message[];
	createdAt: string;
};

export const suggestedPrompts = [
	"Why are my legs so tired?",
	"Create a taper plan for my race",
	"Analyze my swim technique trends",
	"What should I eat before a long ride?",
	"Compare my run pace this month vs last",
];

// ── Demo / Fallback Data ──────────────────────────────────────

export const defaultFatigueData: MuscleFatigue[] = [
	{ muscle: "Quadriceps", bodyPart: "quadriceps", level: 85, status: "high" },
	{ muscle: "Hamstrings", bodyPart: "hamstrings", level: 72, status: "high" },
	{ muscle: "Calves", bodyPart: "calves", level: 65, status: "moderate" },
	{ muscle: "Shoulders", bodyPart: "shoulders", level: 40, status: "moderate" },
	{ muscle: "Core", bodyPart: "core", level: 55, status: "moderate" },
	{ muscle: "Glutes", bodyPart: "glutes", level: 70, status: "high" },
	{ muscle: "Lower Back", bodyPart: "lower_back", level: 45, status: "moderate" },
	{ muscle: "Lats", bodyPart: "lats", level: 35, status: "low" },
	{ muscle: "Chest", bodyPart: "chest", level: 30, status: "low" },
	{ muscle: "Biceps", bodyPart: "biceps", level: 42, status: "moderate" },
	{ muscle: "Triceps", bodyPart: "triceps", level: 38, status: "low" },
	{ muscle: "Traps", bodyPart: "traps", level: 48, status: "moderate" },
	{ muscle: "Forearms", bodyPart: "forearms", level: 25, status: "low" },
	{ muscle: "Neck", bodyPart: "neck", level: 20, status: "low" },
	{ muscle: "Hip Flexors", bodyPart: "hip_flexors", level: 58, status: "moderate" },
	{ muscle: "Adductors", bodyPart: "adductors", level: 52, status: "moderate" },
];
