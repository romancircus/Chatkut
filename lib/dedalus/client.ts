/**
 * Dedalus AI Client Wrapper
 *
 * TEMPORARY: Using Anthropic SDK directly until Dedalus TypeScript SDK is production-ready.
 * The dedalus-labs npm package exists but TypeScript support is marked as "Coming Very Soon"
 * in official docs, and we're getting 404 errors from the API.
 *
 * Will migrate to Dedalus SDK once TypeScript support is stable.
 *
 * @see PRIORITIZED_IMPLEMENTATION_PLAN.md Task 1.3
 */

import Anthropic from "@anthropic-ai/sdk";

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
    model: "claude-sonnet-4-5-20250929",
    temperature: 0.3, // Low for determinism
    reasoning: "Best code quality, understands Remotion/React patterns",
    agent_attributes: { accuracy: 0.9, intelligence: 0.9 },
  },
  "plan-generation": {
    model: "claude-sonnet-4-5-20250929",
    temperature: 0.3, // Low for determinism
    reasoning: "Excellent structured output, precise edit plans",
    agent_attributes: { accuracy: 0.95, intelligence: 0.9 },
  },
  "code-analysis": {
    model: "claude-sonnet-4-5-20250929",
    temperature: 0.5,
    reasoning: "Deep understanding of code structure",
    agent_attributes: { intelligence: 0.9, accuracy: 0.85 },
  },
  "chat-response": {
    model: "claude-sonnet-4-5-20250929", // Latest Claude Sonnet model
    temperature: 0.7,
    reasoning: "Multi-model routing for balanced cost/quality",
    agent_attributes: { friendliness: 0.9, efficiency: 0.8 },
  },
  "simple-edit": {
    model: "claude-sonnet-4-5-20250929", // Latest Claude Sonnet model
    temperature: 0.5,
    reasoning: "Fast and cheap for simple property updates",
    agent_attributes: { efficiency: 0.9, speed: 0.9 },
  },
};

/**
 * AI Client singleton
 */
let anthropicClientInstance: Anthropic | null = null;

export function getAIClient(apiKey?: string): Anthropic {
  // Use provided API key or environment variable
  const key = apiKey || process.env.ANTHROPIC_API_KEY;

  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured. Run: npx convex env set ANTHROPIC_API_KEY \"sk-ant-your-key\""
    );
  }

  if (!anthropicClientInstance) {
    console.log("[anthropic:client] Initializing Anthropic SDK...");
    anthropicClientInstance = new Anthropic({
      apiKey: key,
    });
    console.log("[anthropic:client] Anthropic SDK initialized ✅");
  }

  return anthropicClientInstance;
}

/**
 * Generate chat response
 * Uses Anthropic Claude directly
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
  console.log("[anthropic:chat] Generating response for:", message.slice(0, 50) + "...");

  const routing = MODEL_ROUTING["chat-response"];
  const systemPrompt = buildChatSystemPrompt(context);

  try {
    const client = getAIClient(apiKey);

    // Call Anthropic SDK
    const response = await client.messages.create({
      model: routing.model as string,
      system: systemPrompt,
      messages: [
        { role: "user", content: message },
      ],
      temperature: routing.temperature,
      max_tokens: 1000,
    });

    console.log("[anthropic:chat] Response generated:", {
      model: response.model,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";

    return {
      text,
      model: response.model,
      provider: "anthropic",
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error("[anthropic:chat] Error generating response:", error);
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
  console.log("[anthropic:plan] Generating edit plan for:", userMessage.slice(0, 50) + "...");

  const routing = MODEL_ROUTING["plan-generation"];
  const systemPrompt = buildEditPlanSystemPrompt(compositionIR);

  try {
    const client = getAIClient(apiKey);

    // Call Anthropic SDK
    const response = await client.messages.create({
      model: routing.model as string,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage },
      ],
      temperature: routing.temperature,
      max_tokens: 2000,
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";

    console.log("[anthropic:plan] Plan generated");

    // Try to parse JSON from response
    try {
      const json = JSON.parse(text);
      return json;
    } catch {
      // If not valid JSON, return as-is
      return { text };
    }
  } catch (error) {
    console.error("[anthropic:plan] Error generating plan:", error);
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
  console.log("[anthropic:code] Generating Remotion code for composition:", compositionIR.id);

  const routing = MODEL_ROUTING["code-generation"];
  const systemPrompt = buildCodeGenerationSystemPrompt();
  const prompt = `Generate Remotion TypeScript code for this composition:\n\n${JSON.stringify(compositionIR, null, 2)}`;

  try {
    const client = getAIClient(apiKey);

    const response = await client.messages.create({
      model: routing.model as string,
      system: systemPrompt,
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: routing.temperature,
      max_tokens: 4096,
    });

    const code = response.content[0]?.type === "text" ? response.content[0].text : "";

    console.log("[anthropic:code] Code generated successfully");

    return {
      code,
      model: response.model,
      provider: "anthropic",
    };
  } catch (error) {
    console.error("[anthropic:code] Error generating code:", error);
    throw new Error(`Failed to generate Remotion code: ${error}`);
  }
}

/**
 * Build chat system prompt with context
 * Exported for use in sendChatMessage action
 */
export function buildChatSystemPrompt(context: any): string {
  const assetsList = context.assets
    ?.map((a: any) => `- ${a.filename} (${a.type}, ID: ${a._id})`)
    .join("\n") || "No assets uploaded yet";

  const elementsList = context.composition?.ir?.elements
    ?.map((e: any) => `- ${e.type} "${e.label || 'Unlabeled'}" (ID: ${e.id}, frames ${e.from}-${e.from + e.durationInFrames})`)
    .join("\n") || "No elements in timeline yet";

  const fps = context.composition?.ir?.metadata?.fps || 30;
  const width = context.composition?.ir?.metadata?.width || 1920;
  const height = context.composition?.ir?.metadata?.height || 1080;
  const totalFrames = context.composition?.ir?.metadata?.durationInFrames || 0;

  return `You are ChatKut, an AI video editing assistant with tool use capabilities.

# COMPOSITION CONTEXT

## Available Assets
${assetsList}

## Current Composition Settings
- Duration: ${totalFrames} frames (${(totalFrames / fps).toFixed(1)} seconds at ${fps}fps)
- Dimensions: ${width}x${height}
- FPS: ${fps}

## Elements in Timeline
${elementsList}

# TOOL USE GUIDELINES

## When to Use Tools
1. **User requests edits**: USE TOOLS to make changes (don't just describe what to do)
2. **Multiple operations**: Call multiple tools in one response when needed
3. **Provide context**: ALWAYS explain what you did after using tools

## Tool Execution Order
1. Execute tools FIRST (tool calls happen before text response)
2. THEN provide a friendly explanation of what you did

## Critical Rules
1. **Element IDs**: Use exact IDs from "Elements in Timeline" list above (e.g., elem_xxx)
2. **Asset IDs**: Use exact IDs from "Available Assets" list above (format: convex ID)
3. **Frame calculations**: ${fps}fps means ${fps} frames = 1 second. Examples:
   - 3 seconds = ${fps * 3} frames
   - 5 seconds = ${fps * 5} frames
   - 10 seconds = ${fps * 10} frames
4. **Animation keyframes**: Frame numbers are RELATIVE to element's start frame
   - Keyframe at frame 0 = when element starts
   - Keyframe at frame ${fps} = 1 second after element starts
5. **Position coordinates** (for ${width}x${height} canvas):
   - Top-left: x=0, y=0
   - Center: x=${width/2}, y=${height/2}
   - Bottom-right: x=${width}, y=${height}
6. **Text positioning**:
   - Top center: x=${width/2}, y=100
   - Center: x=${width/2}, y=${height/2}
   - Bottom center: x=${width/2}, y=${height - 100}

## Example Interactions

**User**: "Add the bigfoot video"
**You**: [Call add_video_element with assetId]
"I've added the bigfoot video to your timeline starting at frame 0! 🎬"

**User**: "Zoom into the gorilla as he enters frame"
**You**: [Call add_animation with property="scale", keyframes=[{frame:0,value:1.0},{frame:${fps*3},value:2.5}]]
"I've added a zoom animation that smoothly scales from 1.0x to 2.5x over the first 3 seconds! 🔍"

**User**: "Add text saying 'Big Foot spotted!'"
**You**: [Call add_text_element with text, from, duration, x, y]
"I've added the text 'Big Foot spotted!' centered at the top of the frame! 📝"

**User**: "Add the video and put text at the bottom saying 'Amazing!'"
**You**: [Call add_video_element AND add_text_element]
"I've added your video and placed the text 'Amazing!' at the bottom! Both are now on the timeline! ✨"

## Error Handling
- If an element ID doesn't exist, apologize and list available elements
- If an asset ID is missing, ask the user to upload the asset first
- If parameters are unclear, ask for clarification

Remember: You are an ACTION-ORIENTED assistant. Use tools to make real changes!`;
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
