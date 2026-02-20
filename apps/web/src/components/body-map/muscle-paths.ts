"use client";

/**
 * Mapping between our fatigue bodyPart names and the
 * react-body-highlighter muscle slug names.
 *
 * Library muscles:
 *   chest, biceps, triceps, forearm, front-deltoids, back-deltoids,
 *   abs, obliques, quadriceps, hamstring, calves, gluteal,
 *   adductor, abductors, trapezius, upper-back, lower-back,
 *   head, neck, knees, left-soleus, right-soleus
 */

import type { Muscle } from "react-body-highlighter";

/** Maps our fatigueData.bodyPart → library muscle slug(s) */
export const fatigueToLibMuscles: Record<string, Muscle[]> = {
	quadriceps: ["quadriceps"],
	hamstrings: ["hamstring"],
	calves: ["calves"],
	shoulders: ["front-deltoids", "back-deltoids"],
	core: ["abs", "obliques"],
	glutes: ["gluteal"],
	lower_back: ["lower-back"],
	lats: ["upper-back"],
	chest: ["chest"],
	biceps: ["biceps"],
	triceps: ["triceps"],
	traps: ["trapezius"],
	forearms: ["forearm"],
	neck: ["neck"],
	hip_flexors: ["adductor"],
	adductors: ["abductors"],
};

/** Reverse map: library muscle slug → display label for our detail panel */
export const libMuscleLabels: Record<string, string> = {
	chest: "Chest",
	biceps: "Biceps",
	triceps: "Triceps",
	forearm: "Forearms",
	"front-deltoids": "Front Deltoids",
	"back-deltoids": "Rear Deltoids",
	abs: "Abs",
	obliques: "Obliques",
	quadriceps: "Quadriceps",
	hamstring: "Hamstrings",
	calves: "Calves",
	gluteal: "Glutes",
	adductor: "Hip Flexors",
	abductors: "Adductors",
	trapezius: "Traps",
	"upper-back": "Upper Back / Lats",
	"lower-back": "Lower Back",
	head: "Head",
	neck: "Neck",
	knees: "Knees",
	"left-soleus": "Left Soleus",
	"right-soleus": "Right Soleus",
};

/** Reverse map: library muscle slug → our fatigueData bodyPart */
export const libMuscleToBodyPart: Record<string, string> = {
	chest: "chest",
	biceps: "biceps",
	triceps: "triceps",
	forearm: "forearms",
	"front-deltoids": "shoulders",
	"back-deltoids": "shoulders",
	abs: "core",
	obliques: "core",
	quadriceps: "quadriceps",
	hamstring: "hamstrings",
	calves: "calves",
	gluteal: "glutes",
	adductor: "hip_flexors",
	abductors: "adductors",
	trapezius: "traps",
	"upper-back": "lats",
	"lower-back": "lower_back",
	neck: "neck",
};
