import { Hono } from 'hono';
import { checkInput, processOutput, classifyIntent } from '../../services/ai/safety.js';
import { getAuth } from '../../middleware/auth.js';

export const aiRoutes = new Hono();

// AI Coach chat endpoint
aiRoutes.post('/chat', async (c) => {
    const body = await c.req.json();

    // ── Input validation ───────────────────────────────────────
    const message = typeof body.message === 'string' ? body.message : '';
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : undefined;

    // ── Safety check — blocks emergency content ────────────────
    const safetyCheck = checkInput(message);
    if (safetyCheck.blocked) {
        return c.json({
            role: 'assistant',
            content: safetyCheck.response,
            conversationId: conversationId || crypto.randomUUID(),
            metadata: {
                model: 'safety-guard',
                blocked: true,
                reason: safetyCheck.reason,
            },
        });
    }

    // ── Classify intent for routing ────────────────────────────
    const intent = classifyIntent(message);
    const auth = getAuth(c);

    // TODO: Phase 3 — Connect to LangGraph agent
    // Placeholder response until LangGraph is wired up
    const rawContent = `🏊‍♂️ AI Coach is being set up! Your message: "${message}"`;

    // ── Output safety processing ───────────────────────────────
    const processed = processOutput(rawContent, {
        confidence: 0.85,
        hasMedicalContent: intent === 'medical',
    });

    return c.json({
        role: 'assistant',
        content: processed.content,
        conversationId: conversationId || crypto.randomUUID(),
        metadata: {
            model: 'placeholder',
            phase: 'Phase 1 — Iron Core',
            intent,
            athleteId: auth.userId,
            clubId: auth.clubId,
            disclaimerAdded: processed.disclaimerAdded,
            piiRedacted: processed.piiRedacted,
        },
    });
});

// List conversations
aiRoutes.get('/conversations', async (c) => {
    const auth = getAuth(c);
    // TODO: Phase 3 — Fetch from Supabase filtered by auth.userId + auth.clubId
    return c.json({ conversations: [], athleteId: auth.userId });
});
