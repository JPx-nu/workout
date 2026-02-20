// ============================================================
// LangGraph Agent — ReAct StateGraph
// The core orchestration: LLM ↔ Tools loop with streaming
// ============================================================

import { StateGraph, MessagesAnnotation, END } from '@langchain/langgraph';
import { AzureChatOpenAI } from '@langchain/openai';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_CONFIG } from '../../config/ai.js';
import { buildSystemPrompt } from './prompt.js';
import { getProfile, getDailyLogs, getRecentMemories } from './supabase.js';
import { createAllTools } from './tools/index.js';

/**
 * Creates a compiled LangGraph agent for a specific user session.
 *
 * Architecture:
 *   ┌──────────┐     tool_calls     ┌───────────┐
 *   │ llmCall  │ ──────────────────► │ toolNode  │
 *   │          │ ◄────────────────── │           │
 *   └──────────┘    tool results     └───────────┘
 *        │
 *        │ no tool_calls
 *        ▼
 *      [END]
 */
export async function createAgent(
    client: SupabaseClient,
    userId: string,
    clubId: string
) {
    // Load profile + today's readiness data + memories for system prompt context
    const profile = await getProfile(client, userId);
    const memories = await getRecentMemories(client, userId, 10);
    const today = new Date().toISOString().split('T')[0];
    const dailyLogs = await getDailyLogs(client, userId, {
        fromDate: today,
        toDate: today,
        limit: 1,
    });
    const todayLog = dailyLogs.length > 0 ? dailyLogs[0] : null;

    // Create LLM instance — uses AzureChatOpenAI for Azure Foundry compatibility
    const llm = new AzureChatOpenAI({
        azureOpenAIEndpoint: AI_CONFIG.azure.endpoint,
        azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
        azureOpenAIApiDeploymentName: AI_CONFIG.azure.deploymentName,
        azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
        temperature: AI_CONFIG.model.temperature,
        streaming: AI_CONFIG.features.streaming,
        // gpt-5-mini requires max_completion_tokens instead of max_tokens
        modelKwargs: { max_completion_tokens: AI_CONFIG.model.maxCompletionTokens },
    });

    // Create tools bound to user context
    const tools = createAllTools(client, userId, clubId);

    // Bind tools to the LLM
    const llmWithTools = llm.bindTools(tools);

    // Build the system prompt
    const systemMessage = new SystemMessage(buildSystemPrompt(profile, todayLog, memories));

    // ── Define graph nodes ────────────────────────────────────

    /** LLM call node: injects system prompt + invokes the model */
    async function llmCall(state: typeof MessagesAnnotation.State) {
        // Prepend system message to the conversation
        const messagesWithSystem = [systemMessage, ...state.messages];

        const response = await llmWithTools.invoke(messagesWithSystem);

        return { messages: [response] };
    }

    /** Route: check if the LLM wants to call tools or is done */
    function shouldContinue(state: typeof MessagesAnnotation.State): 'tools' | typeof END {
        const lastMessage = state.messages[state.messages.length - 1];

        // If the last message has tool_calls, route to the tool node
        if (
            lastMessage &&
            'tool_calls' in lastMessage &&
            (lastMessage as AIMessage).tool_calls &&
            (lastMessage as AIMessage).tool_calls!.length > 0
        ) {
            return 'tools';
        }

        return END;
    }

    // ── Build the graph ───────────────────────────────────────

    const toolNode = new ToolNode(tools);

    const graph = new StateGraph(MessagesAnnotation)
        .addNode('llmCall', llmCall)
        .addNode('tools', toolNode)
        .addEdge('__start__', 'llmCall')
        .addConditionalEdges('llmCall', shouldContinue, {
            tools: 'tools',
            [END]: END,
        })
        .addEdge('tools', 'llmCall')
        .compile();

    return graph;
}

/**
 * Converts stored chat history into LangChain message objects.
 * Supports multimodal messages — when metadata.imageUrls is present,
 * builds a content array with text + image_url items for vision models.
 */
export function toBaseMessages(
    history: Array<{ role: string; content: string; metadata?: Record<string, unknown> | null }>
): BaseMessage[] {
    return history.map((msg) => {
        // Build multimodal content when images are attached
        const imageUrls = (msg.metadata?.imageUrls as string[] | undefined) ?? [];
        const content =
            msg.role === 'user' && imageUrls.length > 0
                ? [
                    { type: 'text' as const, text: msg.content },
                    ...imageUrls.map((url) => ({
                        type: 'image_url' as const,
                        image_url: { url },
                    })),
                ]
                : msg.content;

        switch (msg.role) {
            case 'user':
                return new HumanMessage({ content });
            case 'assistant':
                return new AIMessage(msg.content);
            case 'system':
                return new SystemMessage(msg.content);
            default:
                return new HumanMessage({ content });
        }
    });
}
