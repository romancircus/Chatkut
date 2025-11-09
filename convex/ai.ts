/**
 * AI Actions for ChatKut
 *
 * Handles chat responses, code generation, and edit plan creation
 * using multi-model routing for optimal cost/quality balance.
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import {
  generateChatResponse,
  generateEditPlan as generateEditPlanViaDedalus,
  generateRemotionCode as generateRemotionCodeViaDedalus,
} from "@/lib/dedalus/client";
import type { EditPlan } from "@/types/composition-ir";

// Get Anthropic API key from environment
// TEMPORARY: Using Anthropic directly until Dedalus TypeScript SDK is production-ready
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
    // TODO: Re-enable authentication after testing
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new Error("Not authenticated");
    // }
    // const userId = identity.subject as any;

    const userId = "temp_user_1" as any; // Temporary for testing

    // Save user message
    await ctx.runMutation(api.ai.saveChatMessage, {
      projectId,
      userId,
      role: "user",
      content: message,
    });

    // Validate API key
    if (!ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY not configured. Run: npx convex env set ANTHROPIC_API_KEY \"sk-ant-your-key\""
      );
    }

    // Get project context (composition, assets, etc.)
    const project = await ctx.runQuery(api.ai.getProjectContext, { projectId });

    // Get chat history
    const history = await ctx.runQuery(api.ai.getChatMessages, { projectId, limit: 10 });

    // Generate AI response using Anthropic SDK
    const response = await generateChatResponse(
      ANTHROPIC_API_KEY,
      message,
      {
        assets: project?.assets || [],
        composition: project?.composition || null,
        history: history || [],
      }
    );

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
      tokenUsage: response.tokens,
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
    // Validate API key
    if (!ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY not configured. Run: npx convex env set ANTHROPIC_API_KEY \"sk-ant-your-key\""
      );
    }

    // Get composition IR
    const composition = await ctx.runQuery(api.ai.getComposition, { compositionId });

    if (!composition) {
      throw new Error("Composition not found");
    }

    // Generate edit plan using Anthropic SDK
    const plan = await generateEditPlanViaDedalus(
      ANTHROPIC_API_KEY,
      userMessage,
      composition.ir
    );

    // TODO: Re-enable authentication after testing
    // const identity = await ctx.auth.getUserIdentity();
    // const userId = identity?.subject as any;
    const userId = "temp_user_1" as any; // Temporary for testing

    // Track AI usage
    if (userId) {
      await ctx.runMutation(api.ai.trackAIUsage, {
        userId,
        projectId,
        task: "plan-generation",
        model: "claude-sonnet-4-5", // From MODEL_ROUTING
        provider: "anthropic",
        tokenUsage: undefined,
        cost: undefined, // Cost tracked in Dedalus response
      });
    }

    return {
      plan,
      model: "claude-sonnet-4-5",
    };
  },
});

/**
 * Generate Remotion code from composition IR
 *
 * IMPORTANT: Uses template-based compilation (deterministic, fast, free)
 * instead of LLM generation (expensive, slow, non-deterministic)
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

    // Use template-based compilation (free, fast, deterministic)
    // The compiler is in lib/composition-engine/compiler.ts
    // Since Convex actions can't import from lib, we inline a simplified version
    const code = compileIRToCode(composition.ir);

    // Update composition with generated code
    await ctx.runMutation(api.ai.updateCompositionCode, {
      compositionId,
      code,
    });

    return {
      code,
      model: "template-compiler", // Not using LLM!
    };
  },
});

/**
 * Simplified IR compiler for Convex
 * Full version in lib/composition-engine/compiler.ts
 */
function compileIRToCode(ir: any): string {
  const componentName = `Composition_${ir.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const elements = ir.elements.map((el: any) => renderElement(el)).join("\n      ");

  return `/**
 * Auto-generated Remotion composition
 * ID: ${ir.id}
 * Version: ${ir.version}
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
} from "remotion";

export const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      ${elements}
    </AbsoluteFill>
  );
};
`;
}

function renderElement(element: any): string {
  return `<Sequence
        from={${element.from}}
        durationInFrames={${element.durationInFrames}}
        data-element-id="${element.id}"
      >
        ${renderElementContent(element)}
      </Sequence>`;
}

function renderElementContent(element: any): string {
  const { type, properties } = element;

  switch (type) {
    case "video":
      return `<Video
          src="${properties.src || ""}"
          volume={${properties.volume || 1}}
        />`;
    case "audio":
      return `<Audio
          src="${properties.src || ""}"
          volume={${properties.volume || 1}}
        />`;
    case "text":
      return `<div style={{
          fontSize: ${properties.fontSize || 48},
          color: "${properties.color || "#fff"}",
          textAlign: "${properties.textAlign || "center"}",
        }}>
          {${JSON.stringify(properties.text || "")}}
        </div>`;
    case "image":
      return `<Img
          src="${properties.src || ""}"
        />`;
    default:
      return `{/* Unknown type: ${type} */}`;
  }
}

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
 * Delete a chat message
 */
export const deleteChatMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
  },
  handler: async (ctx, { messageId }) => {
    await ctx.db.delete(messageId);
  },
});

/**
 * Clear all chat messages for a project
 */
export const clearChatMessages = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
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
