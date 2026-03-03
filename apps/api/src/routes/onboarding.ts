import { OnboardingSubmission } from "@triathlon/types";
import { Hono } from "hono";
import { createLogger } from "../lib/logger.js";
import { getAuth } from "../middleware/auth.js";
import { isResponse, parseBody } from "../middleware/validate.js";
import { createAdminClient, insertMemory } from "../services/ai/supabase.js";
import { createEmbeddings } from "../services/ai/utils/embeddings.js";

const log = createLogger({ module: "onboarding-route" });

function asPreferenceObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, unknown>;
}

export const onboardingRoutes = new Hono();

onboardingRoutes.post("/", async (c) => {
	const { userId } = getAuth(c);
	const body = await parseBody(c, OnboardingSubmission);
	if (isResponse(body)) return body;

	const supabase = createAdminClient();

	const { data: profileRow, error: profileError } = await supabase
		.from("profiles")
		.select("preferences")
		.eq("id", userId)
		.single();

	if (profileError) {
		log.error({ err: profileError, userId }, "Failed to read profile for onboarding");
		return c.json({ error: "Failed to load profile" }, 500);
	}

	const currentPreferences = asPreferenceObject(profileRow?.preferences);
	const nextPreferences: Record<string, unknown> = {
		...currentPreferences,
		...(body.level ? { level: body.level } : {}),
		...(body.primaryGoal ? { primary_goal: body.primaryGoal } : {}),
		...(body.onboardingCompleted !== undefined
			? { onboarding_completed: body.onboardingCompleted }
			: { onboarding_completed: true }),
	};

	const profileUpdates: Record<string, unknown> = {
		preferences: nextPreferences,
	};
	if (body.displayName !== undefined) {
		profileUpdates.display_name = body.displayName;
	}
	if (body.defaultView !== undefined) {
		profileUpdates.default_view = body.defaultView;
	}

	const { error: updateError } = await supabase
		.from("profiles")
		.update(profileUpdates)
		.eq("id", userId);

	if (updateError) {
		log.error({ err: updateError, userId }, "Failed to update profile during onboarding");
		return c.json({ error: "Failed to save onboarding profile details" }, 500);
	}

	let savedMemories = 0;
	const shouldSaveMemories = body.saveMemories !== false;

	if (shouldSaveMemories) {
		const memoryCandidates: Array<{
			category: "goal" | "pattern";
			content: string;
			importance: number;
		}> = [];

		if (body.level) {
			memoryCandidates.push({
				category: "pattern",
				content: `Athlete self-identifies as ${body.level} level.`,
				importance: 3,
			});
		}

		if (body.primaryGoal) {
			memoryCandidates.push({
				category: "goal",
				content: `Primary goal: ${body.primaryGoal}`,
				importance: 4,
			});
		}

		if (memoryCandidates.length > 0) {
			let embeddingsModel: ReturnType<typeof createEmbeddings> | null = null;

			for (const candidate of memoryCandidates) {
				const { data: existingRows, error: existingError } = await supabase
					.from("athlete_memories")
					.select("id")
					.eq("athlete_id", userId)
					.eq("category", candidate.category)
					.eq("content", candidate.content)
					.limit(1);

				if (existingError) {
					log.warn({ err: existingError, userId }, "Failed to check existing onboarding memory");
				}

				if ((existingRows ?? []).length > 0) {
					continue;
				}

				let embedding: number[] | undefined;
				try {
					embeddingsModel ??= createEmbeddings();
					embedding = await embeddingsModel.embedQuery(candidate.content);
				} catch (err) {
					log.warn({ err, userId }, "Embedding generation failed for onboarding memory");
				}

				try {
					await insertMemory(supabase, {
						athlete_id: userId,
						category: candidate.category,
						content: candidate.content,
						importance: candidate.importance,
						embedding,
					});
					savedMemories += 1;
				} catch (err) {
					log.warn({ err, userId }, "Failed to save onboarding memory");
				}
			}
		}
	}

	return c.json({
		success: true,
		savedMemories,
		preferences: nextPreferences,
	});
});
