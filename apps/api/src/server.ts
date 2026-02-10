import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { serve } from '@hono/node-server';
import { webhookRoutes } from './routes/webhooks/index.js';
import { aiRoutes } from './routes/ai/chat.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
}));

// Health check
app.get('/health', (c) => c.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    runtime: `Node.js ${process.version}`,
}));

// Route groups
app.route('/webhooks', webhookRoutes);
app.route('/api/ai', aiRoutes);

// Start server
const port = parseInt(process.env.PORT || '8787');

console.log(`🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon AI API server starting on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});

export default app;
