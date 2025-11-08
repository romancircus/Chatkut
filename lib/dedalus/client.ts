/**
 * Dedalus AI Client Wrapper
 *
 * Provides unified interface for multi-model AI access through Dedalus SDK.
 * Routes different tasks to optimal models for cost/quality balance.
 *
 * @see PRIORITIZED_IMPLEMENTATION_PLAN.md Task 1.3
 */

import { Dedalus } from "dedalus-labs";
import type { Completion } from "dedalus-labs/resources/chat";

// Model routing strategy
export type ModelTask =
  | "code-generation" // Complex Remotion code creation
  | "chat-response" // User chat interactions
  | "simple-edit" // Basic property updates
  | "plan-generation" // Edit plan generation
  | "code-analysis"; // Understanding existing code

// Model selection based on task
export const MODEL_ROUTING: Record<
  ModelTask,
  {
    model: string | string[];
    temperature: number;
    reasoning: string;
    agent_attributes?: Record<string, number>;
  }
> = {
  "code-generation": {
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.3, // Low for determinism
    reasoning: "Best code quality, understands Remotion/React patterns",
    agent_attributes: { accuracy: 0.9, intelligence: 0.9 },
  },
  "plan-generation": {
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.3, // Low for determinism
    reasoning: "Excellent structured output, precise edit plans",
    agent_attributes: { accuracy: 0.95, intelligence: 0.9 },
  },
  "code-analysis": {
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.5,
    reasoning: "Deep understanding of code structure",
    agent_attributes: { intelligence: 0.9, accuracy: 0.85 },
  },
  "chat-response": {
    model: ["gpt-4o-mini", "gpt-4o", "claude-3-5-sonnet-20241022"],
    temperature: 0.7,
    reasoning: "Multi-model routing for balanced cost/quality",
    agent_attributes: { friendliness: 0.9, efficiency: 0.8 },
  },
  "simple-edit": {
    model: "gpt-4o-mini",
    temperature: 0.5,
    reasoning: "Fast and cheap for simple property updates",
    agent_attributes: { efficiency: 0.9, speed: 0.9 },
  },
};

/**
 * AI Client singleton
 */
let dedalusClientInstance: Dedalus | null = null;

export function getAIClient(apiKey?: string): Dedalus {
  // Use provided API key or environment variable
  const key = apiKey || process.env.DEDALUS_API_KEY;

  if (!key) {
    throw new Error(
      "DEDALUS_API_KEY not configured. Run: npx convex env set DEDALUS_API_KEY \"your-key\""
    );
  }

  if (!dedalusClientInstance) {
    console.log("[dedalus:client] Initializing Dedalus SDK...");
    dedalusClientInstance = new Dedalus({
      apiKey: key,
    });
    console.log("[dedalus:client] Dedalus SDK initialized ✅");
  }

  return dedalusClientInstance;
}

/**
 * Generate chat response
 * Uses multi-model routing for balanced cost/quality
 */
export async function generateChatResponse(
  apiKey: string,
  message: string,
  context: {
    assets: any[];
    composition: any;
    history: any[];
  }
): Promise<{
  text: string;
  model: string;
  provider: string;
  cost?: number;
  tokens?: { input: number; output: number; total: number };
}> {
  console.log("[dedalus:chat] Generating response for:", message.slice(0, 50) + "...");

  const routing = MODEL_ROUTING["chat-response"];
  const systemPrompt = buildChatSystemPrompt(context);

  try {
    const client = getAIClient(apiKey);

    // Call Dedalus SDK with multi-model routing
    const response = await client.chat.create({
      model: routing.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: routing.temperature,
      max_tokens: 1000,
      agent_attributes: routing.agent_attributes,
    });

    console.log("[dedalus:chat] Response generated:", {
      model: response.model,
      tokens: response.usage?.total_tokens || 0,
    });

    return {
      text: response.choices[0]?.message?.content || "",
      model: response.model,
      provider: "dedalus", // Dedalus routes to appropriate provider
      tokens: response.usage
        ? {
            input: response.usage.prompt_tokens,
            output: response.usage.completion_tokens,
            total: response.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    console.error("[dedalus:chat] Error generating response:", error);
    throw new Error(`Failed to generate chat response: ${error}`);
  }
}

/**
 * Generate edit plan
 * Uses Claude Sonnet for precise structured output
 */
export async function generateEditPlan(
  apiKey: string,
  userMessage: string,
  compositionIR: any
): Promise<any> {
  console.log("[dedalus:plan] Generating edit plan for:", userMessage.slice(0, 50) + "...");

  const routing = MODEL_ROUTING["plan-generation"];
  const systemPrompt = buildEditPlanSystemPrompt(compositionIR);

  try {
    const client = getAIClient(apiKey);

    // Call Dedalus SDK
    const response = await client.chat.create({
      model: routing.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: routing.temperature,
      max_tokens: 2000,
      agent_attributes: routing.agent_attributes,
    });

    const text = response.choices[0]?.message?.content || "";

    console.log("[dedalus:plan] Plan generated");

    // Try to parse JSON from response
    try {
      const json = JSON.parse(text);
      return json;
    } catch {
      // If not valid JSON, return as-is
      return { text };
    }
  } catch (error) {
    console.error("[dedalus:plan] Error generating plan:", error);
    throw new Error(`Failed to generate edit plan: ${error}`);
  }
}

/**
 * Generate Remotion code
 * Uses Claude Sonnet for best code quality
 */
export async function generateRemotionCode(
  apiKey: string,
  compositionIR: any
): Promise<{
  code: string;
  model: string;
  provider: string;
  cost?: number;
}> {
  console.log("[dedalus:code] Generating Remotion code for composition:", compositionIR.id);

  const routing = MODEL_ROUTING["code-generation"];
  const systemPrompt = buildCodeGenerationSystemPrompt();
  const prompt = `Generate Remotion TypeScript code for this composition:\n\n${JSON.stringify(compositionIR, null, 2)}`;

  try {
    const client = getAIClient(apiKey);

    const response = await client.chat.create({
      model: routing.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: routing.temperature,
      max_tokens: 4096,
      agent_attributes: routing.agent_attributes,
    });

    console.log("[dedalus:code] Code generated successfully");

    return {
      code: response.choices[0]?.message?.content || "",
      model: response.model,
      provider: "dedalus",
    };
  } catch (error) {
    console.error("[dedalus:code] Error generating code:", error);
    throw new Error(`Failed to generate Remotion code: ${error}`);
  }
}

/**
 * Build chat system prompt with context
 */
function buildChatSystemPrompt(context: any): string {
  const assetsList = context.assets
    ?.map((a: any) => `- ${a.filename} (${a.type})`)
    .join("\n") || "No assets uploaded yet";

  const elementsList = context.composition?.elements
    ?.map((e: any) => `- ${e.type} "${e.label || e.id}" (${e.durationInFrames} frames)`)
    .join("\n") || "No elements yet";

  return `You are ChatKut, an AI video editing assistant.

Available assets in this project:
${assetsList}

Current composition:
- Duration: ${context.composition?.metadata?.durationInFrames || 0} frames
- FPS: ${context.composition?.metadata?.fps || 30}
- Elements: ${context.composition?.elements?.length || 0}
${elementsList}

Respond naturally to user questions about video editing. Help them add elements, apply effects, and understand their composition.

When the user asks to edit the video, acknowledge what you'll do and confirm the action.`;
}

/**
 * Build edit plan system prompt
 */
function buildEditPlanSystemPrompt(compositionIR: any): string {
  return `Generate a structured edit plan for the user's request.

Current composition:
${JSON.stringify(compositionIR, null, 2)}

Return a JSON object with this structure:
{
  "operations": [
    {
      "action": "add" | "update" | "delete" | "move",
      "selector": { "type": "byId" | "byLabel" | "byType" | "byIndex", ... },
      "changes": { ... }
    }
  ]
}

Rules:
- Use precise selectors (byId is best, byLabel if user specifies name)
- Include all necessary properties in changes
- For animations, include keyframes array
- Return ONLY valid JSON, no explanation`;
}

/**
 * Build code generation system prompt
 */
function buildCodeGenerationSystemPrompt(): string {
  return `You are a Remotion code generation expert.

Generate TypeScript React code for Remotion compositions.

Requirements:
- Use proper Remotion imports (Sequence, useCurrentFrame, interpolate, etc.)
- Include data-element-id attributes for tracking
- Implement animations with interpolate() and keyframes
- Use proper TypeScript types
- Follow React best practices

Return ONLY the TypeScript code, no markdown, no explanation.`;
}

/**
 * Calculate cost savings from multi-model routing
 */
export function calculateCostSavings(
  taskCounts: Record<ModelTask, number>
): {
  multiModelCost: number;
  singleModelCost: number;
  savings: number;
  savingsPercent: number;
} {
  // Assume single model = Claude Sonnet for everything
  const claudeCostPerToken = {
    input: 3 / 1_000_000,
    output: 15 / 1_000_000,
  };

  // Assume average: 1000 input tokens, 500 output tokens per call
  const avgTokens = { input: 1000, output: 500 };

  // Single model cost (all Claude)
  const singleModelCost =
    Object.values(taskCounts).reduce((sum, count) => sum + count, 0) *
    (avgTokens.input * claudeCostPerToken.input +
      avgTokens.output * claudeCostPerToken.output);

  // Multi-model cost (optimized routing via Dedalus)
  let multiModelCost = 0;

  // Code generation: Claude (high cost)
  multiModelCost +=
    (taskCounts["code-generation"] || 0) *
    (avgTokens.input * claudeCostPerToken.input +
      avgTokens.output * claudeCostPerToken.output);

  // Plan generation: Claude (high cost)
  multiModelCost +=
    (taskCounts["plan-generation"] || 0) *
    (avgTokens.input * claudeCostPerToken.input +
      avgTokens.output * claudeCostPerToken.output);

  // Chat: Multi-model routing (medium cost, Dedalus optimizes)
  multiModelCost +=
    (taskCounts["chat-response"] || 0) *
    (avgTokens.input * (2.5 / 1_000_000) + avgTokens.output * (10 / 1_000_000));

  // Simple edits: GPT-4o-mini (cheap)
  multiModelCost +=
    (taskCounts["simple-edit"] || 0) *
    (avgTokens.input * (0.15 / 1_000_000) + avgTokens.output * (0.6 / 1_000_000));

  const savings = singleModelCost - multiModelCost;
  const savingsPercent = singleModelCost > 0 ? (savings / singleModelCost) * 100 : 0;

  return {
    multiModelCost,
    singleModelCost,
    savings,
    savingsPercent,
  };
}
