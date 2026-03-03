/**
 * MCP Server Route — Exposes all 21 AI tools via Model Context Protocol.
 *
 * Stateless per-request: each HTTP request creates a fresh McpServer +
 * WebStandardStreamableHTTPServerTransport. Auth context comes from JWT
 * on each request (same middleware as REST API routes).
 *
 * Clients: Claude Desktop, Cursor, any MCP-compatible agent.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import { getAuth, getJwt } from "../../middleware/auth.js";
import { createUserClient } from "../../services/ai/supabase.js";
import { registerMcpTools } from "./tools.js";

const log = createLogger({ module: "mcp-server" });

export const mcpRoutes = new Hono();

mcpRoutes.all("/", async (c) => {
	const auth = getAuth(c);
	const client = createUserClient(getJwt(c));

	const server = new McpServer(
		{ name: "triathlon-coach", version: "1.0.0" },
		{ capabilities: { logging: {} } },
	);

	registerMcpTools(server, client, auth.userId, auth.clubId);

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined, // stateless — no session tracking
	});

	await server.connect(transport);

	try {
		return await transport.handleRequest(c.req.raw);
	} catch (err) {
		log.error({ err, userId: auth.userId }, "MCP request failed");
		await server.close();
		return c.json(
			{
				jsonrpc: "2.0",
				error: { code: -32603, message: "Internal server error" },
				id: null,
			},
			500,
		);
	}
});
