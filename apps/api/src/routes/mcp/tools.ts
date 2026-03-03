/**
 * MCP Tool Bridge — Registers LangChain tools on an MCP server.
 *
 * Each tool reuses the same factory/invoke logic from the AI agent layer.
 * No tool logic is duplicated — we simply delegate to `lcTool.invoke(args)`.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAllTools } from "../../services/ai/tools/index.js";

/** Minimal interface covering the LangChain tool properties we bridge to MCP */
interface BridgeableTool {
	name: string;
	description: string;
	schema: { shape: ZodRawShapeCompat };
	invoke(args: Record<string, unknown>): Promise<string>;
}

export function registerMcpTools(
	server: McpServer,
	client: SupabaseClient,
	userId: string,
	clubId: string,
) {
	const lcTools = createAllTools(client, userId, clubId) as BridgeableTool[];

	for (const lcTool of lcTools) {
		server.registerTool(
			lcTool.name,
			{
				description: lcTool.description,
				inputSchema: lcTool.schema.shape,
			},
			async (args) => {
				const result = await lcTool.invoke(args);
				return {
					content: [
						{
							type: "text" as const,
							text: typeof result === "string" ? result : JSON.stringify(result),
						},
					],
				};
			},
		);
	}
}
