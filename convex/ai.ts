/**
 * AI Actions for ChatKut
 *
 * Handles chat responses, code generation, and edit plan creation
 * using multi-model routing for optimal cost/quality balance.
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getAIClient, MODEL_ROUTING } from "@/lib/dedalus/client";
import type { EditPlan } from "@/types/composition-ir";

/**
 * Send a chat message and get AI response
 */
export const sendChatMessage = action({
  args: {
    projectId: v.id("projects"),
    message: v.string(),
  },
  handler: async (ctx, { projectId, message }): Promise<{
    messageId: any;
    content: string;
    model: string;
  }> => {
    // Get user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject as any; // Will be proper ID once we have users table

    // Save user message
    await ctx.runMutation(api.ai.saveChatMessage, {
      projectId,
      userId,
      role: "user",
      content: message,
    });

    // Get project context (composition, assets, etc.)
    const project = await ctx.runQuery(api.ai.getProjectContext, { projectId });

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(project);

    // Generate AI response
    const aiClient = getAIClient();
    const response = await aiClient.generateText({
      task: "chat-response",
      systemPrompt,
      prompt: message,
      temperature: 0.7,
    });

    // Save assistant response
    const assistantMessageId = await ctx.runMutation(api.ai.saveChatMessage, {
      projectId,
      userId,
      role: "assistant",
      content: response.text,
    });

    // Track AI usage
    await ctx.runMutation(api.ai.trackAIUsage, {
      userId,
      projectId,
      task: "chat-response",
      model: response.model,
      provider: response.provider,
      tokenUsage: response.tokenUsage,
      cost: response.cost,
    });

    return {
      messageId: assistantMessageId,
      content: response.text,
      model: response.model,
    };
  },
});

/**
 * Generate an edit plan from user message
 */
export const generateEditPlan = action({
  args: {
    projectId: v.id("projects"),
    compositionId: v.id("compositions"),
    userMessage: v.string(),
  },
  handler: async (ctx, { projectId, compositionId, userMessage }): Promise<{
    plan: EditPlan;
    model: string;
  }> => {
    // Get composition IR
    const composition = await ctx.runQuery(api.ai.getComposition, { compositionId });

    if (!composition) {
      throw new Error("Composition not found");
    }

    // Build system prompt for plan generation
    const systemPrompt = `You are a video editing assistant that outputs structured Edit Plans.

Current Composition IR:
${JSON.stringify(composition.ir, null, 2)}

User Request: "${userMessage}"

Output a JSON Edit Plan with this EXACT structure:
{
  "operation": "add" | "update" | "delete" | "move",
  "selector": {
    "type": "byLabel" | "byId" | "byIndex" | "byType",
    // selector-specific fields
  },
  "changes": {
    // operation-specific changes
  },
  "reasoning": "Brief explanation of what this plan does"
}

Use selectors that are unambiguous. If the user says "second clip",
use { "type": "byType", "elementType": "video", "index": 1 }.

Examples:
- "Make the second video clip zoom in slowly":
  {"operation": "update", "selector": {"type": "byType", "elementType": "video", "index": 1}, "changes": {"animation": {"property": "scale", "keyframes": [{"frame": 0, "value": 1.0}, {"frame": 90, "value": 1.2}], "easing": "ease-in"}}}

- "Add text saying Hello":
  {"operation": "add", "selector": {"type": "byIndex", "index": 0}, "changes": {"type": "text", "properties": {"text": "Hello", "fontSize": 48}, "from": 0, "durationInFrames": 90}}

Respond ONLY with valid JSON.`;

    // Generate edit plan
    const aiClient = getAIClient();
    const response = await aiClient.generateJSON<EditPlan>({
      task: "plan-generation",
      systemPrompt,
      prompt: userMessage,
    });

    // Get user ID for tracking
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as any;

    // Track AI usage
    if (userId) {
      await ctx.runMutation(api.ai.trackAIUsage, {
        userId,
        projectId,
        task: "plan-generation",
        model: response.model,
        provider: response.provider,
        tokenUsage: undefined,
        cost: response.cost,
      });
    }

    return {
      plan: response.data,
      model: response.model,
    };
  },
});

/**
 * Generate Remotion code from composition IR
 */
export const generateRemotionCode = action({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }): Promise<{
    code: string;
    model: string;
  }> => {
    // Get composition IR
    const composition = await ctx.runQuery(api.ai.getComposition, { compositionId });

    if (!composition) {
      throw new Error("Composition not found");
    }

    // Build system prompt for code generation
    const systemPrompt = `You are an expert at generating Remotion React components from Composition IR.

Given this Composition IR:
${JSON.stringify(composition.ir, null, 2)}

Generate a complete Remotion component that:
1. Uses proper Remotion imports (Sequence, Video, Audio, useCurrentFrame, interpolate, etc.)
2. Includes data-element-id attributes on all elements for tracking
3. Implements all animations using interpolate()
4. Handles all element properties correctly
5. Is type-safe TypeScript with React 18

Output ONLY the React component code, no markdown, no explanation.`;

    const aiClient = getAIClient();
    const response = await aiClient.generateText({
      task: "code-generation",
      systemPrompt,
      prompt: "Generate the Remotion component",
      temperature: 0.3, // Lower temperature for more deterministic code
      maxTokens: 8192,
    });

    // Extract code from markdown if needed
    let code = response.text.trim();
    const codeMatch = code.match(/```(?:typescript|tsx|jsx)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      code = codeMatch[1];
    }

    // Update composition with generated code
    await ctx.runMutation(api.ai.updateCompositionCode, {
      compositionId,
      code,
    });

    // Track AI usage
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject as any;
    if (userId) {
      await ctx.runMutation(api.ai.trackAIUsage, {
        userId,
        projectId: composition.projectId,
        task: "code-generation",
        model: response.model,
        provider: response.provider,
        tokenUsage: response.tokenUsage,
        cost: response.cost,
      });
    }

    return {
      code,
      model: response.model,
    };
  },
});

// ==================== Mutations ====================

/**
 * Save a chat message
 */
export const saveChatMessage = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(), // Will be v.id("users") once auth is set up
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    editPlan: v.optional(v.any()),
    receipt: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, userId, role, content, editPlan, receipt }) => {
    return await ctx.db.insert("chatMessages", {
      projectId,
      userId: userId as any, // Temporary until users table is set up
      role,
      content,
      editPlan,
      receipt,
      timestamp: Date.now(),
    });
  },
});

/**
 * Update composition code
 */
export const updateCompositionCode = mutation({
  args: {
    compositionId: v.id("compositions"),
    code: v.string(),
  },
  handler: async (ctx, { compositionId, code }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    await ctx.db.patch(compositionId, {
      code,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Track AI usage (for cost monitoring)
 */
export const trackAIUsage = mutation({
  args: {
    userId: v.string(),
    projectId: v.id("projects"),
    task: v.string(),
    model: v.string(),
    provider: v.string(),
    tokenUsage: v.optional(
      v.object({
        input: v.number(),
        output: v.number(),
        total: v.number(),
      })
    ),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // For now, just log it
    // In production, store in a telemetry table
    console.log("[AI Usage]", {
      task: args.task,
      model: args.model,
      provider: args.provider,
      tokens: args.tokenUsage?.total,
      cost: args.cost?.toFixed(4),
    });
  },
});

// ==================== Queries ====================

/**
 * Get project context for AI
 */
export const getProjectContext = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);

    if (!project) {
      return null;
    }

    // Get recent chat messages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(10);

    // Get assets
    const assets = await ctx.db
      .query("assets")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Get composition (if exists)
    const compositions = await ctx.db
      .query("compositions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return {
      project,
      messages: messages.reverse(),
      assets,
      composition: compositions[0] || null,
    };
  },
});

/**
 * Get composition
 */
export const getComposition = query({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }) => {
    return await ctx.db.get(compositionId);
  },
});

/**
 * Get chat messages for a project
 */
export const getChatMessages = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 50 }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("asc")
      .take(limit);

    return messages;
  },
});

// ==================== Helper Functions ====================

/**
 * Build system prompt with project context
 */
function buildSystemPrompt(project: any): string {
  if (!project) {
    return "You are a helpful video editing assistant for ChatKut.";
  }

  const { project: projectData, assets, composition, messages } = project;

  let prompt = `You are ChatKut, an AI video editing assistant.

Project: ${projectData?.name || "Untitled Project"}

Available Assets:
${assets.map((a: any) => `- ${a.filename} (${a.type}, ${a.status})`).join("\n") || "None"}

`;

  if (composition) {
    prompt += `Current Composition:
- ${composition.ir.elements.length} elements
- ${composition.ir.metadata.width}x${composition.ir.metadata.height} @ ${composition.ir.metadata.fps}fps
- Duration: ${composition.ir.metadata.durationInFrames} frames
`;
  }

  prompt += `
You help users create and edit videos through natural conversation.
When users ask to edit their video, provide clear confirmation of what you'll do.
Always be concise and friendly.`;

  return prompt;
}
