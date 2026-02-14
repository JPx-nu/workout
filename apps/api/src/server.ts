import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';
import { webhookRoutes } from './routes/webhooks/index.js';
import { aiRoutes } from './routes/ai/chat.js';
import { jwtAuth, extractClaims } from './middleware/auth.js';
import { rateLimit, RATE_LIMITS } from './middleware/rate-limit.js';

const app = new Hono();

// ── Global middleware ──────────────────────────────────────────
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
}));

// ── Health check (public) ──────────────────────────────────────
app.get('/health', (c) => c.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    runtime: `Node.js ${process.version}`,
}));

// ── Webhook routes (signature-verified, no JWT) ────────────────
app.route('/webhooks', webhookRoutes);

// ── Protected API routes ───────────────────────────────────────
// JWT auth + claims extraction for all /api/* routes
app.use('/api/*', jwtAuth(), extractClaims);

// Rate limiting for AI endpoints
app.use('/api/ai/*', rateLimit(RATE_LIMITS.aiChat));

// Route groups
app.route('/api/ai', aiRoutes);

// ── Start server ───────────────────────────────────────────────
const port = parseInt(process.env.PORT || '8787');

console.log(`🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon AI API server starting on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});

export default app;
