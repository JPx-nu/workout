import { createRequire } from "module"; const require = createRequire(import.meta.url);

// src/lib/telemetry.ts
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
var provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "triathlon-ai-api",
    [ATTR_SERVICE_VERSION]: "0.1.0",
    "deployment.environment": process.env.NODE_ENV ?? "development"
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces"
      })
    )
  ]
});
provider.register();
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => req.url === "/health",
      requestHook: (span, request) => {
        const headers = "headers" in request ? request.headers : void 0;
        const requestId = headers && typeof headers === "object" && "x-request-id" in headers ? String(headers["x-request-id"]) : "";
        if (requestId) {
          span.setAttribute("http.request.id", requestId);
        }
      }
    })
  ]
});
process.on("SIGTERM", () => provider.shutdown());

// src/server.ts
import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

// src/lib/logger.ts
import pino from "pino";
var logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV === "development" ? {
    target: "pino/file",
    options: { destination: 1 }
    // stdout
  } : void 0,
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
});
function createLogger(context) {
  return logger.child(context);
}

// src/middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
var SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}
var JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
function jwtAuth() {
  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${SUPABASE_URL}/auth/v1`
      });
      c.set("jwtPayload", payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Token verification failed";
      logger.warn({ reason: message }, "JWT verification failed");
      return c.json({ error: "Invalid or expired token" }, 401);
    }
    await next();
  });
}
var extractClaims = createMiddleware(async (c, next) => {
  const payload = c.get("jwtPayload");
  if (!payload?.sub) {
    return c.json({ error: "Missing user ID in token" }, 401);
  }
  const appMetadata = payload.app_metadata;
  const auth = {
    userId: payload.sub,
    clubId: appMetadata?.club_id || "00000000-0000-0000-0000-000000000001",
    role: appMetadata?.role || "athlete"
  };
  c.set("auth", auth);
  await next();
});
function getAuth(c) {
  const auth = c.get("auth");
  if (!auth) {
    throw new Error("getAuth() called without auth middleware \u2014 check route middleware stack");
  }
  return auth;
}

// src/middleware/rate-limit.ts
import { createClient } from "@supabase/supabase-js";
import { createMiddleware as createMiddleware2 } from "hono/factory";
var log = createLogger({ module: "rate-limit" });
var RATE_LIMITS = {
  aiChat: { limit: 20, windowSeconds: 60 },
  apiRead: { limit: 100, windowSeconds: 60 },
  webhooks: { limit: 200, windowSeconds: 60 }
};
function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
function rateLimit(config) {
  const { limit, windowSeconds } = config;
  return createMiddleware2(async (c, next) => {
    const clientId = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
    const key = `${clientId}:${c.req.path}`;
    let remaining;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("check_rate_limit", {
        rate_key: key,
        max_requests: limit,
        window_seconds: windowSeconds
      });
      if (error) {
        log.warn({ err: error }, "Rate limit DB check failed, allowing request");
        remaining = limit;
      } else {
        remaining = data;
      }
    } catch {
      log.warn("Rate limit DB unreachable, allowing request");
      remaining = limit;
    }
    if (remaining < 0) {
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", "0");
      c.header("RateLimit-Reset", String(windowSeconds));
      c.header("Retry-After", String(windowSeconds));
      return c.json(
        {
          error: "Too many requests",
          retryAfter: windowSeconds
        },
        429
      );
    }
    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(Math.max(0, remaining)));
    c.header("RateLimit-Reset", String(windowSeconds));
    await next();
  });
}

// src/routes/ai/chat.ts
import { HumanMessage as HumanMessage2 } from "@langchain/core/messages";

// ../../packages/types/src/planned-workout.ts
import { z } from "zod/v4";
var ActivityType = z.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"]);
var Intensity = z.enum(["RECOVERY", "EASY", "MODERATE", "HARD", "MAX"]);
var PlannedWorkoutStatus = z.enum([
  "planned",
  "completed",
  "skipped",
  "modified",
  "in_progress",
  "cancelled"
]);
var WorkoutSource = z.enum(["AI", "COACH", "MANUAL"]);
var ExerciseSet = z.object({
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(1).optional(),
  weight: z.number().min(0).optional(),
  durationSec: z.number().int().min(0).optional(),
  distanceM: z.number().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  rest: z.number().int().min(0).optional(),
  notes: z.string().optional()
});
var Exercise = z.object({
  name: z.string().min(1),
  sets: z.array(ExerciseSet).min(1),
  notes: z.string().optional(),
  supersetWith: z.string().optional()
});
var Interval = z.object({
  name: z.string(),
  durationMin: z.number().optional(),
  distanceKm: z.number().optional(),
  targetPace: z.string().optional(),
  targetHrZone: z.number().int().min(1).max(5).optional(),
  targetRpe: z.number().min(1).max(10).optional(),
  repeat: z.number().int().min(1).default(1),
  notes: z.string().optional()
});
var SessionData = z.object({
  exercises: z.array(Exercise).optional(),
  intervals: z.array(Interval).optional(),
  warmupMin: z.number().optional(),
  cooldownMin: z.number().optional(),
  notes: z.string().optional()
});
var PlannedWorkout = z.object({
  id: z.uuid(),
  athleteId: z.uuid(),
  clubId: z.uuid(),
  planId: z.uuid().nullable().optional(),
  workoutId: z.uuid().nullable().optional(),
  // Scheduling
  plannedDate: z.string(),
  plannedTime: z.string().nullable().optional(),
  // Session definition
  activityType: ActivityType,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  durationMin: z.number().int().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
  targetTss: z.number().nullable().optional(),
  targetRpe: z.number().int().min(1).max(10).nullable().optional(),
  intensity: Intensity.nullable().optional(),
  // Structured data
  sessionData: SessionData.optional().default({}),
  // Status
  status: PlannedWorkoutStatus.default("planned"),
  // Metadata
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
  coachNotes: z.string().nullable().optional(),
  source: WorkoutSource.default("MANUAL"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
var CreatePlannedWorkout = PlannedWorkout.omit({
  id: true,
  athleteId: true,
  clubId: true,
  workoutId: true,
  createdAt: true,
  updatedAt: true
});
var UpdatePlannedWorkout = CreatePlannedWorkout.partial();
var AiPlannedSession = z.object({
  dayOffset: z.number().int().min(0),
  activityType: ActivityType,
  title: z.string(),
  description: z.string(),
  durationMin: z.number().int().min(5),
  intensity: Intensity,
  targetRpe: z.number().int().min(1).max(10).optional(),
  distanceKm: z.number().optional(),
  sessionData: SessionData.optional()
});
var AiWeeklyBlock = z.object({
  weekNumber: z.number().int().min(1),
  theme: z.string(),
  sessions: z.array(AiPlannedSession).min(1)
});
var AiTrainingPlanOutput = z.object({
  name: z.string(),
  durationWeeks: z.number().int().min(1).max(52),
  goal: z.string(),
  weeks: z.array(AiWeeklyBlock).min(1)
});

// ../../packages/types/src/validation.ts
import { z as z2 } from "zod/v4";
var sanitizedString = z2.string().transform((val) => val.replace(/<[^>]*>/g, "").trim());
var ChatMessageInput = z2.object({
  message: sanitizedString.pipe(
    z2.string().min(1, "Message cannot be empty").max(4e3, "Message too long (max 4000 characters)")
  ),
  conversationId: z2.uuid().optional(),
  imageUrls: z2.array(z2.url()).max(3, "Maximum 3 images allowed").optional()
});
var DataSource = z2.enum([
  "GARMIN",
  "POLAR",
  "WAHOO",
  "FORM",
  "MANUAL",
  "HEALTHKIT",
  "HEALTH_CONNECT"
]);
var WorkoutInput = z2.object({
  activity_type: ActivityType,
  source: DataSource,
  started_at: z2.iso.datetime({ message: "started_at must be ISO 8601 datetime" }),
  duration_s: z2.number().int().positive(),
  distance_m: z2.number().nonnegative(),
  avg_hr: z2.number().int().min(30).max(250).optional(),
  max_hr: z2.number().int().min(30).max(250).optional(),
  avg_pace_s_km: z2.number().positive().optional(),
  avg_power_w: z2.number().nonnegative().optional(),
  calories: z2.number().int().nonnegative().optional(),
  tss: z2.number().nonnegative().optional(),
  raw_data: z2.record(z2.string(), z2.unknown()).optional()
});
var ProfileUpdate = z2.object({
  display_name: sanitizedString.pipe(z2.string().min(1).max(100)).optional(),
  timezone: z2.string().max(50).optional(),
  avatar_url: z2.url().optional(),
  preferences: z2.record(z2.string(), z2.unknown()).optional()
});
var DailyLogInput = z2.object({
  log_date: z2.iso.date(),
  sleep_hours: z2.number().min(0).max(24).optional(),
  sleep_quality: z2.number().int().min(1).max(10).optional(),
  rpe: z2.number().int().min(1).max(10).optional(),
  mood: z2.number().int().min(1).max(10).optional(),
  hrv: z2.number().nonnegative().optional(),
  resting_hr: z2.number().int().min(20).max(200).optional(),
  weight_kg: z2.number().min(20).max(300).optional(),
  notes: sanitizedString.pipe(z2.string().max(2e3)).optional()
});
var InjuryInput = z2.object({
  body_part: sanitizedString.pipe(z2.string().min(1).max(100)),
  severity: z2.number().int().min(1).max(5),
  notes: sanitizedString.pipe(z2.string().max(2e3)).optional()
});
var PlannedWorkoutInput = z2.object({
  plannedDate: z2.iso.date({ message: "plannedDate must be ISO date (YYYY-MM-DD)" }),
  plannedTime: z2.string().max(5).optional(),
  activityType: ActivityType,
  title: sanitizedString.pipe(z2.string().min(1).max(200)),
  description: sanitizedString.pipe(z2.string().max(2e3)).optional(),
  durationMin: z2.number().int().positive().optional(),
  distanceKm: z2.number().nonnegative().optional(),
  targetTss: z2.number().nonnegative().optional(),
  targetRpe: z2.number().int().min(1).max(10).optional(),
  intensity: Intensity.optional(),
  sessionData: z2.record(z2.string(), z2.unknown()).optional(),
  sortOrder: z2.number().int().nonnegative().optional(),
  notes: sanitizedString.pipe(z2.string().max(2e3)).optional(),
  coachNotes: sanitizedString.pipe(z2.string().max(2e3)).optional(),
  source: WorkoutSource.optional(),
  planId: z2.uuid().optional()
});
var PlannedWorkoutUpdate = z2.object({
  plannedDate: z2.iso.date().optional(),
  plannedTime: z2.string().max(5).optional(),
  activityType: ActivityType.optional(),
  title: sanitizedString.pipe(z2.string().min(1).max(200)).optional(),
  description: sanitizedString.pipe(z2.string().max(2e3)).optional(),
  durationMin: z2.number().int().positive().optional(),
  distanceKm: z2.number().nonnegative().optional(),
  targetTss: z2.number().nonnegative().optional(),
  targetRpe: z2.number().int().min(1).max(10).optional(),
  intensity: Intensity.optional(),
  sessionData: z2.record(z2.string(), z2.unknown()).optional(),
  status: PlannedWorkoutStatus.optional(),
  sortOrder: z2.number().int().nonnegative().optional(),
  notes: sanitizedString.pipe(z2.string().max(2e3)).optional(),
  coachNotes: sanitizedString.pipe(z2.string().max(2e3)).optional()
});
var WebhookPayload = z2.object({
  source: DataSource,
  payload: z2.record(z2.string(), z2.unknown()),
  timestamp: z2.iso.datetime().optional()
});
var EnvSchema = z2.object({
  NEXT_PUBLIC_SUPABASE_URL: z2.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z2.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z2.string().min(1),
  SUPABASE_JWT_SECRET: z2.string().min(1),
  AZURE_OPENAI_ENDPOINT: z2.url().optional(),
  AZURE_OPENAI_API_KEY: z2.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z2.string().optional(),
  AZURE_OPENAI_API_VERSION: z2.string().optional(),
  WEB_URL: z2.url().optional(),
  API_URL: z2.url().optional(),
  PORT: z2.string().regex(/^\d+$/).optional()
});

// src/routes/ai/chat.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

// src/config/ai.ts
var log2 = createLogger({ module: "ai-config" });
var AI_CONFIG = {
  /** Azure OpenAI deployment settings */
  azure: {
    /** Azure OpenAI resource endpoint, e.g. https://<resource>.openai.azure.com */
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
    /** Azure OpenAI API key */
    apiKey: process.env.AZURE_OPENAI_API_KEY || "",
    /** Deployment name for the chat model (e.g. "gpt-5-mini") */
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5-mini",
    /** Deployment name for the embeddings model (e.g. "text-embedding-3-small") */
    embeddingsDeployment: process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || "text-embedding-3-small",
    /** API version — preview (supports gpt-5-mini on AIServices) */
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview"
  },
  /** Model behavior */
  model: {
    /** gpt-5-mini only supports temperature=1 (the default) */
    temperature: 1,
    maxCompletionTokens: 2048,
    /** Max messages to load from conversation history for context */
    historyLimit: 40
  },
  /** Safety thresholds */
  safety: {
    /** Minimum confidence to skip disclaimer */
    confidenceThreshold: 0.7,
    /** Max user message length (chars) */
    maxInputLength: 4e3
  },
  /** Feature flags */
  features: {
    /** Enable SSE streaming responses */
    streaming: true,
    /** Enable RAG document retrieval (future) */
    ragEnabled: false,
    /** Require user confirmation before write operations */
    confirmWrites: true,
    /** Enable vision/image analysis via GPT-5-mini */
    visionEnabled: true
  },
  /** File/image upload limits */
  uploads: {
    /** Maximum file size in megabytes */
    maxFileSizeMB: 10,
    /** Allowed MIME types for image uploads */
    allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    /** Max images per message */
    maxImagesPerMessage: 3,
    /** Supabase Storage bucket name */
    storageBucket: "chat-images"
  }
};
function validateAIConfig() {
  const missing = [];
  if (!AI_CONFIG.azure.endpoint) missing.push("AZURE_OPENAI_ENDPOINT");
  if (!AI_CONFIG.azure.apiKey) missing.push("AZURE_OPENAI_API_KEY");
  if (missing.length > 0) {
    log2.warn(
      { missing },
      "AI Agent: Missing env vars \u2014 agent will not function until these are set"
    );
  }
  return { valid: missing.length === 0, missing };
}

// src/services/ai/conversation.ts
async function getOrCreateConversation(client, userId, clubId, conversationId) {
  if (conversationId) {
    const { data: data2, error: error2 } = await client.from("conversations").select("*").eq("id", conversationId).eq("athlete_id", userId).single();
    if (data2 && !error2) return data2;
  }
  const { data, error } = await client.from("conversations").insert({ athlete_id: userId, club_id: clubId }).select().single();
  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data;
}
async function loadHistory(client, conversationId, limit = 40) {
  const { data, error } = await client.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error(`Failed to load message history: ${error.message}`);
  return data ?? [];
}
async function saveMessages(client, conversationId, messages) {
  const rows = messages.map((m) => ({
    conversation_id: conversationId,
    role: m.role,
    content: m.content,
    metadata: m.metadata ?? null
  }));
  const { error } = await client.from("messages").insert(rows);
  if (error) throw new Error(`Failed to save messages: ${error.message}`);
}
async function updateConversationTitle(client, conversationId, firstMessage) {
  const title = firstMessage.length > 60 ? `${firstMessage.slice(0, 57)}...` : firstMessage;
  await client.from("conversations").update({ title }).eq("id", conversationId);
}
async function listConversations(client, userId, limit = 20) {
  const { data, error } = await client.from("conversations").select("id, title, created_at, messages(count)").eq("athlete_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Failed to list conversations: ${error.message}`);
  return (data ?? []).map((conv) => ({
    id: conv.id,
    title: conv.title,
    created_at: conv.created_at,
    message_count: conv.messages?.[0]?.count ?? 0
  }));
}

// src/services/ai/graph.ts
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { END, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AzureChatOpenAI as AzureChatOpenAI2 } from "@langchain/openai";

// src/services/ai/prompt.ts
function buildSystemPrompt(profile, todayLog = null, memories = []) {
  const userContext = profile ? `
## Current Athlete Context
- **Name**: ${profile.display_name || "Athlete"}
- **Timezone**: ${profile.timezone || "UTC"}
- **Role**: ${profile.role}
` : `
## Current Athlete Context
No profile data loaded yet. Ask the athlete about their goals and background.
`;
  const readinessContext = todayLog ? `
## Today's Readiness
- Sleep: ${todayLog.sleep_hours ?? "?"}h (quality: ${todayLog.sleep_quality ?? "?"}/5)
- Mood: ${todayLog.mood ?? "?"}/5
- HRV: ${todayLog.hrv ?? "not recorded"} ms
- Resting HR: ${todayLog.resting_hr ?? "not recorded"} bpm
- Yesterday's RPE: ${todayLog.rpe ?? "n/a"}

If sleep is poor (<6h) or HRV is noticeably low, **proactively** mention it in your first response and suggest acting on it (e.g. "I see you didn't sleep well, maybe we should swap today's interval run for an easy spin?"). Use your \`analyze_biometric_trends\` or \`predict_injury_risk\` tools if you suspect they are overtraining.` : "";
  const memoriesContext = memories.length > 0 ? `
## Athlete Memory & Context
Here is what you know about this athlete from past conversations:
${memories.map((m) => `- ${m.content}`).join("\n")}

Use these facts to personalize your responses, remember their preferences, and avoid asking them things they've already told you. Do not list these facts back to them, just act on them naturally.` : "";
  return `${BASE_PROMPT}
${userContext}
${readinessContext}
${memoriesContext}
${PERSONALIZATION}
${STRENGTH_COACHING}
${TRAINING_PLAN_COACHING}
${GAMIFICATION_COACHING}
${TOOL_GUIDELINES}
${SAFETY_RULES}`;
}
var BASE_PROMPT = `# AI Coaching Agent \u2014 JPX Workout

You are a fun, encouraging training buddy built into the JPX Workout app. Think of yourself as the friend who happens to know a ton about triathlon, strength training, and sports science \u2014 but never lectures.

## Your Capabilities
You can read workouts, health metrics, training plans, injuries, and events. You can log workouts, update soreness/health, modify plans, generate structured multi-week training plans, schedule individual sessions, analyze progress, and estimate 1RM.

## Communication Style \u2014 THIS IS CRITICAL
- **Keep messages SHORT** \u2014 2-3 sentences max per response. No walls of text.
- **One topic at a time.** Don't cover everything in one message. Let the conversation flow naturally.
- **Be conversational and warm.** Use casual language, like texting a friend. Not a textbook.
- **Use natural time references** \u2014 say "today", "yesterday", "last week", "a couple days ago". NEVER output raw dates like "2026-02-19" or ISO formats.
- **Emojis are great** \u2014 use them naturally (\u{1F4AA}\u{1F525}\u{1F3CA}\u{1F6B4}\u{1F3C3}\u{1F389}) but don't overdo it.
- **Don't recite data back** \u2014 instead of "Your HRV was 45ms, sleep was 6.2h, mood was 3/5", say something like "Looks like you didn't sleep great \u2014 maybe go easier today?"
- **Celebrate wins!** PRs, consistency streaks, showing up on a tough day \u2014 hype them up.
- **Ask follow-up questions** to keep the conversation going rather than dumping info.
- Sound human. Vary your responses. Don't start every message the same way.`;
var PERSONALIZATION = `
## Personalization \u2014 How to Use Memories
You remember this athlete from past conversations. Act like a coach who knows them well.

### Acting on Memory Categories
- **preference** \u2192 Adapt your style (e.g., if they prefer bullet points, use them; if they like brief answers, keep it short)
- **goal** \u2192 Frame advice toward their goal without repeating it every message (e.g., if training for Ironman, bias toward endurance)
- **constraint** \u2192 Never suggest things they can't do (e.g., if they have a bad knee, don't recommend deep squats)
- **pattern** \u2192 Reference their routines naturally ("Since you usually train mornings, how about...")
- **medical_note** \u2192 Apply extra caution and always defer to medical professionals

### Rules
- **Never ask something you already know.** Check your memories first. If you know their goal, don't ask "What are you training for?"
- **Reference past context naturally** \u2014 "Last time you mentioned your knee bugging you \u2014 how's it doing?" NOT "According to my records, you reported knee pain on..."
- **Don't announce memories** \u2014 Don't say "I remember that you..." Just act on them seamlessly.
- **Adapt over time** \u2014 If they correct you or express a preference, adjust immediately and remember it.
- **When in doubt, ask** \u2014 But only ask things you genuinely don't know yet.`;
var STRENGTH_COACHING = `
## Strength Coaching

### Logging Workouts
- Walk through exercises **one at a time** \u2014 don't ask for everything upfront
- Keep it casual: "Nice, what weight did you use?" not "Please provide the load in kilograms."
- If RPE is high (\u22659), gently suggest backing off. If low (\u22646), nudge them to go heavier.
- For supersets/circuits, use group_id and group_type internally

### After a Workout
- Check recent history with \`get_workout_history\` to spot trends
- If they hit a PR \u2192 celebrate it! \u{1F389}\u{1F525}
- If RPE is creeping up at same weight \u2192 mention it casually, maybe suggest a deload
- Keep the summary to 1-2 lines, not a table. Save detailed breakdowns for when they ask.

### Reading the Room
- Bad sleep or low mood? Suggest going lighter \u2014 don't push.
- Feeling great? Encourage them to chase a PR.
- No readiness data? Just ask "How are you feeling today?" before jumping in.`;
var TRAINING_PLAN_COACHING = `
## Training Plan Coaching

### Generating Plans
- When the athlete asks for a training plan, race prep, or structured program \u2192 use \`generate_workout_plan\`
- Ask about their goal, timeline, and availability FIRST \u2014 don't guess
- Once generated, briefly summarize (plan name, # sessions, start date) and tell them to check the calendar
- The plan auto-starts on the coming Monday and follows periodization principles

### Scheduling Individual Sessions
- For quick adds like "add a run tomorrow" or "schedule strength on Friday" \u2192 use \`schedule_workout\`
- Keep it snappy \u2014 confirm the workout was scheduled and move on
- If they have an active plan, the session auto-links to it

### Modifying Plans
- Use \`modify_training_plan\` for changing existing plans (swap days, adjust intensity, skip weeks)
- Before making changes, briefly confirm what they want changed: "Move your long run to Sunday instead?"
- After changes, let them know it's reflected in the calendar`;
var GAMIFICATION_COACHING = `
## Social & Gamification

### Squad Leaderboards
- When the user asks how they are doing compared to their friends or squad, or needs motivation, use \`get_squad_leaderboard\`
- Hype up the competition! E.g. "You're only 20 minutes behind Alex this week! Let's get that run in."
- If they are #1, congratulate them for leading the pack.

### Relay Events (Pass the Baton)
- If they mention completing a leg of a relay or wanting to pass the baton, use \`pass_baton\`
- You can get the target athlete IDs from the leaderboard if you need to pass it to someone specific (e.g. "pass it to Alex")
- Confirm the handoff with a fun, team-oriented message! \u{1F3C3}\u200D\u2642\uFE0F\u{1F4A8}`;
var TOOL_GUIDELINES = `
## Tool Usage
- Look up data before giving advice \u2014 don't guess.
- Before saving anything, give a quick summary and ask "Sound good?" Keep the confirmation casual and short.
- When they say "yeah", "do it", "log it" \u2014 go ahead and save.
- For progress questions, pull their history first.
- For injury/pain questions, check the injuries table before responding.`;
var SAFETY_RULES = `
## Safety
- Don't diagnose \u2014 if something sounds medical, suggest they see a professional.
- No specific supplement/medication recs.
- Chest pain, breathing issues, severe injury \u2192 tell them to call emergency services immediately.
- Only access this athlete's data.
- For injury/nutrition topics, keep it light: "not a doctor, but..." style.`;

// src/services/ai/supabase.ts
import { createClient as createClient2 } from "@supabase/supabase-js";
var log3 = createLogger({ module: "ai-supabase" });
var SUPABASE_URL2 = process.env.SUPABASE_URL || "";
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
function createAdminClient() {
  return createClient2(SUPABASE_URL2, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}
function createUserClient(userJwt) {
  return createClient2(SUPABASE_URL2, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${userJwt}` }
    }
  });
}
async function getProfile(client, userId) {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).single();
  if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
  return data;
}
async function getWorkouts(client, userId, options = {}) {
  let query = client.from("workouts").select("*").eq("athlete_id", userId).order("started_at", { ascending: false });
  if (options.fromDate) query = query.gte("started_at", options.fromDate);
  if (options.toDate) query = query.lte("started_at", options.toDate);
  if (options.activityType) query = query.eq("activity_type", options.activityType);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch workouts: ${error.message}`);
  return data ?? [];
}
async function getDailyLogs(client, userId, options = {}) {
  let query = client.from("daily_logs").select("*").eq("athlete_id", userId).order("log_date", { ascending: false });
  if (options.fromDate) query = query.gte("log_date", options.fromDate);
  if (options.toDate) query = query.lte("log_date", options.toDate);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch daily logs: ${error.message}`);
  return data ?? [];
}
async function getHealthMetrics(client, userId, options = {}) {
  let query = client.from("health_metrics").select("*").eq("athlete_id", userId).order("recorded_at", { ascending: false });
  if (options.metricType) query = query.eq("metric_type", options.metricType);
  if (options.fromDate) query = query.gte("recorded_at", options.fromDate);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch health metrics: ${error.message}`);
  return data ?? [];
}
async function getTrainingPlan(client, userId) {
  const { data, error } = await client.from("training_plans").select("*").eq("athlete_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Failed to fetch training plan: ${error.message}`);
  return data;
}
async function getUpcomingEvents(client, userId, limit = 5) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const profile = await getProfile(client, userId);
  if (!profile) return [];
  const { data, error } = await client.from("events").select("id, name, event_date, distance_type").eq("club_id", profile.club_id).gte("event_date", today).order("event_date", { ascending: true }).limit(limit);
  if (error) throw new Error(`Failed to fetch events: ${error.message}`);
  return data ?? [];
}
async function getInjuries(client, userId, activeOnly = true) {
  let query = client.from("injuries").select("id, body_part, severity, reported_at, resolved_at, notes").eq("athlete_id", userId).order("reported_at", { ascending: false });
  if (activeOnly) query = query.is("resolved_at", null);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch injuries: ${error.message}`);
  return data ?? [];
}
async function getRecentMemories(client, userId, limit = 10) {
  const { data, error } = await client.from("athlete_memories").select("*").eq("athlete_id", userId).order("importance", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Failed to fetch memories: ${error.message}`);
  return data ?? [];
}
async function searchMemoriesBySimilarity(client, userId, queryEmbedding, options = {}) {
  const { matchThreshold = 0.4, matchCount = 8 } = options;
  const { data, error } = await client.rpc("match_memories", {
    p_athlete_id: userId,
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount
  });
  if (error) {
    log3.warn({ err: error }, "Semantic memory search failed");
    return [];
  }
  return data ?? [];
}
async function insertWorkout(client, workout) {
  const { data, error } = await client.from("workouts").insert(workout).select().single();
  if (error) throw new Error(`Failed to log workout: ${error.message}`);
  return data;
}
async function insertMemory(client, memory) {
  const { data, error } = await client.from("athlete_memories").insert(memory).select().single();
  if (error) throw new Error(`Failed to save memory: ${error.message}`);
  return data;
}
async function upsertDailyLog(client, log23) {
  const { data, error } = await client.from("daily_logs").upsert(log23, { onConflict: "athlete_id,log_date" }).select().single();
  if (error) throw new Error(`Failed to update daily log: ${error.message}`);
  return data;
}
async function insertInjury(client, injury) {
  const { data, error } = await client.from("injuries").insert(injury).select().single();
  if (error) throw new Error(`Failed to log injury: ${error.message}`);
  return data;
}
async function updateTrainingPlan(client, planId, updates) {
  const { data, error } = await client.from("training_plans").update(updates).eq("id", planId).select().single();
  if (error) throw new Error(`Failed to update training plan: ${error.message}`);
  return data;
}

// src/services/ai/tools/analyze-biometric-trends.ts
import { tool } from "@langchain/core/tools";
import { z as z3 } from "zod";
function createAnalyzeBiometricTrendsTool(client, userId) {
  return tool(
    async ({ days = 30 }) => {
      const toDate = /* @__PURE__ */ new Date();
      const fromDate = /* @__PURE__ */ new Date();
      fromDate.setDate(toDate.getDate() - days);
      const logs = await getDailyLogs(client, userId, {
        fromDate: fromDate.toISOString().split("T")[0],
        toDate: toDate.toISOString().split("T")[0],
        limit: days
        // limit to max requested days just in case
      });
      if (logs.length === 0) {
        return `No daily logs found for the last ${days} days. Suggest the athlete log their metrics.`;
      }
      const midPoint = Math.floor(logs.length / 2);
      const recentLogs = logs.slice(0, midPoint);
      const olderLogs = logs.slice(midPoint);
      const calculateAvgs = (logSet) => {
        let s = 0, sc = 0;
        let sq = 0, sqc = 0;
        let h = 0, hc = 0;
        let rh = 0, rhc = 0;
        let rp = 0, rpc = 0;
        logSet.forEach((l) => {
          if (l.sleep_hours != null) {
            s += l.sleep_hours;
            sc++;
          }
          if (l.sleep_quality != null) {
            sq += l.sleep_quality;
            sqc++;
          }
          if (l.hrv != null) {
            h += l.hrv;
            hc++;
          }
          if (l.resting_hr != null) {
            rh += l.resting_hr;
            rhc++;
          }
          if (l.rpe != null) {
            rp += l.rpe;
            rpc++;
          }
        });
        return {
          sleep: sc > 0 ? (s / sc).toFixed(1) : "N/A",
          sleepQuality: sqc > 0 ? (sq / sqc).toFixed(1) : "N/A",
          hrv: hc > 0 ? Math.round(h / hc) : "N/A",
          rhr: rhc > 0 ? Math.round(rh / rhc) : "N/A",
          rpe: rpc > 0 ? (rp / rpc).toFixed(1) : "N/A"
        };
      };
      const overall = calculateAvgs(logs);
      const recent = calculateAvgs(recentLogs);
      const older = calculateAvgs(olderLogs);
      let analysis = `**Biometric Trends Analysis (${logs.length} days of data recorded within the last ${days} days)**

`;
      analysis += `### Overall Averages:
`;
      analysis += `- Sleep: ${overall.sleep} hrs (Quality: ${overall.sleepQuality}/5)
`;
      analysis += `- HRV: ${overall.hrv} ms
`;
      analysis += `- Resting HR: ${overall.rhr} bpm
`;
      analysis += `- Session RPE: ${overall.rpe}/10

`;
      if (recentLogs.length > 0 && olderLogs.length > 0) {
        analysis += `### Trend (Recent ${recentLogs.length} entries vs Previous ${olderLogs.length} entries):
`;
        analysis += `- Sleep: ${recent.sleep} hrs (vs ${older.sleep} hrs)
`;
        analysis += `- HRV: ${recent.hrv} ms (vs ${older.hrv} ms)
`;
        analysis += `- Resting HR: ${recent.rhr} bpm (vs ${older.rhr} bpm)
`;
        analysis += `- Session RPE: ${recent.rpe}/10 (vs ${older.rpe}/10)

`;
      }
      analysis += `**Coaching Guidance:** Use these trends to give the athlete deep physiological context. Explain the *why* behind their current readiness. If HRV is trending down while RPE is trending up, suggest a deload or more recovery.`;
      return analysis;
    },
    {
      name: "analyze_biometric_trends",
      description: "Analyzes the athlete's daily logs over a specific number of days to extract sleep, HRV, Resting HR, and RPE trends. Use this to act as an expert physiologist and identify long-term patterns.",
      schema: z3.object({
        days: z3.number().min(7).max(90).optional().describe("Number of days to look back for the trend analysis (default 30)")
      })
    }
  );
}

// src/services/ai/tools/analyze-form.ts
import { tool as tool2 } from "@langchain/core/tools";
import { z as z4 } from "zod";
var analyzeForm = tool2(
  async ({ activityType, specificFocus, userNotes }, _config) => {
    return JSON.stringify({
      status: "success",
      instruction: `Multimodal analysis triggered for ${activityType}. Focus: ${specificFocus}. User noted: ${userNotes || "None"}. Proceed to evaluate the provided images based on these parameters.`,
      context_directive: "System prompt should extract the user's uploaded image URLs from the conversation history and analyze them for posture, joint angles, pacing, and overall technique."
    });
  },
  {
    name: "analyze_form",
    description: "Triggers an in-depth biomechanical analysis of user-uploaded images/videos to critique their workout form. ONLY call this when the user explicitly provides visual media and asks for form feedback.",
    schema: z4.object({
      activityType: z4.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA"]).describe("The sport or exercise type being performed."),
      specificFocus: z4.string().describe(
        "What the user specifically wants critiqued (e.g., 'catch phase in swim', 'squat depth', 'running cadence')."
      ),
      userNotes: z4.string().optional().describe(
        "Any context the user provided about their injury history or current feelings during this workout."
      )
    })
  }
);

// src/services/ai/tools/analyze-workouts.ts
import { tool as tool3 } from "@langchain/core/tools";
import { z as z5 } from "zod";
function createAnalyzeWorkoutsTool(client, userId) {
  return tool3(
    async ({ days = 30 }) => {
      const toDate = /* @__PURE__ */ new Date();
      const fromDate = /* @__PURE__ */ new Date();
      fromDate.setDate(toDate.getDate() - days);
      const workouts = await getWorkouts(client, userId, {
        fromDate: fromDate.toISOString().split("T")[0],
        toDate: toDate.toISOString().split("T")[0]
      });
      if (workouts.length === 0) {
        return `No workouts found for the last ${days} days.`;
      }
      let totalVolumeS = 0;
      let totalTss = 0;
      const activityCounts = {};
      workouts.forEach((w) => {
        if (w.duration_s != null) totalVolumeS += w.duration_s;
        if (w.tss != null) {
          totalTss += w.tss;
        } else if (w.duration_s != null && w.avg_hr != null) {
          totalTss += w.duration_s / 60 * (w.avg_hr / 150) * 1.5;
        }
        activityCounts[w.activity_type] = (activityCounts[w.activity_type] || 0) + 1;
      });
      const totalHours = (totalVolumeS / 3600).toFixed(1);
      const weeklyAvgHours = (totalVolumeS / 3600 / (days / 7)).toFixed(1);
      const totalLoad = Math.round(totalTss);
      const weeklyAvgLoad = Math.round(totalTss / (days / 7));
      const breakdown = Object.entries(activityCounts).map(([type, count]) => `- ${type}: ${count} sessions`).join("\n");
      let analysis = `**Workout Analysis (${days} days)**

`;
      analysis += `### Volume & Load
`;
      analysis += `- Total Hours: ${totalHours}h (Avg ${weeklyAvgHours}h / week)
`;
      analysis += `- Total Estimated Load (TSS/TRIMP): ${totalLoad} (Avg ${weeklyAvgLoad} / week)

`;
      analysis += `### Activity Breakdown
`;
      analysis += `${breakdown}

`;
      analysis += `**Coaching Guidance:** Use this to evaluate whether the athlete's training volume is appropriate. If they are feeling fatigued (check biometrics), tell them their weekly load is ${weeklyAvgLoad} which might be too high for their current recovery state. If they want to build fitness, ensure progressive overload.`;
      return analysis;
    },
    {
      name: "analyze_workouts",
      description: "Analyzes the athlete's completed workouts over a specific number of days to extract volume, load (TSS/TRIMP), and activity distribution. Use this to act as a Sports Scientist.",
      schema: z5.object({
        days: z5.number().min(7).max(90).optional().describe("Number of days to look back (default 30)")
      })
    }
  );
}

// src/services/ai/tools/generate-workout-plan.ts
import { tool as tool4 } from "@langchain/core/tools";
import { AzureChatOpenAI } from "@langchain/openai";
import { z as z6 } from "zod";
var log4 = createLogger({ module: "tool-generate-workout-plan" });
var generatePlanInputSchema = z6.object({
  goal: z6.string().describe('Primary goal, e.g. "finish a half marathon in under 2 hours"'),
  durationWeeks: z6.number().int().min(1).max(52).default(8).describe("Plan duration in weeks"),
  weeklyAvailability: z6.number().int().min(1).max(14).default(5).describe("Number of training sessions per week"),
  focusActivities: z6.array(z6.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"])).default(["RUN", "STRENGTH"]).describe("Activities to include in the plan"),
  eventDate: z6.string().optional().describe("Target event date (ISO 8601) if training for a specific event"),
  additionalContext: z6.string().optional().describe("Any extra context: injuries, preferences, equipment available")
});
var sessionOutputSchema = z6.object({
  dayOffset: z6.number().int().min(0).describe("Day offset from week start (0=Monday)"),
  activityType: z6.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"]),
  title: z6.string().describe("Concise session title"),
  description: z6.string().describe("Detailed instructions for the athlete"),
  durationMin: z6.number().int().min(5),
  intensity: z6.enum(["RECOVERY", "EASY", "MODERATE", "HARD", "MAX"]),
  targetRpe: z6.number().int().min(1).max(10).optional(),
  distanceKm: z6.number().optional()
});
var weekOutputSchema = z6.object({
  weekNumber: z6.number().int().min(1),
  theme: z6.string().describe("Week theme/focus"),
  sessions: z6.array(sessionOutputSchema).min(1)
});
var planOutputSchema = z6.object({
  name: z6.string().describe("Plan name"),
  goal: z6.string(),
  weeks: z6.array(weekOutputSchema).min(1)
});
function createGenerateWorkoutPlanTool(client, userId, clubId) {
  return tool4(
    async (input) => {
      try {
        const [profileRes, historyRes, logRes, injuryRes] = await Promise.all([
          client.from("profiles").select("*").eq("id", userId).single(),
          client.from("workouts").select("activity_type, duration_s, distance_m, tss, started_at").eq("athlete_id", userId).order("started_at", { ascending: false }).limit(20),
          client.from("daily_logs").select("*").eq("athlete_id", userId).order("log_date", { ascending: false }).limit(7),
          client.from("injuries").select("body_part, severity, notes").eq("athlete_id", userId).is("resolved_at", null)
        ]);
        const context = {
          profile: profileRes.data,
          recentWorkouts: historyRes.data || [],
          recentLogs: logRes.data || [],
          activeInjuries: injuryRes.data || []
        };
        const llm = new AzureChatOpenAI({
          azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
          azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
          temperature: 0.7
        });
        const structuredLlm = llm.withStructuredOutput(planOutputSchema, {
          name: "training_plan"
        });
        const systemMessage = `You are an expert sports coach and exercise scientist. Generate a structured training plan based on:

ATHLETE CONTEXT:
${JSON.stringify(context, null, 2)}

PLAN REQUIREMENTS:
- Goal: ${input.goal}
- Duration: ${input.durationWeeks} weeks
- Sessions/week: ${input.weeklyAvailability}
- Activities: ${input.focusActivities.join(", ")}
${input.eventDate ? `- Event date: ${input.eventDate}` : ""}
${input.additionalContext ? `- Notes: ${input.additionalContext}` : ""}
${context.activeInjuries.length > 0 ? `
\u26A0\uFE0F ACTIVE INJURIES: ${JSON.stringify(context.activeInjuries)} \u2014 adjust plan to avoid aggravating these.` : ""}

GUIDELINES:
- Follow periodization principles (base \u2192 build \u2192 peak \u2192 taper if racing)
- Include recovery days and deload weeks
- Progress gradually (max 10% weekly volume increase)
- Vary intensity across the week (hard/easy pattern)
- For STRENGTH sessions, focus on compound movements
- Set realistic RPE targets for each session
- Day offsets: 0=Monday through 6=Sunday`;
        const plan = await structuredLlm.invoke(systemMessage);
        const startDate = /* @__PURE__ */ new Date();
        const dayOfWeek = startDate.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
        startDate.setDate(startDate.getDate() + daysUntilMonday);
        const { data: planRow, error: planError } = await client.from("training_plans").insert({
          athlete_id: userId,
          club_id: clubId,
          name: plan.name,
          status: "active",
          plan_data: {
            goal: plan.goal,
            durationWeeks: input.durationWeeks,
            weeklyAvailability: input.weeklyAvailability,
            focusActivities: input.focusActivities,
            eventDate: input.eventDate || null,
            generatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        }).select("id").single();
        if (planError) throw new Error(`Failed to create plan: ${planError.message}`);
        const plannedWorkouts = plan.weeks.flatMap(
          (week) => week.sessions.map((session) => {
            const sessionDate = new Date(startDate);
            sessionDate.setDate(
              sessionDate.getDate() + (week.weekNumber - 1) * 7 + session.dayOffset
            );
            return {
              athlete_id: userId,
              club_id: clubId,
              plan_id: planRow.id,
              planned_date: sessionDate.toISOString().split("T")[0],
              activity_type: session.activityType,
              title: session.title,
              description: session.description,
              duration_min: session.durationMin,
              distance_km: session.distanceKm || null,
              target_rpe: session.targetRpe || null,
              intensity: session.intensity,
              status: "planned",
              source: "AI",
              coach_notes: `Week ${week.weekNumber}: ${week.theme}`
            };
          })
        );
        const { error: insertError } = await client.from("planned_workouts").insert(plannedWorkouts);
        if (insertError) throw new Error(`Failed to insert workouts: ${insertError.message}`);
        const totalSessions = plannedWorkouts.length;
        const weekSummaries = plan.weeks.map(
          (w) => `  Week ${w.weekNumber} (${w.theme}): ${w.sessions.length} sessions`
        );
        return `\u2705 Created "${plan.name}" \u2014 ${input.durationWeeks}-week plan with ${totalSessions} sessions.

Goal: ${plan.goal}
Starts: ${startDate.toISOString().split("T")[0]} (coming Monday)

${weekSummaries.join("\n")}

The plan is now visible in your training calendar. You can ask me to adjust any session or week.`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        log4.error({ err: msg }, "Failed to generate workout plan");
        return `\u274C Failed to generate plan: ${msg}`;
      }
    },
    {
      name: "generate_workout_plan",
      description: `Generates a structured multi-week training plan personalized to the athlete's goals, fitness level, and readiness. Creates the plan and all scheduled sessions. Use when the athlete asks for a training plan, wants to prepare for an event, or needs a structured program.`,
      schema: generatePlanInputSchema
    }
  );
}

// src/services/ai/tools/get-athlete-profile.ts
import { tool as tool5 } from "@langchain/core/tools";
import { z as z7 } from "zod";
function createGetAthleteProfileTool(client, userId) {
  return tool5(
    async () => {
      const [profile, injuries] = await Promise.all([
        getProfile(client, userId),
        getInjuries(client, userId, true)
      ]);
      if (!profile) return "No athlete profile found. The user may need to complete onboarding.";
      return JSON.stringify({
        name: profile.display_name,
        timezone: profile.timezone,
        role: profile.role,
        preferences: profile.preferences,
        activeInjuries: injuries.map((i) => ({
          bodyPart: i.body_part,
          severity: i.severity,
          since: i.reported_at,
          notes: i.notes
        }))
      });
    },
    {
      name: "get_athlete_profile",
      description: "Fetches the athlete profile including preferences and active injuries. Use at the start of a conversation or when asked about the athlete.",
      schema: z7.object({})
    }
  );
}

// src/services/ai/tools/get-health-metrics.ts
import { tool as tool6 } from "@langchain/core/tools";
import { z as z8 } from "zod";
function createGetHealthMetricsTool(client, userId) {
  return tool6(
    async ({ days, metricType }) => {
      try {
        const lookbackDays = days ?? 7;
        const fromDate = new Date(Date.now() - lookbackDays * 864e5).toISOString().split("T")[0];
        const [dailyLogs, healthMetrics] = await Promise.all([
          getDailyLogs(client, userId, { fromDate, limit: lookbackDays }),
          getHealthMetrics(client, userId, {
            fromDate,
            metricType
          })
        ]);
        return JSON.stringify({
          dailyLogs: dailyLogs.map((d) => ({
            date: d.log_date,
            sleepHours: d.sleep_hours,
            sleepQuality: d.sleep_quality,
            rpe: d.rpe,
            mood: d.mood,
            hrv: d.hrv,
            restingHr: d.resting_hr,
            weightKg: d.weight_kg,
            notes: d.notes
          })),
          healthMetrics: healthMetrics.map((m) => ({
            type: m.metric_type,
            value: m.value,
            unit: m.unit,
            recordedAt: m.recorded_at,
            source: m.source
          }))
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error fetching health metrics: ${msg}. Please check parameters and try again.`;
      }
    },
    {
      name: "get_health_metrics",
      description: "Fetches daily wellness logs (sleep, HRV, mood, RPE) and health metrics. Use to assess recovery, readiness, and trends.",
      schema: z8.object({
        days: z8.number().optional().describe("Number of days to look back (default 7)"),
        metricType: z8.string().optional().describe("Filter health metrics by type (e.g., VO2_MAX, BODY_FAT)")
      })
    }
  );
}

// src/services/ai/tools/get-progress-report.ts
import { tool as tool7 } from "@langchain/core/tools";
import { z as z9 } from "zod";
function createGetProgressReportTool(client, userId) {
  return tool7(
    async ({ days }) => {
      const lookbackDays = days ?? 14;
      const fromDate = new Date(Date.now() - lookbackDays * 864e5).toISOString().split("T")[0];
      const [workouts, dailyLogs] = await Promise.all([
        getWorkouts(client, userId, { fromDate, limit: 200 }),
        getDailyLogs(client, userId, { fromDate, limit: 200 })
      ]);
      const byActivity = {};
      for (const w of workouts) {
        const key = w.activity_type;
        if (!byActivity[key]) byActivity[key] = { count: 0, totalMin: 0, totalKm: 0 };
        byActivity[key].count++;
        byActivity[key].totalMin += w.duration_s ? Math.round(w.duration_s / 60) : 0;
        byActivity[key].totalKm += w.distance_m ? +(w.distance_m / 1e3).toFixed(2) : 0;
      }
      const sleepValues = dailyLogs.map((d) => d.sleep_hours).filter((v) => v != null);
      const hrvValues = dailyLogs.map((d) => d.hrv).filter((v) => v != null);
      const moodValues = dailyLogs.map((d) => d.mood).filter((v) => v != null);
      const rpeValues = dailyLogs.map((d) => d.rpe).filter((v) => v != null);
      const avg = (arr) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
      return JSON.stringify({
        period: `Last ${lookbackDays} days`,
        totalWorkouts: workouts.length,
        byActivity,
        healthTrends: {
          avgSleepHours: avg(sleepValues),
          avgHrv: avg(hrvValues),
          avgMood: avg(moodValues),
          avgRpe: avg(rpeValues),
          daysLogged: dailyLogs.length
        }
      });
    },
    {
      name: "get_progress_report",
      description: 'Generates a progress report with workout summaries and health trends. Use for weekly reviews, trend analysis, or when the athlete asks "how am I doing?"',
      schema: z9.object({
        days: z9.number().optional().describe("Number of days to analyze (default 14)")
      })
    }
  );
}

// src/services/ai/tools/get-squad-leaderboard.ts
import { tool as tool8 } from "@langchain/core/tools";
import { z as z10 } from "zod";
function createGetSquadLeaderboardTool(client, userId) {
  return tool8(
    async ({ timeframeDays }) => {
      try {
        const days = timeframeDays || 7;
        const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1e3).toISOString();
        const { data: squadMemberships, error: squadErr } = await client.from("squad_members").select("squad_id, squads(name)").eq("athlete_id", userId);
        if (squadErr || !squadMemberships || squadMemberships.length === 0) {
          return "User is not currently in any squads.";
        }
        const squadIds = squadMemberships.map((m) => m.squad_id);
        const { data: allMembers, error: memErr } = await client.from("squad_members").select("squad_id, athlete_id, squads(name), profiles(display_name)").in("squad_id", squadIds);
        if (memErr || !allMembers) {
          return "Could not retrieve squad members.";
        }
        const athleteIds = [...new Set(allMembers.map((m) => m.athlete_id))];
        const { data: workouts, error: workErr } = await client.from("workouts").select("athlete_id, duration_s").in("athlete_id", athleteIds).gte("started_at", threshold);
        if (workErr || !workouts) {
          return "Could not retrieve recent workouts for leaderboard.";
        }
        const leaderboard = athleteIds.map((aId) => {
          const athleteWorkouts = workouts.filter((w) => w.athlete_id === aId);
          const totalDurationS = athleteWorkouts.reduce((sum, w) => sum + (w.duration_s || 0), 0);
          const profile = allMembers.find((m) => m.athlete_id === aId)?.profiles;
          const displayName = profile && typeof profile === "object" && "display_name" in profile ? profile.display_name : "Unknown Athlete";
          return {
            athleteId: aId,
            displayName,
            totalWorkouts: athleteWorkouts.length,
            totalDurationMinutes: Math.round(totalDurationS / 60)
          };
        }).sort((a, b) => b.totalDurationMinutes - a.totalDurationMinutes);
        const result = {
          timeframe: `Past ${days} days`,
          squads: [
            ...new Set(
              squadMemberships.map((m) => {
                const squad = m.squads;
                return squad && typeof squad === "object" && "name" in squad ? squad.name : "Unknown Squad";
              })
            )
          ],
          leaderboard: leaderboard.map((l, index) => ({
            rank: index + 1,
            athlete: l.athleteId === userId ? `${l.displayName} (You)` : l.displayName,
            workouts: l.totalWorkouts,
            minutes: l.totalDurationMinutes
          }))
        };
        return JSON.stringify(result, null, 2);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error fetching squad leaderboard: ${msg}. Please try again.`;
      }
    },
    {
      name: "get_squad_leaderboard",
      description: "Gets the workout leaderboard for the athlete's squads, ranking members by accumulated workout minutes over the specified timeframe.",
      schema: z10.object({
        timeframeDays: z10.number().optional().describe("Number of days to look back")
      })
    }
  );
}

// src/services/ai/tools/get-training-plan.ts
import { tool as tool9 } from "@langchain/core/tools";
import { z as z11 } from "zod";
function createGetTrainingPlanTool(client, userId) {
  return tool9(
    async () => {
      try {
        const [plan, events] = await Promise.all([
          getTrainingPlan(client, userId),
          getUpcomingEvents(client, userId, 5)
        ]);
        return JSON.stringify({
          plan: plan ? {
            id: plan.id,
            name: plan.name,
            status: plan.status,
            planData: plan.plan_data
          } : null,
          upcomingEvents: events.map((e) => ({
            id: e.id,
            name: e.name,
            date: e.event_date,
            distanceType: e.distance_type
          }))
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error fetching training plan: ${msg}. Please try again.`;
      }
    },
    {
      name: "get_training_plan",
      description: "Fetches the active training plan and upcoming events. Use when asked about scheduled workouts, race calendar, or training blocks.",
      schema: z11.object({})
    }
  );
}

// src/services/ai/tools/get-workout-history.ts
import { tool as tool10 } from "@langchain/core/tools";
import { z as z12 } from "zod";

// ../../packages/core/src/strength/index.ts
function estimate1RM(weight, reps) {
  if (weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  let estimate;
  if (reps <= 6) {
    const denominator = 1.0278 - 0.0278 * reps;
    if (denominator <= 0) return null;
    estimate = weight / denominator;
  } else if (reps <= 10) {
    estimate = weight * (1 + reps / 30);
  } else {
    estimate = weight * reps ** 0.1;
  }
  return Math.round(estimate * 10) / 10;
}
function computeVolume(sets) {
  return sets.filter((s) => s.set_type !== "warmup").reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
}
function findTopSet(sets) {
  const workingSets = sets.filter((s) => s.set_type !== "warmup");
  if (workingSets.length === 0) return null;
  let best = null;
  let bestE1RM = 0;
  for (const s of workingSets) {
    const e1rm = estimate1RM(s.weight_kg, s.reps);
    if (e1rm !== null && e1rm > bestE1RM) {
      bestE1RM = e1rm;
      best = s;
    }
  }
  return best;
}
function summarizeStrengthWorkout(rawData) {
  if (!rawData || typeof rawData !== "object") return [];
  const data = rawData;
  const exercises = data.exercises;
  if (!Array.isArray(exercises)) return [];
  return exercises.map((ex) => {
    const workingSets = ex.sets.filter((s) => s.set_type !== "warmup");
    const topSet = findTopSet(ex.sets);
    const totalVolume = computeVolume(ex.sets);
    const e1rm = topSet ? estimate1RM(topSet.weight_kg, topSet.reps) : null;
    return {
      name: ex.name,
      workingSets: workingSets.length,
      topSet: topSet ? { weight_kg: topSet.weight_kg, reps: topSet.reps, rpe: topSet.rpe } : null,
      totalVolume_kg: totalVolume,
      estimated1RM_kg: e1rm,
      ...ex.group_id !== void 0 && { group_id: ex.group_id },
      ...ex.group_type && { group_type: ex.group_type }
    };
  });
}
function computeAverageRPE(exercises) {
  const rpeValues = [];
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.set_type !== "warmup" && s.rpe !== void 0) {
        rpeValues.push(s.rpe);
      }
    }
  }
  if (rpeValues.length === 0) return null;
  return Math.round(rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length * 10) / 10;
}
function computeSessionVolume(exercises) {
  return exercises.reduce((sum, ex) => sum + computeVolume(ex.sets), 0);
}

// src/services/ai/tools/get-workout-history.ts
function createGetWorkoutHistoryTool(client, userId) {
  return tool10(
    async ({ activityType, fromDate, toDate, limit }) => {
      try {
        const workouts = await getWorkouts(client, userId, {
          activityType,
          fromDate,
          toDate,
          limit: limit ?? 10
        });
        if (!workouts.length) return "No workouts found for the given filters.";
        return JSON.stringify(
          workouts.map((w) => {
            const base = {
              date: w.started_at,
              activityType: w.activity_type,
              durationMin: w.duration_s ? Math.round(w.duration_s / 60) : null,
              notes: w.notes
            };
            if (w.activity_type === "STRENGTH" && w.raw_data) {
              const exerciseSummaries = summarizeStrengthWorkout(w.raw_data);
              const rawExercises = w.raw_data?.exercises;
              return {
                ...base,
                exercises: exerciseSummaries,
                sessionVolume_kg: rawExercises ? computeSessionVolume(rawExercises) : null,
                avgRPE: rawExercises ? computeAverageRPE(rawExercises) : null
              };
            }
            return {
              ...base,
              distanceKm: w.distance_m ? +(w.distance_m / 1e3).toFixed(2) : null,
              avgHr: w.avg_hr,
              maxHr: w.max_hr,
              avgPower: w.avg_power_w,
              tss: w.tss
            };
          })
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error fetching workout history: ${msg}. Please check parameters and try again.`;
      }
    },
    {
      name: "get_workout_history",
      description: "Retrieves recent workouts for the athlete. For STRENGTH workouts returns exercise details including top sets, volume, and estimated 1RM. Use to compare sessions and track progressive overload.",
      schema: z12.object({
        activityType: z12.string().optional().describe("Filter by activity type: SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER"),
        fromDate: z12.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        toDate: z12.string().optional().describe("End date filter (YYYY-MM-DD)"),
        limit: z12.number().optional().describe("Max workouts to return (default 10, max 50)")
      })
    }
  );
}

// src/services/ai/tools/log-injury.ts
import { tool as tool11 } from "@langchain/core/tools";
import { z as z13 } from "zod";
function createLogInjuryTool(client, userId) {
  return tool11(
    async ({ bodyPart, severity, date, notes }) => {
      try {
        const reportedAt = date ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const injury = await insertInjury(client, {
          athlete_id: userId,
          body_part: bodyPart,
          severity,
          reported_at: reportedAt,
          notes
        });
        return `Injury logged successfully for ${injury.body_part} with severity ${injury.severity}/100. Let the athlete know you've noted it down and remind them to take it easy if the severity is high.`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error logging injury: ${msg}. Please try again.`;
      }
    },
    {
      name: "log_injury",
      description: "Logs a new physical issue, pain, or injury for the athlete. Severity is 1-100 (100 being extreme pain/unable to train). Use when the athlete mentions soreness or pain in a specific body part.",
      schema: z13.object({
        bodyPart: z13.string().describe(
          "The specific muscle or joint affected (e.g., 'Left Knee', 'Lower Back', 'Hamstrings')"
        ),
        severity: z13.number().min(1).max(100).describe("Severity score from 1-100"),
        date: z13.string().optional().describe("Date reported (YYYY-MM-DD), defaults to today"),
        notes: z13.string().optional().describe("Additional context about the injury or pain")
      })
    }
  );
}

// src/services/ai/tools/log-workout.ts
import { tool as tool12 } from "@langchain/core/tools";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { z as z14 } from "zod";
var log5 = createLogger({ module: "tool-log-workout" });
var setSchema = z14.object({
  reps: z14.number().describe("Number of reps performed"),
  weight_kg: z14.number().describe("Weight in kg"),
  rpe: z14.number().min(1).max(10).optional().describe("Rate of Perceived Exertion (1-10). 10 = absolute max effort"),
  rir: z14.number().min(0).max(5).optional().describe("Reps In Reserve (0-5). 0 = failure"),
  tempo: z14.string().optional().describe('Tempo notation e.g. "3-1-2-0" (eccentric-pause-concentric-pause in seconds)'),
  set_type: z14.enum(["working", "warmup", "dropset", "backoff", "amrap", "cluster"]).optional().default("working").describe('Type of this set. Default is "working"')
});
var exerciseSchema = z14.object({
  name: z14.string().describe('Exercise name e.g. "Barbell Back Squat", "Dumbbell Bench Press"'),
  sets: z14.array(setSchema).describe("Array of sets performed for this exercise"),
  group_id: z14.number().optional().describe(
    "Group number for supersets/circuits. Exercises with the same group_id are grouped together"
  ),
  group_type: z14.enum(["superset", "circuit", "giant_set"]).optional().describe("Type of exercise grouping, if this exercise is part of a group"),
  notes: z14.string().optional().describe('Exercise-specific notes e.g. "felt tight in left shoulder"')
});
var workoutLogSchema = z14.object({
  activityType: z14.string().describe("Activity type: SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER"),
  startedAt: z14.string().optional().describe("Start date/time in ISO 8601 (defaults to now)"),
  durationMin: z14.number().optional().describe("Total workout duration in minutes"),
  distanceKm: z14.number().optional().describe("Distance in kilometers (for cardio workouts)"),
  avgHr: z14.number().optional().describe("Average heart rate"),
  tss: z14.number().optional().describe("Training Stress Score"),
  notes: z14.string().optional().describe("General workout notes"),
  exercises: z14.array(exerciseSchema).optional().describe(
    "Structured exercise data for STRENGTH workouts. Include exercises with their sets, reps, and weights."
  )
});
function createLogWorkoutTool(client, userId, clubId) {
  return tool12(
    async (input) => {
      try {
        const startedAt = input.startedAt ?? (/* @__PURE__ */ new Date()).toISOString();
        const rawData = input.exercises && input.exercises.length > 0 ? {
          exercises: input.exercises,
          metadata: { source: "COACH", schema_version: 2 }
        } : null;
        let embedding;
        if (input.notes || rawData?.exercises) {
          try {
            const textToEmbed = `Activity: ${input.activityType}. Notes: ${input.notes ?? "None"}. Ex: ${rawData?.exercises ? JSON.stringify(rawData.exercises) : "None"}`;
            const embeddingsModel = new AzureOpenAIEmbeddings({
              azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
              azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", ""),
              azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
              azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion
            });
            embedding = await embeddingsModel.embedQuery(textToEmbed);
          } catch (err) {
            log5.error({ err }, "Failed to generate embedding for workout");
          }
        }
        const workout = await insertWorkout(client, {
          athlete_id: userId,
          club_id: clubId,
          activity_type: input.activityType,
          source: "MANUAL",
          started_at: startedAt,
          duration_s: input.durationMin ? input.durationMin * 60 : null,
          distance_m: input.distanceKm ? input.distanceKm * 1e3 : null,
          avg_hr: input.avgHr ?? null,
          max_hr: null,
          avg_pace_s_km: null,
          avg_power_w: null,
          calories: null,
          tss: input.tss ?? null,
          raw_data: rawData,
          notes: input.notes ?? null,
          embedding
        });
        if (rawData?.exercises) {
          const exerciseLines = rawData.exercises.map((ex) => {
            const workingSets = ex.sets.filter((s) => s.set_type !== "warmup");
            const totalVol = workingSets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
            return `  - ${ex.name}: ${workingSets.length} working sets, ${totalVol} kg total volume`;
          });
          return `Workout logged successfully (ID: ${workout.id}).
Activity: ${workout.activity_type}, Date: ${workout.started_at}

Exercises logged:
${exerciseLines.join("\n")}

Now retrieve workout history to compare this session against recent ones.`;
        }
        return `Workout logged successfully (ID: ${workout.id}). Activity: ${workout.activity_type}, Date: ${workout.started_at}`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error logging workout: ${msg}. Please double check the input and try again.`;
      }
    },
    {
      name: "log_workout",
      description: "Logs a new workout for the athlete. For STRENGTH workouts, include structured exercise data (exercises with sets, reps, weight, RPE). Always confirm details with the athlete before calling this tool.",
      schema: workoutLogSchema
    }
  );
}

// src/services/ai/tools/match-documents.ts
import { tool as tool13 } from "@langchain/core/tools";
import { AzureOpenAIEmbeddings as AzureOpenAIEmbeddings2 } from "@langchain/openai";
import { z as z15 } from "zod";
function createMatchDocumentsTool(client, clubId) {
  return tool13(
    async ({ query, threshold = 0.7, limit = 5 }) => {
      try {
        const embeddings = new AzureOpenAIEmbeddings2({
          azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
          azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", ""),
          azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
          azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion
        });
        const query_embedding = await embeddings.embedQuery(query);
        const { data, error } = await client.rpc("match_documents", {
          query_embedding,
          match_threshold: threshold,
          match_count: limit,
          filter_club_id: clubId
        });
        if (error) {
          return `Error searching documents: ${error.message}`;
        }
        if (!data || data.length === 0) {
          return "No highly relevant documents found for that query.";
        }
        return JSON.stringify(
          data.map((d) => ({
            title: d.title,
            content: d.content,
            similarity: d.similarity
          }))
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error searching documents: ${msg}. Please try again.`;
      }
    },
    {
      name: "match_documents",
      description: "Performs semantic search to find knowledge base documents (e.g. PDFs, articles) uploaded by the club. Useful for answering general fitness, nutrition, or club-specific policy questions.",
      schema: z15.object({
        query: z15.string().describe("The search query or question"),
        threshold: z15.number().optional().describe("Minimum similarity threshold (0-1). Default 0.7"),
        limit: z15.number().optional().describe("Maximum number of documents to return. Default 5")
      })
    }
  );
}

// src/services/ai/tools/modify-training-plan.ts
import { tool as tool14 } from "@langchain/core/tools";
import { z as z16 } from "zod";
function createModifyTrainingPlanTool(client, userId) {
  return tool14(
    async (input) => {
      const { planData, status } = input;
      const currentPlan = await getTrainingPlan(client, userId);
      if (!currentPlan) return "No active training plan found. Cannot modify.";
      const updates = {};
      if (planData !== void 0) updates.plan_data = planData;
      if (status !== void 0) updates.status = status;
      if (Object.keys(updates).length === 0) return "No changes specified.";
      const updated = await updateTrainingPlan(client, currentPlan.id, updates);
      return `Training plan "${updated.name}" updated successfully. Status: ${updated.status}`;
    },
    {
      name: "modify_training_plan",
      description: "Modifies the active training plan. Can update plan data (sessions, schedule) or status. Always confirm changes with the athlete first.",
      schema: z16.object({
        planData: z16.record(z16.string(), z16.unknown()).optional().describe("Updated plan data object (sessions, schedule, notes)"),
        status: z16.string().optional().describe("New plan status: ACTIVE, PAUSED, COMPLETED, CANCELLED")
      })
    }
  );
}

// src/services/ai/tools/pass-baton.ts
import { tool as tool15 } from "@langchain/core/tools";
import { z as z17 } from "zod";
function createPassBatonTool(client, userId) {
  return tool15(
    async ({ toAthleteId, distanceMeters, notes }) => {
      const { data: squadMemberships, error: squadErr } = await client.from("squad_members").select("squad_id").eq("athlete_id", userId);
      if (squadErr || !squadMemberships || squadMemberships.length === 0) {
        return "User is not currently in any squads.";
      }
      const squadIds = squadMemberships.map((m) => m.squad_id);
      const { data: activeRelays, error: relayErr } = await client.from("relay_events").select("*").in("squad_id", squadIds).eq("status", "active").limit(1);
      if (relayErr || !activeRelays || activeRelays.length === 0) {
        return "No active relay events found for the user's squads.";
      }
      const relay = activeRelays[0];
      const { error: insertErr } = await client.from("baton_passes").insert({
        relay_id: relay.id,
        from_athlete_id: userId,
        to_athlete_id: toAthleteId,
        distance_m: distanceMeters,
        passed_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (insertErr) {
        return `Failed to pass the baton: ${insertErr.message}`;
      }
      const newTotal = (relay.total_distance_m || 0) + distanceMeters;
      const isCompleted = newTotal >= relay.goal_distance_m;
      const updatePayload = {
        total_distance_m: newTotal
      };
      if (isCompleted) {
        updatePayload.status = "completed";
        updatePayload.ended_at = (/* @__PURE__ */ new Date()).toISOString();
      }
      const { error: updateErr } = await client.from("relay_events").update(updatePayload).eq("id", relay.id);
      if (updateErr) {
        return `Baton passed, but failed to update relay total distance: ${updateErr.message}`;
      }
      return JSON.stringify({
        success: true,
        message: `Successfully passed the baton to athlete ${toAthleteId} for ${distanceMeters}m!`,
        relayEvent: {
          id: relay.id,
          totalDistanceM: newTotal,
          goalDistanceM: relay.goal_distance_m,
          status: isCompleted ? "completed" : "active"
        },
        notes: notes || null
      });
    },
    {
      name: "pass_baton",
      description: "Pass the baton in an active squad relay event. This creates a baton pass record to another squad member and adds distance to the relay total.",
      schema: z17.object({
        toAthleteId: z17.string().describe(
          "The ID of the squad member to pass the baton to. You can get this ID from the get_squad_leaderboard tool."
        ),
        distanceMeters: z17.number().describe("The distance in meters contributed to the relay leg by this pass."),
        notes: z17.string().optional().describe("Optional message or cheer to send to the next athlete.")
      })
    }
  );
}

// src/services/ai/tools/predict-injury-risk.ts
import { tool as tool16 } from "@langchain/core/tools";
import { z as z18 } from "zod";
function createPredictInjuryRiskTool(client, userId) {
  return tool16(
    async () => {
      const today = /* @__PURE__ */ new Date();
      const fourWeeksAgo = /* @__PURE__ */ new Date();
      fourWeeksAgo.setDate(today.getDate() - 28);
      const workouts = await getWorkouts(client, userId, {
        fromDate: fourWeeksAgo.toISOString().split("T")[0],
        toDate: today.toISOString().split("T")[0]
      });
      if (workouts.length === 0) {
        return "Not enough workout data in the last 28 days to calculate injury risk.";
      }
      const dailyLoads = {};
      workouts.forEach((w) => {
        const dateKey = w.started_at.split("T")[0];
        let sessionLoad = 0;
        if (w.tss != null) {
          sessionLoad = w.tss;
        } else if (w.duration_s != null && w.avg_hr != null) {
          sessionLoad = w.duration_s / 60 * (w.avg_hr / 150) * 1.5;
        } else if (w.duration_s != null) {
          sessionLoad = w.duration_s / 60 * 1;
        }
        dailyLoads[dateKey] = (dailyLoads[dateKey] || 0) + sessionLoad;
      });
      let acuteLoad = 0;
      let chronicLoad = 0;
      const sevenDaysAgo = /* @__PURE__ */ new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];
      for (const [date, load] of Object.entries(dailyLoads)) {
        chronicLoad += load;
        if (date >= sevenDaysStr) {
          acuteLoad += load;
        }
      }
      const avgAcute = acuteLoad / 7;
      const avgChronic = chronicLoad / 28;
      if (avgChronic === 0) {
        return "Chronic training load is zero. Cannot calculate ACWR. Athlete is likely undertrained or returning from a long break.";
      }
      const acwr = avgAcute / avgChronic;
      let riskAssessment = "";
      let recommendations = "";
      if (acwr < 0.8) {
        riskAssessment = "LOW (Undertraining)";
        recommendations = "Athlete is losing fitness. Safe to increase training volume and intensity.";
      } else if (acwr >= 0.8 && acwr <= 1.3) {
        riskAssessment = "OPTIMAL (Sweet Spot)";
        recommendations = "Excellent training progression. Injury risk is minimized. Maintain current progressive overload.";
      } else if (acwr > 1.3 && acwr <= 1.5) {
        riskAssessment = "CAUTION (Zone of Danger)";
        recommendations = "Training load is ramping up quickly. Monitor biometrics closely. Consider a recovery day.";
      } else {
        riskAssessment = "HIGH (Danger Zone)";
        recommendations = "Acute load is significantly higher than chronic load. Athlete is at HIGH RISK of injury or illness. Immediately reduce volume or intensity.";
      }
      const report = `**Injury Risk Forecast (ACWR Model)**
            
- **Acute Load (7-day avg):** ${Math.round(avgAcute)} / day
- **Chronic Load (28-day avg):** ${Math.round(avgChronic)} / day
- **Acute:Chronic Workload Ratio (ACWR):** ${acwr.toFixed(2)}

**Risk Assessment:** ${riskAssessment}
**Recommendation:** ${recommendations}

*Coaching Instruction:* Explain this ratio simply to the athlete. If they are in the danger zone, proactively suggest modifying their upcoming workouts to be lighter.`;
      return report;
    },
    {
      name: "predict_injury_risk",
      description: "Forecasts the athlete's injury risk by calculating the Acute:Chronic Workload Ratio (ACWR) over the last 28 days. Use this when the athlete asks if they are overtraining, or if you want to verify a training plan is safe.",
      schema: z18.object({})
      // No required parameters
    }
  );
}

// src/services/ai/tools/save-memory.ts
import { tool as tool17 } from "@langchain/core/tools";
import { AzureOpenAIEmbeddings as AzureOpenAIEmbeddings3 } from "@langchain/openai";
import { z as z19 } from "zod";
var log6 = createLogger({ module: "tool-save-memory" });
function createSaveMemoryTool(client, userId) {
  return tool17(
    async ({ category, content, importance = 3 }) => {
      try {
        let embedding;
        try {
          const embeddingsModel = new AzureOpenAIEmbeddings3({
            azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
            azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", ""),
            azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
            azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion
          });
          embedding = await embeddingsModel.embedQuery(content);
        } catch (err) {
          log6.error({ err }, "Failed to generate embedding for athlete memory");
        }
        const memory = await insertMemory(client, {
          athlete_id: userId,
          category,
          content,
          importance,
          embedding
        });
        return `Memory saved successfully (ID: ${memory.id}). The agent will now remember this fact in future conversations.`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error saving memory: ${msg}. Please try again.`;
      }
    },
    {
      name: "save_memory",
      description: 'Saves a long-term memory about the athlete. Use this proactively when the athlete mentions a preference, a continuous goal, a constraint (e.g., "I hate mornings", "I am training for an Ironman", "My knee always hurts on long runs").',
      schema: z19.object({
        category: z19.enum(["preference", "goal", "constraint", "pattern", "medical_note", "other"]).describe("The category of the memory"),
        content: z19.string().describe('The standalone fact to remember (e.g. "Athlete prefers evening workouts")'),
        importance: z19.number().min(1).max(5).optional().describe("Importance of the memory from 1 (trivial) to 5 (critical)")
      })
    }
  );
}

// src/services/ai/tools/schedule-workout.ts
import { tool as tool18 } from "@langchain/core/tools";
import { z as z20 } from "zod";
var log7 = createLogger({ module: "tool-schedule-workout" });
var scheduleWorkoutSchema = z20.object({
  plannedDate: z20.string().describe("ISO date (YYYY-MM-DD) for the workout"),
  plannedTime: z20.string().optional().describe("Optional start time (HH:MM)"),
  activityType: z20.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"]).describe("Type of workout"),
  title: z20.string().describe('Short title, e.g. "Easy Zone 2 Run"'),
  description: z20.string().optional().describe("Detailed session instructions"),
  durationMin: z20.number().int().min(5).optional().describe("Duration in minutes"),
  distanceKm: z20.number().optional().describe("Target distance in km"),
  intensity: z20.enum(["RECOVERY", "EASY", "MODERATE", "HARD", "MAX"]).optional().describe("Target intensity level"),
  targetRpe: z20.number().int().min(1).max(10).optional().describe("Target RPE (1-10)"),
  notes: z20.string().optional().describe("Any additional notes")
});
function createScheduleWorkoutTool(client, userId, clubId) {
  return tool18(
    async (input) => {
      try {
        const { data: activePlan } = await client.from("training_plans").select("id").eq("athlete_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
        log7.debug({ activePlanId: activePlan?.id ?? null, userId, clubId }, "Scheduling workout");
        const { data, error } = await client.from("planned_workouts").insert({
          athlete_id: userId,
          club_id: clubId,
          plan_id: activePlan?.id || null,
          planned_date: input.plannedDate,
          planned_time: input.plannedTime || null,
          activity_type: input.activityType,
          title: input.title,
          description: input.description || null,
          duration_min: input.durationMin || null,
          distance_km: input.distanceKm || null,
          intensity: input.intensity || null,
          target_rpe: input.targetRpe || null,
          notes: input.notes || null,
          status: "planned",
          source: "AI"
        }).select().single();
        log7.debug({ workoutId: data?.id, error }, "Insert result");
        if (error) throw new Error(error.message);
        const emoji = {
          SWIM: "\u{1F3CA}",
          BIKE: "\u{1F6B4}",
          RUN: "\u{1F3C3}",
          STRENGTH: "\u{1F3CB}\uFE0F",
          YOGA: "\u{1F9D8}",
          OTHER: "\u26A1"
        }[input.activityType];
        return `${emoji} Scheduled "${input.title}" on ${input.plannedDate}${input.plannedTime ? ` at ${input.plannedTime}` : ""}${input.durationMin ? ` (${input.durationMin} min)` : ""}${input.intensity ? ` \u2014 ${input.intensity}` : ""}. Check your training calendar!`;
      } catch (error) {
        log7.error({ err: error }, "Failed to schedule workout");
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `\u274C Failed to schedule workout: ${msg}`;
      }
    },
    {
      name: "schedule_workout",
      description: 'Schedules a single workout session on a specific date. Use for quick requests like "add a run tomorrow" or "schedule strength on Friday". For full multi-week plans, use generate_workout_plan instead.',
      schema: scheduleWorkoutSchema
    }
  );
}

// src/services/ai/tools/search-workouts.ts
import { tool as tool19 } from "@langchain/core/tools";
import { AzureOpenAIEmbeddings as AzureOpenAIEmbeddings4 } from "@langchain/openai";
import { z as z21 } from "zod";
function createSearchWorkoutsTool(client, userId) {
  return tool19(
    async ({ query, threshold = 0.6, limit = 5 }) => {
      try {
        const embeddings = new AzureOpenAIEmbeddings4({
          azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
          azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", ""),
          azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
          azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion
        });
        const query_embedding = await embeddings.embedQuery(query);
        const { data, error } = await client.rpc("match_workouts", {
          p_athlete_id: userId,
          query_embedding,
          match_threshold: threshold,
          match_count: limit
        });
        if (error) {
          return `Error searching workouts: ${error.message}`;
        }
        if (!data || data.length === 0) {
          return "No matching workouts found for that query.";
        }
        return JSON.stringify(
          data.map((w) => ({
            id: w.id,
            activityType: w.activity_type,
            date: w.started_at,
            distanceMeters: w.distance_m,
            durationSeconds: w.duration_s,
            notes: w.notes,
            similarity: w.similarity
          }))
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error searching workouts: ${msg}. Please try again.`;
      }
    },
    {
      name: "search_workouts",
      description: `Performs a natural language semantic search over the athlete's past workouts based on their notes. Use this when the user asks vague questions like "find the run where it was raining" or "when did I last do 400m repeats?".`,
      schema: z21.object({
        query: z21.string().describe('The natural language search query (e.g. "rainy run", "felt great")'),
        threshold: z21.number().optional().describe("Minimum similarity threshold (0-1). Default 0.6"),
        limit: z21.number().optional().describe("Maximum number of workouts to return. Default 5")
      })
    }
  );
}

// src/services/ai/tools/traverse-graph.ts
import { tool as tool20 } from "@langchain/core/tools";
import { z as z22 } from "zod";
function createTraverseGraphTool(client, userId) {
  return tool20(
    async ({ maxDepth = 2, edgeTypes }) => {
      try {
        const { data, error } = await client.rpc("traverse_athlete_graph", {
          start_node_id: userId,
          max_depth: maxDepth,
          edge_types: edgeTypes ?? null
        });
        if (error) {
          return `Error traversing memory graph: ${error.message}`;
        }
        if (!data || data.length === 0) {
          return "No relationships found in the athlete graph.";
        }
        return JSON.stringify(
          data.map((d) => ({
            id: d.node_id,
            label: d.node_label,
            type: d.node_type,
            path: d.path_names.join(" -> "),
            depth: d.depth
          }))
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error traversing memory graph: ${msg}. Please try again.`;
      }
    },
    {
      name: "traverse_athlete_graph",
      description: "Traverses the knowledge graph to find relationships for the athlete, such as their coach, teammates, preferred gear (bikes, shoes), and historic achievements.",
      schema: z22.object({
        maxDepth: z22.number().optional().describe("How many hops to traverse (default 2)"),
        edgeTypes: z22.array(z22.string()).optional().describe('Optional array of edge labels to follow (e.g. ["uses_gear", "coached_by"])')
      })
    }
  );
}

// src/services/ai/tools/update-soreness.ts
import { tool as tool21 } from "@langchain/core/tools";
import { z as z23 } from "zod";
function createUpdateSorenessTool(client, userId, clubId) {
  return tool21(
    async (input) => {
      try {
        const { date, rpe, mood, sleepHours, sleepQuality, hrv, restingHr, weightKg, notes } = input;
        const logDate = date ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const log23 = await upsertDailyLog(client, {
          athlete_id: userId,
          club_id: clubId,
          log_date: logDate,
          rpe: rpe ?? null,
          mood: mood ?? null,
          sleep_hours: sleepHours ?? null,
          sleep_quality: sleepQuality ?? null,
          hrv: hrv ?? null,
          resting_hr: restingHr ?? null,
          weight_kg: weightKg ?? null,
          notes: notes ?? null
        });
        return `Daily log updated for ${log23.log_date}. Fields set: ${Object.entries({
          rpe,
          mood,
          sleepHours,
          sleepQuality,
          hrv,
          restingHr,
          weightKg
        }).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`).join(", ") || "notes only"}`;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return `Error updating daily log: ${msg}. Please try again.`;
      }
    },
    {
      name: "update_daily_log",
      description: "Updates or creates a daily wellness log entry. Use when the athlete reports sleep, mood, RPE, HRV, weight, or other daily metrics. Always confirm values before calling.",
      schema: z23.object({
        date: z23.string().optional().describe("Log date (YYYY-MM-DD), defaults to today"),
        rpe: z23.number().optional().describe("Rate of Perceived Exertion (1-10)"),
        mood: z23.number().optional().describe("Mood rating (1-5)"),
        sleepHours: z23.number().optional().describe("Hours of sleep"),
        sleepQuality: z23.number().optional().describe("Sleep quality (1-5)"),
        hrv: z23.number().optional().describe("Heart rate variability"),
        restingHr: z23.number().optional().describe("Resting heart rate"),
        weightKg: z23.number().optional().describe("Body weight in kg"),
        notes: z23.string().optional().describe("Additional notes")
      })
    }
  );
}

// src/services/ai/tools/index.ts
function createAllTools(client, userId, clubId) {
  return [
    // Read tools
    createGetAthleteProfileTool(client, userId),
    createGetWorkoutHistoryTool(client, userId),
    createGetHealthMetricsTool(client, userId),
    createGetTrainingPlanTool(client, userId),
    createGetProgressReportTool(client, userId),
    // Gamification tools
    createGetSquadLeaderboardTool(client, userId),
    createPassBatonTool(client, userId),
    // Write tools (require user confirmation via prompt)
    createLogWorkoutTool(client, userId, clubId),
    createUpdateSorenessTool(client, userId, clubId),
    createLogInjuryTool(client, userId),
    createModifyTrainingPlanTool(client, userId),
    // Training plan & scheduling tools
    createGenerateWorkoutPlanTool(client, userId, clubId),
    createScheduleWorkoutTool(client, userId, clubId),
    // GraphRAG & Knowledge Graph tools
    createMatchDocumentsTool(client, clubId),
    createTraverseGraphTool(client, userId),
    createSearchWorkoutsTool(client, userId),
    createSaveMemoryTool(client, userId),
    createAnalyzeBiometricTrendsTool(client, userId),
    createAnalyzeWorkoutsTool(client, userId),
    createPredictInjuryRiskTool(client, userId),
    analyzeForm
  ];
}

// src/services/ai/graph.ts
var log8 = createLogger({ module: "langgraph-agent" });
async function createAgent(client, userId, clubId, userMessage) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const [profile, pinnedMemories, dailyLogs] = await Promise.all([
    getProfile(client, userId),
    getRecentMemories(client, userId, 5),
    // Top-5 most important pinned memories
    getDailyLogs(client, userId, {
      fromDate: today,
      toDate: today,
      limit: 1
    })
  ]);
  const todayLog = dailyLogs.length > 0 ? dailyLogs[0] : null;
  const allMemories = [...pinnedMemories];
  if (userMessage) {
    try {
      const { AzureOpenAIEmbeddings: AzureOpenAIEmbeddings6 } = await import("@langchain/openai");
      const embeddingsModel = new AzureOpenAIEmbeddings6({
        azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
        azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", ""),
        azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
        azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion
      });
      const queryEmbedding = await embeddingsModel.embedQuery(userMessage);
      const semanticResults = await searchMemoriesBySimilarity(client, userId, queryEmbedding, {
        matchThreshold: 0.4,
        matchCount: 8
      });
      const pinnedContents = new Set(pinnedMemories.map((m) => m.content));
      for (const result of semanticResults) {
        if (!pinnedContents.has(result.content)) {
          allMemories.push({
            id: result.id,
            athlete_id: userId,
            category: result.category,
            content: result.content,
            importance: result.importance,
            created_at: "",
            updated_at: ""
          });
        }
      }
    } catch (err) {
      log8.warn({ err }, "Semantic memory recall failed (non-fatal)");
    }
  }
  const llm = new AzureChatOpenAI2({
    azureOpenAIEndpoint: AI_CONFIG.azure.endpoint,
    azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
    azureOpenAIApiDeploymentName: AI_CONFIG.azure.deploymentName,
    azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
    temperature: AI_CONFIG.model.temperature,
    streaming: AI_CONFIG.features.streaming,
    // gpt-5-mini requires max_completion_tokens instead of max_tokens
    modelKwargs: { max_completion_tokens: AI_CONFIG.model.maxCompletionTokens }
  });
  const tools = createAllTools(client, userId, clubId);
  const llmWithTools = llm.bindTools(tools);
  const systemMessage = new SystemMessage(buildSystemPrompt(profile, todayLog, allMemories));
  async function llmCall(state) {
    const messagesWithSystem = [systemMessage, ...state.messages];
    const response = await llmWithTools.invoke(messagesWithSystem);
    return { messages: [response] };
  }
  async function reflectNode(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage || lastMessage._getType() !== "ai" || !lastMessage.content) {
      return { messages: [] };
    }
    const reflectionPrompt = new SystemMessage(
      `You are a Head Coach reviewing an AI assistant's drafted response to an athlete.
Evaluate the draft below for tone, safety, accuracy, and conciseness.
Does it directly answer the user's question without rambling?
If the draft is good, reply with exactly "ACCEPT".
If the draft needs changes, provide a brief, actionable critique for the assistant to revise it.
Do NOT rewrite the response yourself, just provide the critique.`
    );
    const response = await llm.invoke([
      reflectionPrompt,
      new HumanMessage(`Draft response:
${lastMessage.content}`)
    ]);
    const critique = typeof response.content === "string" ? response.content.trim() : "";
    if (critique.toUpperCase() === "ACCEPT" || critique.includes("ACCEPT")) {
      return { messages: [] };
    }
    return {
      messages: [
        new HumanMessage(`Head Coach critique: ${critique}. Please revise your response.`)
      ]
    };
  }
  function shouldContinue(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage && "tool_calls" in lastMessage && lastMessage.tool_calls && (lastMessage.tool_calls?.length ?? 0) > 0) {
      return "tools";
    }
    return "reflectNode";
  }
  function checkReflection(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage && lastMessage._getType() === "human" && typeof lastMessage.content === "string" && lastMessage.content.includes("Head Coach critique:")) {
      return "llmCall";
    }
    return END;
  }
  const toolNode = new ToolNode(tools);
  const graph = new StateGraph(MessagesAnnotation).addNode("llmCall", llmCall).addNode("tools", toolNode).addNode("reflectNode", reflectNode).addEdge("__start__", "llmCall").addConditionalEdges("llmCall", shouldContinue, {
    tools: "tools",
    reflectNode: "reflectNode"
  }).addConditionalEdges("reflectNode", checkReflection, {
    llmCall: "llmCall",
    [END]: END
  }).addEdge("tools", "llmCall").compile();
  return graph;
}
function toBaseMessages(history) {
  return history.map((msg) => {
    const imageUrls = msg.metadata?.imageUrls ?? [];
    const content = msg.role === "user" && imageUrls.length > 0 ? [
      { type: "text", text: msg.content },
      ...imageUrls.map((url) => ({
        type: "image_url",
        image_url: { url }
      }))
    ] : msg.content;
    switch (msg.role) {
      case "user":
        return new HumanMessage({ content });
      case "assistant":
        return new AIMessage(msg.content);
      case "system":
        return new SystemMessage(msg.content);
      default:
        return new HumanMessage({ content });
    }
  });
}

// src/services/ai/memory-extractor.ts
import { AzureChatOpenAI as AzureChatOpenAI3, AzureOpenAIEmbeddings as AzureOpenAIEmbeddings5 } from "@langchain/openai";
var log9 = createLogger({ module: "memory-extractor" });
var EXTRACTION_PROMPT = `You are a memory extraction system for an AI fitness coach.
Analyze the following conversation snippet and extract any NEW facts worth remembering about the athlete.

Focus on:
- **Preferences**: communication style, workout timing, equipment, exercise likes/dislikes
- **Goals**: races, PRs, body composition, skill targets
- **Constraints**: injuries, schedule limitations, equipment access
- **Patterns**: typical routines, habits, training frequency
- **Medical notes**: chronic conditions, medications, allergies

Rules:
- Only extract genuinely new, useful facts \u2014 not things already in existing memories
- Each memory should be a standalone sentence (e.g., "Athlete prefers evening workouts")
- Set importance 1-5: 1=trivial preference, 3=useful context, 5=critical constraint/medical
- Return an empty array [] if nothing new is worth remembering
- Maximum 3 extractions per turn \u2014 quality over quantity
- Do NOT extract transient information (e.g., "just did a 5k today" \u2014 that's workout data, not a memory)

Respond ONLY with a JSON array. No markdown, no explanation.`;
async function extractMemories(client, userId, userMessage, assistantResponse) {
  try {
    const existingMemories = await getRecentMemories(client, userId, 20);
    const existingContext = existingMemories.length > 0 ? `

Existing memories (DO NOT re-extract these):
${existingMemories.map((m) => `- ${m.content}`).join("\n")}` : "";
    const llm = new AzureChatOpenAI3({
      azureOpenAIEndpoint: AI_CONFIG.azure.endpoint,
      azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
      azureOpenAIApiDeploymentName: AI_CONFIG.azure.deploymentName,
      azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
      temperature: 0,
      // Deterministic extraction
      modelKwargs: { max_completion_tokens: 512 }
    });
    const response = await llm.invoke([
      { type: "system", content: EXTRACTION_PROMPT + existingContext },
      {
        type: "human",
        content: `User: ${userMessage}

Assistant: ${assistantResponse}`
      }
    ]);
    const content = typeof response.content === "string" ? response.content.trim() : "";
    if (!content || content === "[]") return;
    let candidates;
    try {
      candidates = JSON.parse(content);
      if (!Array.isArray(candidates)) return;
    } catch {
      log9.warn({ content }, "Memory extractor: failed to parse JSON");
      return;
    }
    candidates = candidates.filter(
      (c) => c.content && typeof c.content === "string" && c.category && typeof c.importance === "number"
    ).slice(0, 3);
    if (candidates.length === 0) return;
    const embeddingsModel = new AzureOpenAIEmbeddings5({
      azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
      azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", ""),
      azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
      azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion
    });
    const existingEmbeddings = existingMemories.filter((m) => m.embedding && m.embedding.length > 0).map((m) => ({ content: m.content, embedding: m.embedding }));
    for (const candidate of candidates) {
      try {
        const candidateEmbedding = await embeddingsModel.embedQuery(candidate.content);
        const isDuplicate = existingEmbeddings.some((existing) => {
          const similarity = cosineSimilarity(candidateEmbedding, existing.embedding);
          return similarity > 0.88;
        });
        if (isDuplicate) {
          continue;
        }
        await insertMemory(client, {
          athlete_id: userId,
          category: candidate.category,
          content: candidate.content,
          importance: Math.min(5, Math.max(1, Math.round(candidate.importance))),
          embedding: candidateEmbedding
        });
        log9.info({ category: candidate.category, content: candidate.content }, "Memory extracted");
      } catch (err) {
        log9.warn({ err }, "Memory extractor: failed to process candidate");
      }
    }
  } catch (err) {
    log9.error({ err }, "Memory extractor error");
  }
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// src/services/ai/safety.ts
var MAX_INPUT_LENGTH = 4e3;
var EMERGENCY_KEYWORDS = [
  "suicide",
  "suicidal",
  "kill myself",
  "end my life",
  "want to die",
  "self-harm",
  "self harm",
  "cutting myself",
  "hurt myself",
  "overdose",
  "no reason to live",
  "better off dead"
];
var MEDICAL_TRIGGER_KEYWORDS = [
  "diagnosis",
  "diagnose",
  "prescription",
  "medication",
  "medicine",
  "treatment",
  "disease",
  "disorder",
  "symptom",
  "injury",
  "nutrition",
  "supplement",
  "diet",
  "calorie",
  "macro",
  "pain",
  "chronic",
  "acute",
  "condition",
  "surgery",
  "heart rate",
  "blood pressure",
  "spo2",
  "vo2max"
];
var EMERGENCY_RESPONSE = `\u{1F6A8} **I'm concerned about your wellbeing.**

If you're experiencing a crisis or having thoughts of self-harm, please reach out to professionals who can help:

\u{1F1F8}\u{1F1EA} **Sweden**: Mind Sj\xE4lvmordslinjen \u2014 **90101** (call or text)
\u{1F1EA}\u{1F1FA} **EU**: 112 (emergency)
\u{1F30D} **International**: Crisis Text Line \u2014 text **HELLO** to **741741**
\u{1F30D} **International**: Befrienders Worldwide \u2014 [befrienders.org](https://www.befrienders.org)

You are not alone, and there are people who care about you. \u{1F499}

*I'm an AI coaching assistant and cannot provide crisis support. Please contact a professional or someone you trust.*`;
var MEDICAL_DISCLAIMER = `

---
\u2695\uFE0F *This is AI-generated guidance for informational purposes only. It is not medical advice. Always consult a qualified healthcare professional before making health decisions.*`;
var LOW_CONFIDENCE_DISCLAIMER = `

---
\u26A0\uFE0F *I have limited data to support this recommendation. Please verify with your coach or healthcare provider.*`;
function checkInput(message) {
  if (message.length > MAX_INPUT_LENGTH) {
    return {
      passed: false,
      blocked: true,
      reason: "input_too_long",
      response: `Your message is too long (${message.length} characters). Please keep messages under ${MAX_INPUT_LENGTH} characters.`
    };
  }
  if (message.trim().length === 0) {
    return {
      passed: false,
      blocked: true,
      reason: "empty_input",
      response: "Please enter a message."
    };
  }
  const lowered = message.toLowerCase();
  const isEmergency = EMERGENCY_KEYWORDS.some((kw) => lowered.includes(kw));
  if (isEmergency) {
    return {
      passed: false,
      blocked: true,
      reason: "emergency_detected",
      response: EMERGENCY_RESPONSE
    };
  }
  return { passed: true, blocked: false };
}
function processOutput(content, options = {}) {
  let processed = content;
  let disclaimerAdded = false;
  const outputLower = processed.toLowerCase();
  const hasMedical = options.hasMedicalContent ?? MEDICAL_TRIGGER_KEYWORDS.some((kw) => outputLower.includes(kw));
  if (hasMedical) {
    processed += MEDICAL_DISCLAIMER;
    disclaimerAdded = true;
  }
  const lowConfidence = (options.confidence ?? 1) < 0.6;
  if (lowConfidence) {
    processed += LOW_CONFIDENCE_DISCLAIMER;
    disclaimerAdded = true;
  }
  return {
    content: processed,
    disclaimerAdded,
    lowConfidence
  };
}
function classifyIntent(message) {
  const lower = message.toLowerCase();
  if (EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "emergency";
  }
  if (MEDICAL_TRIGGER_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "medical";
  }
  const trainingKeywords = [
    "training",
    "workout",
    "swim",
    "bike",
    "run",
    "pace",
    "interval",
    "tempo",
    "threshold",
    "taper",
    "race",
    "plan",
    "tss",
    "ftp",
    "zone",
    "recovery",
    "rest day"
  ];
  if (trainingKeywords.some((kw) => lower.includes(kw))) {
    return "training";
  }
  return "general";
}

// src/routes/ai/chat.ts
var log10 = createLogger({ module: "ai-chat" });
var aiRoutes = new Hono();
aiRoutes.post("/chat", async (c) => {
  const body = await c.req.json();
  const parsed = ChatMessageInput.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message
        }))
      },
      400
    );
  }
  const { message, conversationId, imageUrls = [] } = parsed.data;
  const safetyCheck = checkInput(message);
  if (safetyCheck.blocked) {
    return c.json({
      role: "assistant",
      content: safetyCheck.response,
      conversationId: conversationId || crypto.randomUUID(),
      metadata: {
        model: "safety-guard",
        blocked: true,
        reason: safetyCheck.reason
      }
    });
  }
  const configCheck = validateAIConfig();
  if (!configCheck.valid) {
    return c.json({
      role: "assistant",
      content: "\u26A0\uFE0F AI Coach is not yet configured. Please set up the required environment variables.",
      conversationId: conversationId || crypto.randomUUID(),
      metadata: {
        model: "none",
        error: "missing_config",
        missing: configCheck.missing
      }
    });
  }
  const auth = getAuth(c);
  const jwt = c.req.header("Authorization")?.replace("Bearer ", "") || "";
  const client = createUserClient(jwt);
  const conversation = await getOrCreateConversation(
    client,
    auth.userId,
    auth.clubId,
    conversationId
  );
  const history = await loadHistory(client, conversation.id, AI_CONFIG.model.historyLimit);
  const userMsgMetadata = imageUrls.length > 0 ? { imageUrls } : void 0;
  const savePromise = saveMessages(client, conversation.id, [
    { role: "user", content: message, metadata: userMsgMetadata }
  ]);
  const titlePromise = history.length === 0 ? updateConversationTitle(client, conversation.id, message) : Promise.resolve();
  await Promise.all([savePromise, titlePromise]);
  const intent = classifyIntent(message);
  return streamSSE(c, async (stream) => {
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache, no-transform");
    try {
      const agent = await createAgent(client, auth.userId, auth.clubId, message);
      const historyMessages = toBaseMessages(history);
      const userContent = imageUrls.length > 0 ? [
        { type: "text", text: message },
        ...imageUrls.map((url) => ({
          type: "image_url",
          image_url: { url }
        }))
      ] : message;
      const inputMessages = [...historyMessages, new HumanMessage2({ content: userContent })];
      let fullResponse = "";
      let isRevisePass = false;
      let notifiedReflection = false;
      const agentStream = await agent.stream(
        { messages: inputMessages },
        { streamMode: "messages" }
      );
      await stream.writeSSE({
        event: "metadata",
        data: JSON.stringify({
          conversationId: conversation.id,
          intent,
          athleteId: auth.userId
        })
      });
      for await (const [msgChunk, metadata] of agentStream) {
        if (metadata.langgraph_node === "llmCall" && msgChunk.content && typeof msgChunk.content === "string") {
          if (isRevisePass) {
            await stream.writeSSE({ event: "clear", data: JSON.stringify({}) });
            fullResponse = "";
            isRevisePass = false;
            notifiedReflection = false;
          }
          fullResponse += msgChunk.content;
          await stream.writeSSE({
            event: "delta",
            data: JSON.stringify({ content: msgChunk.content })
          });
        }
        if (metadata.langgraph_node === "reflectNode") {
          isRevisePass = true;
          if (!notifiedReflection) {
            notifiedReflection = true;
            await stream.writeSSE({
              event: "tool",
              data: JSON.stringify({
                tool: "Self-Evaluation",
                status: "completed"
              })
            });
          }
        }
        if (metadata.langgraph_node === "tools" && msgChunk.name) {
          await stream.writeSSE({
            event: "tool",
            data: JSON.stringify({
              tool: msgChunk.name,
              status: "completed"
            })
          });
        }
      }
      const processed = processOutput(fullResponse, {
        confidence: 0.85,
        hasMedicalContent: intent === "medical"
      });
      if (processed.content !== fullResponse) {
        await stream.writeSSE({
          event: "correction",
          data: JSON.stringify({ content: processed.content })
        });
        fullResponse = processed.content;
      }
      await saveMessages(client, conversation.id, [
        {
          role: "assistant",
          content: fullResponse,
          metadata: {
            model: AI_CONFIG.azure.deploymentName,
            intent,
            disclaimerAdded: processed.disclaimerAdded
          }
        }
      ]);
      extractMemories(client, auth.userId, message, fullResponse).catch(
        (err) => log10.warn({ err }, "Background memory extraction failed")
      );
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          conversationId: conversation.id,
          disclaimerAdded: processed.disclaimerAdded
        })
      });
    } catch (err) {
      log10.error({ err }, "AI Agent error");
      const errorMessage = "\u274C Sorry, I encountered an error processing your request. Please try again.";
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: errorMessage })
      });
      await saveMessages(client, conversation.id, [
        { role: "assistant", content: errorMessage, metadata: { error: true } }
      ]);
    }
  });
});
aiRoutes.get("/conversations", async (c) => {
  const auth = getAuth(c);
  const jwt = c.req.header("Authorization")?.replace("Bearer ", "") || "";
  const client = createUserClient(jwt);
  const conversations = await listConversations(client, auth.userId);
  return c.json({ conversations, athleteId: auth.userId });
});

// src/routes/ai/stream.ts
import { toUIMessageStream } from "@ai-sdk/langchain";
import { HumanMessage as HumanMessage3 } from "@langchain/core/messages";
import { createUIMessageStreamResponse } from "ai";
import { Hono as Hono2 } from "hono";
var log11 = createLogger({ module: "ai-stream" });
var aiStreamRoutes = new Hono2();
aiStreamRoutes.post("/stream", async (c) => {
  const body = await c.req.json();
  const uiMessages = body.messages ?? [];
  const lastUserMsg = uiMessages.filter((m) => m.role === "user").pop();
  const messageText = lastUserMsg?.parts?.filter((p) => p.type === "text").map((p) => p.text).join("\n") || "";
  const reqConversationId = body.conversationId;
  const imageUrls = lastUserMsg?.parts?.filter(
    (p) => p.type === "file" && "mediaType" in p && p.mediaType.startsWith("image/")
  ).map((p) => p.url) ?? [];
  const parsed = ChatMessageInput.safeParse({
    message: messageText,
    conversationId: reqConversationId,
    ...imageUrls.length > 0 && { imageUrls }
  });
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message
        }))
      },
      400
    );
  }
  const { message, conversationId } = parsed.data;
  const safetyCheck = checkInput(message);
  if (safetyCheck.blocked) {
    return c.json({
      role: "assistant",
      content: safetyCheck.response,
      conversationId: conversationId || crypto.randomUUID(),
      metadata: { model: "safety-guard", blocked: true, reason: safetyCheck.reason }
    });
  }
  const configCheck = validateAIConfig();
  if (!configCheck.valid) {
    return c.json({
      role: "assistant",
      content: "AI Coach is not yet configured. Please set up the required environment variables.",
      metadata: { model: "none", error: "missing_config", missing: configCheck.missing }
    });
  }
  const auth = getAuth(c);
  const jwt = c.req.header("Authorization")?.replace("Bearer ", "") || "";
  const client = createUserClient(jwt);
  const conversation = await getOrCreateConversation(
    client,
    auth.userId,
    auth.clubId,
    conversationId
  );
  const history = await loadHistory(client, conversation.id, AI_CONFIG.model.historyLimit);
  const userMsgMetadata = imageUrls.length > 0 ? { imageUrls } : void 0;
  await Promise.all([
    saveMessages(client, conversation.id, [
      { role: "user", content: message, metadata: userMsgMetadata }
    ]),
    history.length === 0 ? updateConversationTitle(client, conversation.id, message) : Promise.resolve()
  ]);
  const intent = classifyIntent(message);
  const agent = await createAgent(client, auth.userId, auth.clubId, message);
  const historyMessages = toBaseMessages(history);
  const userContent = imageUrls.length > 0 ? [
    { type: "text", text: message },
    ...imageUrls.map((url) => ({
      type: "image_url",
      image_url: { url }
    }))
  ] : message;
  const inputMessages = [...historyMessages, new HumanMessage3({ content: userContent })];
  const graphStream = await agent.stream(
    { messages: inputMessages },
    { streamMode: ["values", "messages"] }
  );
  return createUIMessageStreamResponse({
    stream: toUIMessageStream(graphStream, {
      onFinal: async (completion) => {
        if (!completion) return;
        try {
          const processed = processOutput(completion, {
            confidence: 0.85,
            hasMedicalContent: intent === "medical"
          });
          await saveMessages(client, conversation.id, [
            {
              role: "assistant",
              content: processed.content,
              metadata: {
                model: AI_CONFIG.azure.deploymentName,
                intent,
                disclaimerAdded: processed.disclaimerAdded
              }
            }
          ]);
          extractMemories(client, auth.userId, message, processed.content).catch(
            (err) => log11.warn({ err }, "Background memory extraction failed")
          );
        } catch (err) {
          log11.error({ err }, "Post-stream processing failed");
        }
      }
    }),
    headers: {
      "X-Accel-Buffering": "no",
      "Cache-Control": "no-cache, no-transform",
      "X-Conversation-Id": conversation.id
    }
  });
});

// src/routes/integrations/index.ts
import { Hono as Hono7 } from "hono";

// src/config/integrations.ts
function env(key, fallback = "") {
  return process.env[key] || fallback;
}
var INTEGRATION_CONFIG = {
  /** Base URL for this API (used to build OAuth callback URLs) */
  apiBaseUrl: env("API_URL", "http://localhost:8787"),
  /** Base URL for the web frontend (used for OAuth redirects) */
  webUrl: env("WEB_URL", "http://localhost:3000"),
  /** Minimum interval between manual sync requests per athlete (ms) */
  syncCooldownMs: 5 * 60 * 1e3,
  STRAVA: {
    clientId: env("STRAVA_CLIENT_ID"),
    clientSecret: env("STRAVA_CLIENT_SECRET"),
    verifyToken: env("STRAVA_VERIFY_TOKEN")
  },
  GARMIN: {
    consumerKey: env("GARMIN_CONSUMER_KEY"),
    consumerSecret: env("GARMIN_CONSUMER_SECRET")
  },
  POLAR: {
    clientId: env("POLAR_CLIENT_ID"),
    clientSecret: env("POLAR_CLIENT_SECRET"),
    webhookSecret: env("POLAR_WEBHOOK_SECRET")
  },
  WAHOO: {
    clientId: env("WAHOO_CLIENT_ID"),
    clientSecret: env("WAHOO_CLIENT_SECRET"),
    webhookToken: env("WAHOO_WEBHOOK_TOKEN")
  }
};

// src/services/integrations/errors.ts
var IntegrationError = class extends Error {
  constructor(provider6, message, cause) {
    super(`[${provider6}] ${message}`);
    this.provider = provider6;
    this.cause = cause;
    this.name = "IntegrationError";
  }
};
var TokenExpiredError = class extends IntegrationError {
  constructor(provider6, cause) {
    super(provider6, "Access token expired and could not be refreshed", cause);
    this.name = "TokenExpiredError";
  }
};
var ProviderApiError = class extends IntegrationError {
  constructor(provider6, statusCode, message) {
    super(provider6, `API error ${statusCode}: ${message}`);
    this.statusCode = statusCode;
    this.name = "ProviderApiError";
  }
};
var OAuthStateError = class extends IntegrationError {
  constructor(provider6) {
    super(provider6, "Invalid or expired OAuth state \u2014 possible CSRF attack");
    this.name = "OAuthStateError";
  }
};
var ProviderUnavailableError = class extends IntegrationError {
  constructor(provider6, reason) {
    super(provider6, `Provider unavailable: ${reason}`);
    this.name = "ProviderUnavailableError";
  }
};

// src/services/integrations/http.ts
var log12 = createLogger({ module: "http-client" });
var DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1e3,
  timeoutMs: 15e3
};
var RETRYABLE_STATUS = /* @__PURE__ */ new Set([429, 500, 502, 503, 504]);
var NON_RETRYABLE_STATUS = /* @__PURE__ */ new Set([400, 401, 403, 404, 409, 422]);
async function fetchWithRetry(url, options = {}, config = {}) {
  const { maxRetries, baseDelayMs, timeoutMs } = {
    ...DEFAULT_CONFIG,
    ...config
  };
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) return res;
      if (NON_RETRYABLE_STATUS.has(res.status)) return res;
      if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
        const delay = getDelay(res, attempt, baseDelayMs);
        log12.warn(
          { status: res.status, url, attempt: attempt + 1, maxRetries, delayMs: delay },
          "Retryable HTTP status"
        );
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt;
        log12.warn(
          { url, error: lastError.message, attempt: attempt + 1, maxRetries, delayMs: delay },
          "HTTP fetch error, retrying"
        );
        await sleep(delay);
      }
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
function getDelay(response, attempt, baseDelayMs) {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!Number.isNaN(seconds)) {
      return seconds * 1e3;
    }
    const date = new Date(retryAfter).getTime();
    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now());
    }
  }
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * baseDelayMs * 0.5;
  return exponential + jitter;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/services/integrations/providers/garmin.ts
var log13 = createLogger({ module: "garmin-provider" });
var GarminProvider = class _GarminProvider {
  name = "GARMIN";
  oauthConfig = {
    // Garmin uses OAuth 1.0a — these URLs are placeholders
    // until business API access is approved
    authorizeUrl: "https://connect.garmin.com/oauthConfirm",
    tokenUrl: "https://connectapi.garmin.com/oauth-service/oauth/access_token",
    revokeUrl: void 0,
    clientId: INTEGRATION_CONFIG.GARMIN.consumerKey,
    clientSecret: INTEGRATION_CONFIG.GARMIN.consumerSecret,
    scopes: [],
    callbackPath: "/api/integrations/garmin/callback",
    oauthVersion: "1.0a"
  };
  // ── Activity type mapping ──
  static ACTIVITY_MAP = {
    running: "RUN",
    trail_running: "RUN",
    treadmill_running: "RUN",
    cycling: "BIKE",
    mountain_biking: "BIKE",
    indoor_cycling: "BIKE",
    virtual_ride: "BIKE",
    lap_swimming: "SWIM",
    open_water_swimming: "SWIM",
    strength_training: "STRENGTH",
    yoga: "YOGA",
    multi_sport: "OTHER"
    // Triathlon — could be split
  };
  // ── OAuth (stub — requires OAuth 1.0a implementation) ──
  buildAuthUrl(_state) {
    log13.warn("OAuth 1.0a not yet implemented \u2014 requires business API approval");
    const params = new URLSearchParams({
      oauth_callback: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`
    });
    return `${this.oauthConfig.authorizeUrl}?${params}`;
  }
  async exchangeCode(_code) {
    throw new ProviderUnavailableError(
      "GARMIN",
      "OAuth 1.0a token exchange not yet implemented \u2014 awaiting API approval"
    );
  }
  async refreshToken(_refreshToken) {
    throw new Error("[Garmin] OAuth 1.0a tokens do not expire");
  }
  async revokeAccess(_accessToken) {
    log13.warn("Access revocation not yet implemented");
  }
  // ── Webhooks ──
  verifyWebhook(_headers, _body) {
    log13.warn("Garmin webhook signature verification not yet implemented \u2014 accepting all");
    return true;
  }
  extractOwnerIdFromWebhook(event) {
    return String(event.userId || event.userAccessToken || "");
  }
  extractActivityIdFromWebhook(event) {
    return String(event.activityId || event.summaryId || "");
  }
  // ── Data Fetching ──
  async fetchActivity(accessToken, activityId) {
    const res = await fetchWithRetry(
      `https://apis.garmin.com/wellness-api/rest/activities/${activityId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (!res.ok) {
      throw new ProviderApiError("GARMIN", res.status, `fetchActivity failed`);
    }
    const a = await res.json();
    return this.normalizeActivity(a);
  }
  async fetchActivities(accessToken, since, limit = 50) {
    const params = new URLSearchParams({
      uploadStartTimeInSeconds: String(Math.floor(since.getTime() / 1e3)),
      uploadEndTimeInSeconds: String(Math.floor(Date.now() / 1e3))
    });
    const res = await fetchWithRetry(
      `https://apis.garmin.com/wellness-api/rest/activities?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (!res.ok) {
      throw new ProviderApiError("GARMIN", res.status, "fetchActivities failed");
    }
    const activities = await res.json();
    return activities.slice(0, limit).map((a) => this.normalizeActivity(a));
  }
  async fetchHealthData(accessToken, date) {
    const dateStr = date.toISOString().split("T")[0];
    const metrics = [];
    try {
      const res = await fetchWithRetry(
        `https://apis.garmin.com/wellness-api/rest/dailies?calendarDate=${dateStr}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const summaries = await res.json();
        for (const s of summaries) {
          if (s.restingHeartRateInBeatsPerMinute) {
            metrics.push({
              metricType: "RESTING_HR",
              value: Number(s.restingHeartRateInBeatsPerMinute),
              unit: "bpm",
              recordedAt: new Date(dateStr),
              source: "GARMIN",
              rawData: s
            });
          }
          if (s.steps) {
            metrics.push({
              metricType: "STEPS",
              value: Number(s.steps),
              unit: "count",
              recordedAt: new Date(dateStr),
              source: "GARMIN",
              rawData: s
            });
          }
          if (s.activeKilocalories) {
            metrics.push({
              metricType: "ACTIVE_CALORIES",
              value: Number(s.activeKilocalories),
              unit: "kcal",
              recordedAt: new Date(dateStr),
              source: "GARMIN",
              rawData: s
            });
          }
        }
      }
    } catch (err) {
      log13.error({ err }, "fetchHealthData error");
    }
    return metrics;
  }
  // ── Mapping ──
  mapActivityType(garminType) {
    return _GarminProvider.ACTIVITY_MAP[garminType.toLowerCase()] || "OTHER";
  }
  normalizeActivity(a) {
    const activityType = String(a.activityType || a.sportType || "other");
    const durationS = Number(a.durationInSeconds || a.elapsedDurationInSeconds || 0);
    const distanceM = Number(a.distanceInMeters || 0);
    return {
      activityType: this.mapActivityType(activityType),
      source: "GARMIN",
      startedAt: new Date(Number(a.startTimeInSeconds || 0) * 1e3),
      durationS: durationS || null,
      distanceM: distanceM || null,
      avgHr: a.averageHeartRateInBeatsPerMinute || null,
      maxHr: a.maxHeartRateInBeatsPerMinute || null,
      avgPaceSKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1e3)) : null,
      avgPowerW: a.averagePowerInWatts || null,
      calories: a.activeKilocalories || null,
      tss: null,
      // Garmin uses Training Effect, not TSS
      rawData: a,
      notes: null
    };
  }
};

// src/services/integrations/providers/polar.ts
import { createHmac, timingSafeEqual } from "node:crypto";
var log14 = createLogger({ module: "polar-provider" });
var POLAR_API = "https://www.polaraccesslink.com/v3";
var PolarProvider = class _PolarProvider {
  name = "POLAR";
  oauthConfig = {
    authorizeUrl: "https://flow.polar.com/oauth2/authorization",
    tokenUrl: "https://polarremote.com/v2/oauth2/token",
    revokeUrl: void 0,
    clientId: INTEGRATION_CONFIG.POLAR.clientId,
    clientSecret: INTEGRATION_CONFIG.POLAR.clientSecret,
    scopes: ["accesslink.read_all"],
    callbackPath: "/api/integrations/polar/callback",
    oauthVersion: "2.0"
  };
  static ACTIVITY_MAP = {
    RUNNING: "RUN",
    JOGGING: "RUN",
    ROAD_RUNNING: "RUN",
    TRAIL_RUNNING: "RUN",
    TREADMILL_RUNNING: "RUN",
    CYCLING: "BIKE",
    ROAD_BIKING: "BIKE",
    MOUNTAIN_BIKING: "BIKE",
    INDOOR_CYCLING: "BIKE",
    SWIMMING: "SWIM",
    POOL_SWIMMING: "SWIM",
    OPEN_WATER_SWIMMING: "SWIM",
    STRENGTH_TRAINING: "STRENGTH",
    YOGA: "YOGA",
    TRIATHLON: "OTHER"
    // Multi-sport
  };
  // ── OAuth ──
  buildAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      response_type: "code",
      redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
      scope: this.oauthConfig.scopes.join(" "),
      state
    });
    return `${this.oauthConfig.authorizeUrl}?${params}`;
  }
  async exchangeCode(code) {
    const credentials = Buffer.from(
      `${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`
    ).toString("base64");
    const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
        Accept: "application/json"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`
      })
    });
    if (!res.ok) {
      throw new ProviderApiError("POLAR", res.status, "Code exchange failed");
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: "",
      // Polar doesn't use refresh tokens
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3),
      // Far future
      providerUserId: String(data.x_user_id),
      scopes: this.oauthConfig.scopes
    };
  }
  async refreshToken(_refreshToken) {
    throw new Error("[Polar] Tokens do not expire \u2014 no refresh needed");
  }
  async revokeAccess(accessToken) {
    await fetch(`${POLAR_API}/users/current`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }
  // ── Webhooks ──
  verifyWebhook(headers, body) {
    const secret = INTEGRATION_CONFIG.POLAR.webhookSecret;
    if (!secret) {
      log14.warn("POLAR_WEBHOOK_SECRET not configured \u2014 skipping signature verification");
      return true;
    }
    const signature = headers["polar-webhook-signature"] || headers["Polar-Webhook-Signature"];
    if (!signature) {
      log14.warn("Missing Polar-Webhook-Signature header");
      return false;
    }
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
    } catch {
      return false;
    }
  }
  extractOwnerIdFromWebhook(event) {
    return String(event.user_id || "");
  }
  extractActivityIdFromWebhook(event) {
    return String(event.entity_id || event.exercise_id || "");
  }
  // ── Data Fetching ──
  async fetchActivity(accessToken, activityId) {
    const res = await fetchWithRetry(`${POLAR_API}/exercises/${activityId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      throw new ProviderApiError("POLAR", res.status, "fetchActivity failed");
    }
    const a = await res.json();
    return this.normalizeActivity(a);
  }
  async fetchActivities(accessToken, _since, limit = 50) {
    const txRes = await fetchWithRetry(`${POLAR_API}/exercises`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });
    if (!txRes.ok) return [];
    const exercises = await txRes.json();
    return exercises.slice(0, limit).map((a) => this.normalizeActivity(a));
  }
  async fetchHealthData(accessToken, _date) {
    const metrics = [];
    try {
      const sleepRes = await fetchWithRetry(`${POLAR_API}/users/sleep`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        }
      });
      if (sleepRes.ok) {
        const sleepData = await sleepRes.json();
        if (sleepData.sleep_duration) {
          metrics.push({
            metricType: "SLEEP_HOURS",
            value: Number(sleepData.sleep_duration) / 3600,
            // seconds → hours
            unit: "hours",
            recordedAt: /* @__PURE__ */ new Date(),
            source: "POLAR",
            rawData: sleepData
          });
        }
      }
    } catch (err) {
      log14.error({ err }, "fetchHealthData error");
    }
    return metrics;
  }
  // ── Mapping ──
  mapActivityType(polarType) {
    return _PolarProvider.ACTIVITY_MAP[polarType.toUpperCase()] || "OTHER";
  }
  normalizeActivity(a) {
    const sport = String(a.sport || a.detailed_sport_info || "OTHER");
    const durationStr = String(a.duration || "PT0S");
    const durationS = this.parseDuration(durationStr);
    const distanceM = Number(a.distance || 0);
    return {
      activityType: this.mapActivityType(sport),
      source: "POLAR",
      startedAt: new Date(String(a.start_time || (/* @__PURE__ */ new Date()).toISOString())),
      durationS: durationS || null,
      distanceM: distanceM || null,
      avgHr: a.heart_rate?.average || null,
      maxHr: a.heart_rate?.maximum || null,
      avgPaceSKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1e3)) : null,
      avgPowerW: null,
      // Available in detailed data
      calories: a.calories || null,
      tss: a.training_load || null,
      rawData: a,
      notes: null
    };
  }
  /** Parse ISO 8601 duration (PT1H30M45S) to seconds */
  parseDuration(iso) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return 0;
    const h = parseInt(match[1] || "0", 10);
    const m = parseInt(match[2] || "0", 10);
    const s = parseFloat(match[3] || "0");
    return h * 3600 + m * 60 + Math.round(s);
  }
};

// src/services/integrations/providers/strava.ts
var STRAVA_API = "https://www.strava.com/api/v3";
var StravaProvider = class _StravaProvider {
  name = "STRAVA";
  oauthConfig = {
    authorizeUrl: "https://www.strava.com/oauth/authorize",
    tokenUrl: "https://www.strava.com/oauth/token",
    revokeUrl: "https://www.strava.com/oauth/deauthorize",
    clientId: INTEGRATION_CONFIG.STRAVA.clientId,
    clientSecret: INTEGRATION_CONFIG.STRAVA.clientSecret,
    scopes: ["read", "activity:read_all"],
    callbackPath: "/api/integrations/strava/callback",
    oauthVersion: "2.0"
  };
  // ── Activity type mapping ──
  static ACTIVITY_MAP = {
    Run: "RUN",
    VirtualRun: "RUN",
    TrailRun: "RUN",
    Ride: "BIKE",
    VirtualRide: "BIKE",
    GravelRide: "BIKE",
    MountainBikeRide: "BIKE",
    EBikeRide: "BIKE",
    Swim: "SWIM",
    WeightTraining: "STRENGTH",
    Yoga: "YOGA"
  };
  // ── OAuth ──
  buildAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      response_type: "code",
      redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
      approval_prompt: "auto",
      scope: this.oauthConfig.scopes.join(","),
      state
    });
    return `${this.oauthConfig.authorizeUrl}?${params}`;
  }
  async exchangeCode(code) {
    const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        code,
        grant_type: "authorization_code"
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new ProviderApiError("STRAVA", res.status, `Code exchange failed: ${err}`);
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1e3),
      providerUserId: String(data.athlete.id),
      scopes: this.oauthConfig.scopes
    };
  }
  async refreshToken(refreshToken) {
    const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });
    if (!res.ok) {
      throw new ProviderApiError("STRAVA", res.status, "Token refresh failed");
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1e3),
      providerUserId: "",
      // Not returned on refresh
      scopes: this.oauthConfig.scopes
    };
  }
  async revokeAccess(accessToken) {
    await fetch(this.oauthConfig.revokeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }
  // ── Webhooks ──
  verifyWebhook(_headers, body) {
    try {
      const event = JSON.parse(body);
      return typeof event.object_type === "string" && typeof event.aspect_type === "string" && event.owner_id !== void 0;
    } catch {
      return false;
    }
  }
  extractOwnerIdFromWebhook(event) {
    return String(event.owner_id);
  }
  extractActivityIdFromWebhook(event) {
    return String(event.object_id);
  }
  // ── Data Fetching ──
  async fetchActivity(accessToken, activityId) {
    const res = await fetchWithRetry(`${STRAVA_API}/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new ProviderApiError("STRAVA", res.status, `fetchActivity ${activityId} failed`);
    }
    const a = await res.json();
    return this.normalizeActivity(a);
  }
  async fetchActivities(accessToken, since, limit = 50) {
    const after = Math.floor(since.getTime() / 1e3);
    const params = new URLSearchParams({
      after: String(after),
      per_page: String(Math.min(limit, 200))
    });
    const res = await fetchWithRetry(`${STRAVA_API}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new ProviderApiError("STRAVA", res.status, "fetchActivities failed");
    }
    const activities = await res.json();
    return activities.map((a) => this.normalizeActivity(a));
  }
  // ── Mapping ──
  mapActivityType(stravaType) {
    return _StravaProvider.ACTIVITY_MAP[stravaType] || "OTHER";
  }
  normalizeActivity(a) {
    const type = String(a.type || "Other");
    const elapsedTime = Number(a.elapsed_time || 0);
    const distance = Number(a.distance || 0);
    return {
      activityType: this.mapActivityType(type),
      source: "STRAVA",
      startedAt: new Date(String(a.start_date)),
      durationS: elapsedTime || null,
      distanceM: distance || null,
      avgHr: a.average_heartrate || null,
      maxHr: a.max_heartrate || null,
      avgPaceSKm: distance > 0 ? Math.round(elapsedTime / (distance / 1e3)) : null,
      avgPowerW: a.average_watts || null,
      calories: a.calories || null,
      tss: a.suffer_score || null,
      rawData: a,
      notes: a.description || null
    };
  }
};

// src/services/integrations/providers/wahoo.ts
import { timingSafeEqual as timingSafeEqual2 } from "node:crypto";
var log15 = createLogger({ module: "wahoo-provider" });
var WAHOO_API = "https://api.wahooligan.com/v1";
var WahooProvider = class _WahooProvider {
  name = "WAHOO";
  oauthConfig = {
    authorizeUrl: "https://api.wahooligan.com/oauth/authorize",
    tokenUrl: "https://api.wahooligan.com/oauth/token",
    revokeUrl: "https://api.wahooligan.com/oauth/revoke",
    clientId: INTEGRATION_CONFIG.WAHOO.clientId,
    clientSecret: INTEGRATION_CONFIG.WAHOO.clientSecret,
    scopes: ["user_read", "workouts_read", "offline_data"],
    callbackPath: "/api/integrations/wahoo/callback",
    oauthVersion: "2.0"
  };
  static ACTIVITY_MAP = {
    running: "RUN",
    cycling: "BIKE",
    swimming: "SWIM",
    strength: "STRENGTH",
    yoga: "YOGA"
  };
  // ── OAuth ──
  buildAuthUrl(state) {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      response_type: "code",
      redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
      scope: this.oauthConfig.scopes.join(" "),
      state
    });
    return `${this.oauthConfig.authorizeUrl}?${params}`;
  }
  async exchangeCode(code) {
    const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`
      })
    });
    if (!res.ok) {
      throw new ProviderApiError("WAHOO", res.status, "Code exchange failed");
    }
    const data = await res.json();
    const userRes = await fetch(`${WAHOO_API}/user`, {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    const user = await userRes.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date((data.created_at + data.expires_in) * 1e3),
      providerUserId: String(user.id),
      scopes: this.oauthConfig.scopes
    };
  }
  async refreshToken(refreshToken) {
    const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });
    if (!res.ok) {
      throw new ProviderApiError("WAHOO", res.status, "Token refresh failed");
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date((data.created_at + data.expires_in) * 1e3),
      providerUserId: "",
      scopes: this.oauthConfig.scopes
    };
  }
  async revokeAccess(accessToken) {
    await fetch(this.oauthConfig.revokeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: accessToken,
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret
      })
    });
  }
  // ── Webhooks ──
  verifyWebhook(headers, _body) {
    const expectedToken = INTEGRATION_CONFIG.WAHOO.webhookToken;
    if (!expectedToken) {
      log15.warn("WAHOO_WEBHOOK_TOKEN not configured \u2014 skipping verification");
      return true;
    }
    const receivedToken = headers["webhook-token"] || headers["Webhook-Token"];
    if (!receivedToken) {
      log15.warn("Missing Webhook-Token header");
      return false;
    }
    try {
      return timingSafeEqual2(
        Buffer.from(receivedToken, "utf8"),
        Buffer.from(expectedToken, "utf8")
      );
    } catch {
      return false;
    }
  }
  extractOwnerIdFromWebhook(event) {
    const user = event.user;
    return String(user?.id || "");
  }
  extractActivityIdFromWebhook(event) {
    const workout = event.workout_summary;
    return String(workout?.id || event.id || "");
  }
  // ── Data Fetching ──
  async fetchActivity(accessToken, activityId) {
    const res = await fetchWithRetry(`${WAHOO_API}/workouts/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new ProviderApiError("WAHOO", res.status, "fetchActivity failed");
    }
    const data = await res.json();
    return this.normalizeActivity(data);
  }
  async fetchActivities(accessToken, _since, limit = 50) {
    const res = await fetchWithRetry(`${WAHOO_API}/workouts?per_page=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.workouts || []).slice(0, limit).map((w) => this.normalizeActivity(w));
  }
  // ── Mapping ──
  mapActivityType(wahooType) {
    return _WahooProvider.ACTIVITY_MAP[wahooType.toLowerCase()] || "OTHER";
  }
  normalizeActivity(a) {
    const summary = a.workout_summary || a;
    const workout = a.workout || a;
    const durationS = Number(summary.duration_active_accum || workout.duration_active_accum || 0);
    const distanceM = Number(summary.distance_accum || workout.distance_accum || 0);
    const sport = String(workout.workout_type || workout.name || "other");
    return {
      activityType: this.mapActivityType(sport),
      source: "WAHOO",
      startedAt: new Date(String(workout.starts || workout.created_at || (/* @__PURE__ */ new Date()).toISOString())),
      durationS: durationS || null,
      distanceM: distanceM || null,
      avgHr: summary.heart_rate_avg || null,
      maxHr: null,
      // Not always in summary
      avgPaceSKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1e3)) : null,
      avgPowerW: summary.power_avg || null,
      calories: summary.calories_accum || null,
      tss: null,
      rawData: a,
      notes: workout.description || null
    };
  }
};

// src/services/integrations/registry.ts
var providers = /* @__PURE__ */ new Map([
  ["STRAVA", new StravaProvider()],
  ["GARMIN", new GarminProvider()],
  ["POLAR", new PolarProvider()],
  ["WAHOO", new WahooProvider()]
]);
function getProvider(name) {
  const p = providers.get(name);
  if (!p) throw new Error(`Unknown integration provider: ${name}`);
  return p;
}
function getAllProviderNames() {
  return [...providers.keys()];
}

// src/services/integrations/crypto.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 12;
var TAG_LENGTH = 16;
function getEncryptionKey() {
  const keyHex = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    const fallback = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || "dev-key";
    return createHash("sha256").update(fallback).digest();
  }
  return Buffer.from(keyHex, "hex");
}
function encryptToken(plaintext) {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH
  });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString("base64");
}
function decryptToken(encrypted) {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, "base64");
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH
  });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
function isEncrypted(value) {
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length >= 29 && value === buf.toString("base64");
  } catch {
    return false;
  }
}

// src/services/integrations/token-manager.ts
var log16 = createLogger({ module: "token-manager" });
var REFRESH_BUFFER_MS = 5 * 60 * 1e3;
async function ensureFreshToken(provider6, account, client) {
  let plainAccessToken;
  try {
    plainAccessToken = isEncrypted(account.access_token) ? decryptToken(account.access_token) : account.access_token;
  } catch {
    plainAccessToken = account.access_token;
  }
  if (account.token_expires) {
    const expiresAt = new Date(account.token_expires);
    if (expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
      return plainAccessToken;
    }
  } else {
    return plainAccessToken;
  }
  let plainRefreshToken = null;
  if (account.refresh_token) {
    try {
      plainRefreshToken = isEncrypted(account.refresh_token) ? decryptToken(account.refresh_token) : account.refresh_token;
    } catch {
      plainRefreshToken = account.refresh_token;
    }
  }
  if (!plainRefreshToken) {
    throw new TokenExpiredError(provider6.name);
  }
  log16.info({ provider: provider6.name, athleteId: account.athlete_id }, "Refreshing token");
  const tokens = await provider6.refreshToken(plainRefreshToken);
  const { error } = await client.from("connected_accounts").update({
    access_token: encryptToken(tokens.accessToken),
    refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : account.refresh_token,
    token_expires: tokens.expiresAt.toISOString()
  }).eq("id", account.id);
  if (error) {
    log16.error({ err: error }, "Failed to update tokens");
  }
  return tokens.accessToken;
}
async function getActiveConnection(providerName, athleteId, client) {
  const { data: account } = await client.from("connected_accounts").select("*").eq("athlete_id", athleteId).eq("provider", providerName).single();
  if (!account) return null;
  const provider6 = getProvider(providerName);
  const accessToken = await ensureFreshToken(provider6, account, client);
  return { account, accessToken };
}
async function getConnectedAccounts(athleteId, client) {
  const { data: accounts } = await client.from("connected_accounts").select("provider, last_sync_at, provider_uid").eq("athlete_id", athleteId);
  return (accounts || []).map((a) => ({
    provider: a.provider,
    connected: true,
    lastSyncAt: a.last_sync_at,
    providerUid: a.provider_uid
  }));
}

// src/routes/integrations/garmin.ts
import { Hono as Hono3 } from "hono";

// src/services/integrations/normalizer.ts
var log17 = createLogger({ module: "normalizer" });
var DEDUP_WINDOW_MS = 5 * 60 * 1e3;
async function normalizeAndStore(workouts, metrics, athleteId, clubId, client) {
  const result = {
    workoutsInserted: 0,
    workoutsSkipped: 0,
    metricsInserted: 0,
    metricsSkipped: 0
  };
  for (const w of workouts) {
    try {
      const windowStart = new Date(w.startedAt.getTime() - DEDUP_WINDOW_MS).toISOString();
      const windowEnd = new Date(w.startedAt.getTime() + DEDUP_WINDOW_MS).toISOString();
      const { data: existing } = await client.from("workouts").select("id").eq("athlete_id", athleteId).eq("source", w.source).gte("started_at", windowStart).lte("started_at", windowEnd).limit(1);
      if (existing?.length) {
        result.workoutsSkipped++;
        continue;
      }
      const { error } = await client.from("workouts").insert({
        athlete_id: athleteId,
        club_id: clubId,
        activity_type: w.activityType,
        source: w.source,
        started_at: w.startedAt.toISOString(),
        duration_s: w.durationS,
        distance_m: w.distanceM,
        avg_hr: w.avgHr,
        max_hr: w.maxHr,
        avg_pace_s_km: w.avgPaceSKm,
        avg_power_w: w.avgPowerW,
        calories: w.calories,
        tss: w.tss,
        raw_data: w.rawData,
        notes: w.notes
      });
      if (error) {
        log17.error({ err: error, source: w.source, athleteId }, "Workout insert error");
        result.workoutsSkipped++;
      } else {
        result.workoutsInserted++;
      }
    } catch (err) {
      log17.error({ err, athleteId }, "Workout processing error");
      result.workoutsSkipped++;
    }
  }
  for (const m of metrics) {
    try {
      const { data: existing } = await client.from("health_metrics").select("id").eq("athlete_id", athleteId).eq("metric_type", m.metricType).eq("recorded_at", m.recordedAt.toISOString()).limit(1);
      if (existing?.length) {
        result.metricsSkipped++;
        continue;
      }
      const { error } = await client.from("health_metrics").insert({
        athlete_id: athleteId,
        club_id: clubId,
        metric_type: m.metricType,
        value: m.value,
        unit: m.unit,
        recorded_at: m.recordedAt.toISOString(),
        source: m.source,
        raw_data: m.rawData || null
      });
      if (error) {
        log17.error({ err: error, metricType: m.metricType, athleteId }, "Metric insert error");
        result.metricsSkipped++;
      } else {
        result.metricsInserted++;
      }
    } catch (err) {
      log17.error({ err, athleteId }, "Metric processing error");
      result.metricsSkipped++;
    }
  }
  await autoPopulateDailyLogs(metrics, athleteId, clubId, client);
  return result;
}
async function autoPopulateDailyLogs(metrics, athleteId, clubId, client) {
  const byDate = /* @__PURE__ */ new Map();
  for (const m of metrics) {
    const date = m.recordedAt.toISOString().split("T")[0];
    const existing = byDate.get(date) || {};
    switch (m.metricType) {
      case "HRV":
        existing.hrv = m.value;
        break;
      case "RESTING_HR":
        existing.restingHr = m.value;
        break;
      case "SLEEP_HOURS":
        existing.sleepHours = m.value;
        break;
    }
    byDate.set(date, existing);
  }
  for (const [date, data] of byDate) {
    const { data: existing } = await client.from("daily_logs").select("id, hrv, resting_hr, sleep_hours").eq("athlete_id", athleteId).eq("log_date", date).single();
    if (existing) {
      const updates = {};
      if (existing.hrv === null && data.hrv !== void 0) updates.hrv = data.hrv;
      if (existing.resting_hr === null && data.restingHr !== void 0)
        updates.resting_hr = data.restingHr;
      if (existing.sleep_hours === null && data.sleepHours !== void 0)
        updates.sleep_hours = data.sleepHours;
      if (Object.keys(updates).length > 0) {
        await client.from("daily_logs").update(updates).eq("id", existing.id);
      }
    } else {
      await client.from("daily_logs").insert({
        athlete_id: athleteId,
        club_id: clubId,
        log_date: date,
        hrv: data.hrv || null,
        resting_hr: data.restingHr || null,
        sleep_hours: data.sleepHours || null
      });
    }
  }
}

// src/services/integrations/oauth-state.ts
import { createHmac as createHmac2, timingSafeEqual as timingSafeEqual3 } from "node:crypto";
var log18 = createLogger({ module: "oauth-state" });
var STATE_TTL_MS = 10 * 60 * 1e3;
function getSigningKey() {
  const key = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || "fallback-dev-key-change-in-production";
  return key;
}
function createOAuthState(athleteId) {
  const timestamp = Date.now().toString(36);
  const payload = `${athleteId}:${timestamp}`;
  const hmac = createHmac2("sha256", getSigningKey()).update(payload).digest("hex").slice(0, 16);
  const state = Buffer.from(`${payload}:${hmac}`).toString("base64url");
  return state;
}
function verifyOAuthState(state) {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [athleteId, timestamp, receivedHmac] = parts;
    const ts = parseInt(timestamp, 36);
    if (Date.now() - ts > STATE_TTL_MS) {
      log18.warn("OAuth state expired");
      return null;
    }
    const expectedHmac = createHmac2("sha256", getSigningKey()).update(`${athleteId}:${timestamp}`).digest("hex").slice(0, 16);
    const a = Buffer.from(receivedHmac, "utf8");
    const b = Buffer.from(expectedHmac, "utf8");
    if (a.length !== b.length || !timingSafeEqual3(a, b)) {
      log18.warn("Invalid HMAC signature on OAuth state");
      return null;
    }
    return { athleteId };
  } catch {
    log18.warn("Failed to decode OAuth state");
    return null;
  }
}

// src/services/integrations/oauth.ts
var log19 = createLogger({ module: "oauth" });
function buildAuthorizationUrl(provider6, athleteId) {
  const state = createOAuthState(athleteId);
  return provider6.buildAuthUrl(state);
}
function verifyCallbackState(provider6, state) {
  const result = verifyOAuthState(state);
  if (!result) {
    throw new OAuthStateError(provider6.name);
  }
  return result.athleteId;
}
async function handleOAuthCallback(provider6, code, athleteId, clubId, client) {
  const tokens = await provider6.exchangeCode(code);
  const encAccessToken = encryptToken(tokens.accessToken);
  const encRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;
  const { error: upsertError } = await client.from("connected_accounts").upsert(
    {
      athlete_id: athleteId,
      provider: provider6.name,
      access_token: encAccessToken,
      refresh_token: encRefreshToken,
      token_expires: tokens.expiresAt.toISOString(),
      provider_uid: tokens.providerUserId,
      scopes: tokens.scopes,
      last_sync_at: null
    },
    { onConflict: "athlete_id,provider" }
  );
  if (upsertError) {
    log19.error({ err: upsertError, provider: provider6.name }, "Failed to store tokens");
    throw new IntegrationError(provider6.name, `Failed to store connection: ${upsertError.message}`);
  }
  log19.info(
    { provider: provider6.name, athleteId, providerUid: tokens.providerUserId },
    "Provider connected"
  );
  backfillActivities(
    provider6,
    tokens.accessToken,
    // Use plaintext for immediate API calls
    athleteId,
    clubId,
    client
  ).then((result) => {
    log19.info(
      {
        provider: provider6.name,
        workoutsInserted: result.workoutsInserted,
        metricsInserted: result.metricsInserted
      },
      "Backfill complete"
    );
  }).catch((err) => {
    log19.error({ err, provider: provider6.name }, "Backfill failed");
  });
  return { success: true, provider: provider6.name };
}
async function backfillActivities(provider6, accessToken, athleteId, clubId, client, daysBack = 30) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1e3);
  const activities = await provider6.fetchActivities(accessToken, since);
  const metrics = [];
  if (provider6.fetchHealthData) {
    const todayMetrics = await provider6.fetchHealthData(accessToken, /* @__PURE__ */ new Date());
    metrics.push(...todayMetrics);
  }
  return normalizeAndStore(activities, metrics, athleteId, clubId, client);
}
async function handleProviderOAuthCallback(provider6, providerSlug, c) {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const webUrl = INTEGRATION_CONFIG.webUrl;
  if (error || !code || !state) {
    log19.error({ error, provider: providerSlug }, "OAuth callback error");
    return c.redirect(`${webUrl}/workout/settings?integration=${providerSlug}&error=denied`);
  }
  try {
    const athleteId = verifyCallbackState(provider6, state);
    const client = createAdminClient();
    const { data: profile } = await client.from("profiles").select("club_id").eq("id", athleteId).single();
    if (!profile) {
      return c.json({ error: "Athlete not found" }, 404);
    }
    await handleOAuthCallback(provider6, code, athleteId, profile.club_id, client);
    return c.redirect(`${webUrl}/workout/settings?integration=${providerSlug}&status=connected`);
  } catch (err) {
    log19.error({ err, provider: providerSlug }, "OAuth callback failed");
    return c.redirect(`${webUrl}/workout/settings?integration=${providerSlug}&error=failed`);
  }
}
async function handleProviderSync(provider6, providerName, c) {
  const auth = getAuth(c);
  const client = createAdminClient();
  const cooldownSec = Math.ceil(INTEGRATION_CONFIG.syncCooldownMs / 1e3);
  try {
    const { data: remaining, error } = await client.rpc("check_rate_limit", {
      rate_key: `sync:${providerName}:${auth.userId}`,
      max_requests: 1,
      window_seconds: cooldownSec
    });
    if (!error && remaining < 0) {
      return c.json({ error: `Please wait before syncing again` }, 429);
    }
  } catch {
  }
  const connection = await getActiveConnection(providerName, auth.userId, client);
  if (!connection) {
    return c.json({ error: `${providerName} not connected` }, 400);
  }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
  const activities = await provider6.fetchActivities(connection.accessToken, since);
  const healthData = provider6.fetchHealthData ? await provider6.fetchHealthData(connection.accessToken, /* @__PURE__ */ new Date()) : [];
  const result = await normalizeAndStore(activities, healthData, auth.userId, auth.clubId, client);
  await client.from("connected_accounts").update({ last_sync_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", connection.account.id);
  return c.json({
    status: "synced",
    workoutsInserted: result.workoutsInserted,
    workoutsSkipped: result.workoutsSkipped,
    metricsInserted: result.metricsInserted
  });
}
async function disconnectProvider(provider6, athleteId, client) {
  const { data: account } = await client.from("connected_accounts").select("*").eq("athlete_id", athleteId).eq("provider", provider6.name).single();
  if (account) {
    let plainToken = account.access_token;
    try {
      if (isEncrypted(account.access_token)) {
        plainToken = decryptToken(account.access_token);
      }
    } catch {
    }
    try {
      await provider6.revokeAccess(plainToken);
    } catch (err) {
      log19.warn({ err, provider: provider6.name }, "Failed to revoke access (continuing)");
    }
    await client.from("connected_accounts").delete().eq("athlete_id", athleteId).eq("provider", provider6.name);
  }
  log19.info({ provider: provider6.name, athleteId }, "Provider disconnected");
}

// src/routes/integrations/garmin.ts
var garminRoutes = new Hono3();
var provider2 = getProvider("GARMIN");
garminRoutes.get("/connect", (c) => {
  const _auth = getAuth(c);
  return c.json(
    {
      error: "Garmin integration requires business API approval",
      status: "pending_approval",
      applyAt: "https://developer.garmin.com/gc-developer-program/"
    },
    503
  );
});
garminRoutes.get("/callback", async (c) => {
  return c.json({ error: "Not yet implemented" }, 501);
});
garminRoutes.post("/disconnect", async (c) => {
  const auth = getAuth(c);
  const client = createAdminClient();
  await disconnectProvider(provider2, auth.userId, client);
  return c.json({ status: "disconnected", provider: "GARMIN" });
});

// src/routes/integrations/polar.ts
import { Hono as Hono4 } from "hono";
var polarRoutes = new Hono4();
var provider3 = getProvider("POLAR");
polarRoutes.get("/connect", (c) => {
  const auth = getAuth(c);
  return c.redirect(buildAuthorizationUrl(provider3, auth.userId));
});
polarRoutes.get("/callback", (c) => handleProviderOAuthCallback(provider3, "polar", c));
polarRoutes.post("/disconnect", async (c) => {
  const auth = getAuth(c);
  const client = createAdminClient();
  await disconnectProvider(provider3, auth.userId, client);
  return c.json({ status: "disconnected", provider: "POLAR" });
});
polarRoutes.post("/sync", (c) => handleProviderSync(provider3, "POLAR", c));

// src/routes/integrations/strava.ts
import { Hono as Hono5 } from "hono";
var stravaRoutes = new Hono5();
var provider4 = getProvider("STRAVA");
stravaRoutes.get("/connect", (c) => {
  const auth = getAuth(c);
  return c.redirect(buildAuthorizationUrl(provider4, auth.userId));
});
stravaRoutes.get("/callback", (c) => handleProviderOAuthCallback(provider4, "strava", c));
stravaRoutes.post("/disconnect", async (c) => {
  const auth = getAuth(c);
  const client = createAdminClient();
  await disconnectProvider(provider4, auth.userId, client);
  return c.json({ status: "disconnected", provider: "STRAVA" });
});
stravaRoutes.post("/sync", (c) => handleProviderSync(provider4, "STRAVA", c));

// src/routes/integrations/wahoo.ts
import { Hono as Hono6 } from "hono";
var wahooRoutes = new Hono6();
var provider5 = getProvider("WAHOO");
wahooRoutes.get("/connect", (c) => {
  const auth = getAuth(c);
  return c.redirect(buildAuthorizationUrl(provider5, auth.userId));
});
wahooRoutes.get("/callback", (c) => handleProviderOAuthCallback(provider5, "wahoo", c));
wahooRoutes.post("/disconnect", async (c) => {
  const auth = getAuth(c);
  const client = createAdminClient();
  await disconnectProvider(provider5, auth.userId, client);
  return c.json({ status: "disconnected", provider: "WAHOO" });
});
wahooRoutes.post("/sync", (c) => handleProviderSync(provider5, "WAHOO", c));

// src/routes/integrations/index.ts
var integrationRoutes = new Hono7();
integrationRoutes.route("/strava", stravaRoutes);
integrationRoutes.route("/garmin", garminRoutes);
integrationRoutes.route("/polar", polarRoutes);
integrationRoutes.route("/wahoo", wahooRoutes);
integrationRoutes.get("/status", async (c) => {
  const auth = getAuth(c);
  const client = createAdminClient();
  const connected = await getConnectedAccounts(auth.userId, client);
  const allProviders = getAllProviderNames();
  const status = allProviders.map((name) => {
    const conn = connected.find((item) => item.provider === name);
    return {
      provider: name,
      connected: !!conn,
      lastSyncAt: conn?.lastSyncAt || null,
      providerUid: conn?.providerUid || null
    };
  });
  const { count } = await client.from("webhook_queue").select("*", { count: "exact", head: true }).in("status", ["pending", "processing"]);
  return c.json({
    integrations: status,
    webhookQueueSize: count ?? 0
  });
});
integrationRoutes.get("/sync-history", async (c) => {
  const auth = getAuth(c);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const provider6 = c.req.query("provider");
  const client = createAdminClient();
  let query = client.from("sync_history").select("*").eq("athlete_id", auth.userId).order("created_at", { ascending: false }).limit(Math.min(limit, 100));
  if (provider6) {
    query = query.eq("provider", provider6);
  }
  const { data, error } = await query;
  if (error) {
    return c.json({ error: "Failed to fetch sync history" }, 500);
  }
  return c.json({ history: data || [] });
});

// src/routes/planned-workouts/index.ts
import { createClient as createClient3 } from "@supabase/supabase-js";
import { Hono as Hono8 } from "hono";

// src/middleware/validate.ts
async function parseBody(c, schema) {
  const body = await c.req.json().catch((err) => err instanceof SyntaxError ? null : Promise.reject(err));
  if (body === null) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      400
    );
  }
  return result.data;
}
function isResponse(value) {
  return value instanceof Response;
}

// src/routes/planned-workouts/index.ts
var log20 = createLogger({ module: "planned-workouts" });
var SUPABASE_URL3 = process.env.SUPABASE_URL;
var SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
function getSupabase2() {
  return createClient3(SUPABASE_URL3, SUPABASE_SERVICE_KEY);
}
var plannedWorkoutsRoutes = new Hono8();
plannedWorkoutsRoutes.get("/", async (c) => {
  const { userId, clubId } = getAuth(c);
  const from = c.req.query("from");
  const to = c.req.query("to");
  const status = c.req.query("status");
  if (!from || !to) {
    return c.json({ error: "Missing required query params: from, to" }, 400);
  }
  const supabase = getSupabase2();
  let query = supabase.from("planned_workouts").select("*").eq("athlete_id", userId).eq("club_id", clubId).gte("planned_date", from).lte("planned_date", to).order("planned_date", { ascending: true }).order("sort_order", { ascending: true });
  if (status) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    log20.error({ err: error }, "Failed to fetch planned workouts");
    return c.json({ error: error.message }, 500);
  }
  return c.json({ data });
});
plannedWorkoutsRoutes.get("/:id", async (c) => {
  const { userId } = getAuth(c);
  const id = c.req.param("id");
  const supabase = getSupabase2();
  const { data, error } = await supabase.from("planned_workouts").select("*").eq("id", id).eq("athlete_id", userId).single();
  if (error || !data) {
    return c.json({ error: "Planned workout not found" }, 404);
  }
  return c.json({ data });
});
plannedWorkoutsRoutes.post("/", async (c) => {
  const { userId, clubId } = getAuth(c);
  const body = await parseBody(c, PlannedWorkoutInput);
  if (isResponse(body)) return body;
  const supabase = getSupabase2();
  const { data, error } = await supabase.from("planned_workouts").insert({
    athlete_id: userId,
    club_id: clubId,
    plan_id: body.planId || null,
    planned_date: body.plannedDate,
    planned_time: body.plannedTime || null,
    activity_type: body.activityType,
    title: body.title,
    description: body.description || null,
    duration_min: body.durationMin || null,
    distance_km: body.distanceKm || null,
    target_tss: body.targetTss || null,
    target_rpe: body.targetRpe || null,
    intensity: body.intensity || null,
    session_data: body.sessionData || {},
    status: "planned",
    sort_order: body.sortOrder || 0,
    notes: body.notes || null,
    coach_notes: body.coachNotes || null,
    source: body.source || "MANUAL"
  }).select().single();
  if (error) {
    log20.error({ err: error }, "Failed to create planned workout");
    return c.json({ error: error.message }, 500);
  }
  return c.json({ data }, 201);
});
plannedWorkoutsRoutes.patch("/:id", async (c) => {
  const { userId } = getAuth(c);
  const id = c.req.param("id");
  const body = await parseBody(c, PlannedWorkoutUpdate);
  if (isResponse(body)) return body;
  const updateData = {};
  if (body.plannedDate !== void 0) updateData.planned_date = body.plannedDate;
  if (body.plannedTime !== void 0) updateData.planned_time = body.plannedTime;
  if (body.activityType !== void 0) updateData.activity_type = body.activityType;
  if (body.title !== void 0) updateData.title = body.title;
  if (body.description !== void 0) updateData.description = body.description;
  if (body.durationMin !== void 0) updateData.duration_min = body.durationMin;
  if (body.distanceKm !== void 0) updateData.distance_km = body.distanceKm;
  if (body.targetTss !== void 0) updateData.target_tss = body.targetTss;
  if (body.targetRpe !== void 0) updateData.target_rpe = body.targetRpe;
  if (body.intensity !== void 0) updateData.intensity = body.intensity;
  if (body.sessionData !== void 0) updateData.session_data = body.sessionData;
  if (body.status !== void 0) updateData.status = body.status;
  if (body.sortOrder !== void 0) updateData.sort_order = body.sortOrder;
  if (body.notes !== void 0) updateData.notes = body.notes;
  if (body.coachNotes !== void 0) updateData.coach_notes = body.coachNotes;
  if (Object.keys(updateData).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }
  const supabase = getSupabase2();
  const { data, error } = await supabase.from("planned_workouts").update(updateData).eq("id", id).eq("athlete_id", userId).select().single();
  if (error) {
    log20.error({ err: error }, "Failed to update planned workout");
    return c.json({ error: error.message }, 500);
  }
  return c.json({ data });
});
plannedWorkoutsRoutes.patch("/:id/complete", async (c) => {
  const { userId } = getAuth(c);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const supabase = getSupabase2();
  const { data, error } = await supabase.from("planned_workouts").update({
    status: "completed",
    workout_id: body.workoutId || null
  }).eq("id", id).eq("athlete_id", userId).select().single();
  if (error) {
    log20.error({ err: error }, "Failed to complete planned workout");
    return c.json({ error: error.message }, 500);
  }
  return c.json({ data });
});
plannedWorkoutsRoutes.delete("/:id", async (c) => {
  const { userId } = getAuth(c);
  const id = c.req.param("id");
  const supabase = getSupabase2();
  const { error } = await supabase.from("planned_workouts").delete().eq("id", id).eq("athlete_id", userId);
  if (error) {
    log20.error({ err: error }, "Failed to delete planned workout");
    return c.json({ error: error.message }, 500);
  }
  return c.json({ success: true });
});

// src/routes/webhooks/index.ts
import { Hono as Hono9 } from "hono";

// src/services/integrations/webhook-queue.ts
var log21 = createLogger({ module: "webhook-queue" });
var POLL_INTERVAL_MS = 3e3;
var BATCH_SIZE = 5;
var VISIBILITY_TIMEOUT_SECONDS = 60;
var RETRY_DELAY_SECONDS = 10;
var pollIntervalId = null;
async function enqueueWebhook(provider6, event) {
  const admin = createAdminClient();
  const { error } = await admin.from("webhook_queue").insert({
    provider: provider6,
    event_data: event,
    status: "pending",
    attempts: 0,
    max_attempts: 3
  });
  if (error) {
    log21.error({ err: error, provider: provider6 }, "Failed to enqueue webhook job");
    return;
  }
  log21.info({ provider: provider6 }, "Enqueued webhook job");
  ensurePolling();
}
function ensurePolling() {
  if (pollIntervalId) return;
  log21.info("Starting webhook queue poller");
  pollIntervalId = setInterval(async () => {
    try {
      await pollAndProcess();
    } catch (err) {
      log21.error({ err }, "Queue poller error");
    }
  }, POLL_INTERVAL_MS);
}
async function pollAndProcess() {
  const admin = createAdminClient();
  const { data: jobs, error } = await admin.rpc("claim_webhook_jobs", {
    batch_size: BATCH_SIZE,
    visibility_timeout_seconds: VISIBILITY_TIMEOUT_SECONDS
  });
  if (error) {
    log21.error({ err: error }, "Failed to claim webhook jobs");
    return;
  }
  if (!jobs || jobs.length === 0) return;
  log21.debug({ jobCount: jobs.length }, "Claimed webhook jobs");
  const results = await Promise.allSettled(
    jobs.map(
      (job) => processJob(admin, job)
    )
  );
  for (const result of results) {
    if (result.status === "rejected") {
      log21.error({ err: result.reason }, "Unhandled error in job processing");
    }
  }
}
async function processJob(admin, job) {
  const startMs = Date.now();
  try {
    const provider6 = getProvider(job.provider);
    const ownerId = provider6.extractOwnerIdFromWebhook(job.event_data);
    const activityId = provider6.extractActivityIdFromWebhook(job.event_data);
    const { data: account } = await admin.from("connected_accounts").select("*").eq("provider", job.provider).eq("provider_uid", ownerId).single();
    if (!account) {
      await logSyncResult(admin, {
        provider: job.provider,
        eventType: "webhook",
        status: "skipped",
        errorMessage: `No account for provider UID ${ownerId}`,
        durationMs: Date.now() - startMs
      });
      await admin.rpc("complete_webhook_job", { job_id: job.id });
      return;
    }
    const accessToken = await ensureFreshToken(provider6, account, admin);
    const activity = await provider6.fetchActivity(accessToken, activityId);
    const healthData = provider6.fetchHealthData ? await provider6.fetchHealthData(accessToken, /* @__PURE__ */ new Date()) : [];
    const { data: profile } = await admin.from("profiles").select("club_id").eq("id", account.athlete_id).single();
    if (!profile) {
      await logSyncResult(admin, {
        athleteId: account.athlete_id,
        provider: job.provider,
        eventType: "webhook",
        status: "failed",
        errorMessage: "No profile found",
        durationMs: Date.now() - startMs
      });
      await admin.rpc("complete_webhook_job", { job_id: job.id });
      return;
    }
    const result = await normalizeAndStore(
      [activity],
      healthData,
      account.athlete_id,
      profile.club_id,
      admin
    );
    await admin.from("connected_accounts").update({ last_sync_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", account.id);
    await admin.rpc("complete_webhook_job", { job_id: job.id });
    await logSyncResult(admin, {
      athleteId: account.athlete_id,
      provider: job.provider,
      eventType: "webhook",
      status: "success",
      workoutsAdded: result.workoutsInserted,
      metricsAdded: result.metricsInserted,
      durationMs: Date.now() - startMs
    });
    log21.info(
      {
        provider: job.provider,
        jobId: job.id,
        workoutsInserted: result.workoutsInserted,
        metricsInserted: result.metricsInserted,
        durationMs: Date.now() - startMs
      },
      "Webhook job complete"
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log21.warn({ jobId: job.id, attempt: job.attempts, error: errMsg }, "Webhook job failed");
    await admin.rpc("fail_webhook_job", {
      job_id: job.id,
      err_msg: errMsg,
      retry_delay_seconds: RETRY_DELAY_SECONDS
    });
    if (job.attempts >= 3) {
      await logSyncResult(admin, {
        provider: job.provider,
        eventType: "webhook",
        status: "failed",
        errorMessage: errMsg,
        durationMs: Date.now() - startMs
      });
    }
  }
}
async function logSyncResult(admin, entry) {
  try {
    await admin.from("sync_history").insert({
      athlete_id: entry.athleteId || null,
      provider: entry.provider,
      event_type: entry.eventType,
      status: entry.status,
      workouts_added: entry.workoutsAdded || 0,
      metrics_added: entry.metricsAdded || 0,
      error_message: entry.errorMessage || null,
      duration_ms: entry.durationMs
    });
  } catch (err) {
    log21.error({ err }, "Failed to log sync result");
  }
}
function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
    log21.info("Webhook queue poller stopped");
  }
}

// src/routes/webhooks/index.ts
var log22 = createLogger({ module: "webhooks" });
var webhookRoutes = new Hono9();
async function handleWebhook(providerName, headers, body) {
  const provider6 = getProvider(providerName);
  const valid = await provider6.verifyWebhook(headers, body);
  if (!valid) {
    log22.warn({ provider: providerName }, "Invalid webhook signature");
    return { status: "invalid_signature", code: 401 };
  }
  const event = JSON.parse(body);
  await enqueueWebhook(providerName, event);
  return { status: "accepted", code: 200 };
}
webhookRoutes.post("/strava", async (c) => {
  try {
    const body = await c.req.text();
    const parsed = JSON.parse(body);
    if (parsed.object_type !== "activity" || parsed.aspect_type !== "create") {
      return c.json({ status: "ignored" }, 200);
    }
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const result = await handleWebhook("STRAVA", headers, body);
    return c.json({ status: result.status }, result.code);
  } catch (err) {
    log22.error({ err, provider: "STRAVA" }, "Webhook processing error");
    return c.json({ status: "error" }, 200);
  }
});
webhookRoutes.get("/strava", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  if (mode === "subscribe" && token === INTEGRATION_CONFIG.STRAVA.verifyToken) {
    log22.info("Strava subscription verified");
    return c.json({ "hub.challenge": challenge });
  }
  return c.text("Forbidden", 403);
});
webhookRoutes.post("/garmin", async (c) => {
  try {
    const body = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const result = await handleWebhook("GARMIN", headers, body);
    return c.json({ status: result.status }, result.code);
  } catch (err) {
    log22.error({ err, provider: "GARMIN" }, "Webhook processing error");
    return c.json({ status: "error" }, 200);
  }
});
webhookRoutes.post("/polar", async (c) => {
  try {
    const body = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const result = await handleWebhook("POLAR", headers, body);
    return c.json({ status: result.status }, result.code);
  } catch (err) {
    log22.error({ err, provider: "POLAR" }, "Webhook processing error");
    return c.json({ status: "error" }, 200);
  }
});
webhookRoutes.post("/wahoo", async (c) => {
  try {
    const body = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const result = await handleWebhook("WAHOO", headers, body);
    return c.json({ status: result.status }, result.code);
  } catch (err) {
    log22.error({ err, provider: "WAHOO" }, "Webhook processing error");
    return c.json({ status: "error" }, 200);
  }
});

// src/server.ts
var app = new OpenAPIHono();
app.onError((err, c) => {
  logger.error({ err, path: c.req.path, method: c.req.method }, "Unhandled error");
  return c.json(
    {
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "production" ? void 0 : err.stack
    },
    500
  );
});
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (origin && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return origin;
      }
      const allowed = [
        process.env.WEB_URL,
        "https://jpx-workout-web.azurewebsites.net",
        "https://jpx.nu"
      ].filter(Boolean);
      if (origin && allowed.includes(origin)) {
        return origin;
      }
      return allowed[0] || "http://localhost:3000";
    },
    credentials: true
  })
);
app.use("/api/*", bodyLimit({ maxSize: 2 * 1024 * 1024 }));
app.use("/api/ai/*", bodyLimit({ maxSize: 12 * 1024 * 1024 }));
app.get(
  "/health",
  (c) => c.json({
    status: "ok",
    version: "0.1.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    runtime: `Node.js ${process.version}`
  })
);
app.route("/webhooks", webhookRoutes);
app.use("/api/*", jwtAuth(), extractClaims);
app.use("/api/ai/*", rateLimit(RATE_LIMITS.aiChat));
var routes = app.route("/api/ai", aiRoutes).route("/api/ai", aiStreamRoutes).route("/api/planned-workouts", plannedWorkoutsRoutes).route("/api/integrations", integrationRoutes);
app.doc("/api/doc", {
  openapi: "3.1.0",
  info: {
    title: "Triathlon AI Coaching API",
    version: "0.1.0",
    description: "REST API for the triathlon AI coaching platform"
  }
});
app.get("/api/reference", swaggerUI({ url: "/api/doc" }));
var port = parseInt(process.env.PORT || "8787", 10);
logger.info({ port }, "Triathlon AI API server starting");
var server = serve({
  fetch: app.fetch,
  port
});
function shutdown(signal) {
  logger.info({ signal }, "Shutdown signal received \u2014 closing gracefully");
  stopPolling();
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("Forced shutdown after 10s timeout");
    process.exit(1);
  }, 1e4).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
var server_default = app;
export {
  server_default as default
};
//# sourceMappingURL=server.js.map
