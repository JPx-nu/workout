// ============================================================
// Tool: Traverse Athlete Graph
// Explores the athlete's knowledge graph (gear, peers, coaches)
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export function createTraverseGraphTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async ({ maxDepth = 2, edgeTypes }) => {
			// The starting node is the athlete's user profile ID
			// Make sure the graph has matching nodes
			const { data, error } = await client.rpc("traverse_athlete_graph", {
				start_node_id: userId,
				max_depth: maxDepth,
				edge_types: edgeTypes ?? null,
			});

			if (error) {
				return `Error traversing memory graph: ${error.message}`;
			}

			if (!data || data.length === 0) {
				return "No relationships found in the athlete graph.";
			}

			return JSON.stringify(
				data.map((d: any) => ({
					id: d.node_id,
					label: d.node_label,
					type: d.node_type,
					path: d.path_names.join(" -> "),
					depth: d.depth,
				})),
			);
		},
		{
			name: "traverse_athlete_graph",
			description:
				"Traverses the knowledge graph to find relationships for the athlete, such as their coach, teammates, preferred gear (bikes, shoes), and historic achievements.",
			schema: z.object({
				maxDepth: z
					.number()
					.optional()
					.describe("How many hops to traverse (default 2)"),
				edgeTypes: z
					.array(z.string())
					.optional()
					.describe(
						'Optional array of edge labels to follow (e.g. ["uses_gear", "coached_by"])',
					),
			}),
		},
	);
}
