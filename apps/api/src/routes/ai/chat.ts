import { Hono } from 'hono';

export const aiRoutes = new Hono();

// AI Coach chat endpoint
aiRoutes.post('/chat', async (c) => {
    // TODO: Phase 3 — Connect to LangGraph agent
    const { message, conversationId } = await c.req.json();

    // Placeholder response until LangGraph is wired up
    return c.json({
        role: 'assistant',
        content: `🏊‍♂️ AI Coach is being set up! Your message: "${message}"`,
        conversationId: conversationId || crypto.randomUUID(),
        metadata: {
            model: 'placeholder',
            phase: 'Phase 1 — Iron Core',
        },
    });
});

// List conversations
aiRoutes.get('/conversations', async (c) => {
    // TODO: Phase 3 — Fetch from Supabase
    return c.json({ conversations: [] });
});
