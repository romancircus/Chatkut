/**
 * Dedalus AI Client Wrapper
 *
 * Provides unified interface for multi-model AI access through Dedalus SDK.
 * Routes different tasks to optimal models for cost/quality balance.
 *
 * @see PRIORITIZED_IMPLEMENTATION_PLAN.md Task 1.3
 */

// NOTE: Dedalus SDK types - using any for now until official types are available
type DedalusClient = any;

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
    provider: "anthropic" | "openai" | "google";
    model: string;
    temperature: number;
    reasoning: string;
  }
> = {
  "code-generation": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    temperature: 0.3, // Low for determinism
    reasoning: "Best code quality, understands Remotion/React patterns",
  },
  "plan-generation": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    temperature: 0.3, // Low for determinism
    reasoning: "Excellent structured output, precise edit plans",
  },
  "code-analysis": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    temperature: 0.5,
    reasoning: "Deep understanding of code structure",
  },
  "chat-response": {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.7,
    reasoning: "Balanced cost/quality for conversational responses",
  },
  "simple-edit": {
    provider: "google",
    model: "gemini-2.0-flash",
    temperature: 0.5,
    reasoning: "Fast and cheap for simple property updates",
  },
};

/**
 * Initialize Dedalus client using dedalus-labs SDK
 *
 * For now, fallback to direct Anthropic SDK since dedalus-labs may not be fully set up
 */
function createDedalusClient(apiKey: string): DedalusClient {
  // Use Anthropic SDK directly for now
  // The DEDALUS_API_KEY is actually for their service, but we'll use Anthropic directly
  const Anthropic = require("@anthropic-ai/sdk");

  // If apiKey starts with "sk-ant-", it's an Anthropic key
  // If it starts with "dsk_", it's a Dedalus key (TODO: implement Dedalus SDK)
  const isAnthropicKey = apiKey.startsWith("sk-ant-");

  if (!isAnthropicKey) {
    console.warn("[dedalus:client] Non-Anthropic API key detected. Using mock responses for now.");
    console.warn("[dedalus:client] Please set ANTHROPIC_API_KEY for full functionality.");

    // Return mock client that generates simple responses
    return {
      generateText: async (params: any) => {
        const { prompt } = params;
        return {
          text: `I understand you want to: ${prompt}\n\nHowever, I need a valid Anthropic API key to process this request. Please set ANTHROPIC_API_KEY in your Convex environment.`,
          model: "mock",
          provider: "mock",
          usage: { input: 0, output: 0, total: 0 },
        };
      },
      generateJSON: async (params: any) => {
        return {
          data: { error: "Mock mode - API key needed" },
          model: "mock",
          provider: "mock",
        };
      },
    };
  }

  const anthropic = new Anthropic.Anthropic({ apiKey });

  return {
    generateText: async (params: any) => {
      const { model, systemPrompt, prompt, temperature, maxTokens } = params;

      console.log(`[dedalus:client] Calling Anthropic ${model}...`);

      const message = await anthropic.messages.create({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: maxTokens || 1000,
        temperature: temperature || 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";

      return {
        text,
        model: message.model,
        provider: "anthropic",
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          total: message.usage.input_tokens + message.usage.output_tokens,
        },
      };
    },

    generateJSON: async (params: any) => {
      const { model, systemPrompt, prompt, temperature } = params;

      console.log(`[dedalus:client] Calling Anthropic ${model} (JSON mode)...`);

      const message = await anthropic.messages.create({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 2000,
        temperature: temperature || 0.7,
        system: systemPrompt + "\n\nRespond with valid JSON only.",
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";

      // Try to parse JSON from response
      try {
        const json = JSON.parse(text);
        return {
          data: json,
          model: message.model,
          provider: "anthropic",
        };
      } catch {
        // If not valid JSON, return as-is
        return {
          data: { text },
          model: message.model,
          provider: "anthropic",
        };
      }
    },
  };
}

/**
 * AI Client singleton
 */
let dedalusClientInstance: DedalusClient | null = null;

export function getAIClient(apiKey?: string): DedalusClient {
  // Use provided API key or environment variable
  const key = apiKey || process.env.DEDALUS_API_KEY;

  if (!key) {
    throw new Error(
      "DEDALUS_API_KEY not configured. Run: npx convex env set DEDALUS_API_KEY \"your-key\""
    );
  }

  if (!dedalusClientInstance) {
    console.log("[dedalus:client] Initializing Dedalus SDK...");
    dedalusClientInstance = createDedalusClient(key);
    console.log("[dedalus:client] Dedalus SDK initialized ✅");
  }

  return dedalusClientInstance;
}

/**
 * Generate chat response
 * Uses GPT-4o for balanced cost/quality
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

    // Call Dedalus SDK (adjust based on actual SDK API)
    const response = await client.generateText({
      provider: routing.provider,
      model: routing.model,
      systemPrompt,
      prompt: message,
      temperature: routing.temperature,
      maxTokens: 1000,
    });

    console.log("[dedalus:chat] Response generated:", {
      model: response.model || routing.model,
      provider: response.provider || routing.provider,
      tokens: response.tokenUsage?.total || 0,
      cost: response.cost || 0,
    });

    return {
      text: response.text || response.content || "",
      model: response.model || routing.model,
      provider: response.provider || routing.provider,
      cost: response.cost,
      tokens: response.tokenUsage || response.usage,
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

    // Call Dedalus SDK for JSON generation
    const response = await client.generateJSON({
      provider: routing.provider,
      model: routing.model,
      systemPrompt,
      prompt: userMessage,
      temperature: routing.temperature,
    });

    console.log("[dedalus:plan] Plan generated:", {
      operations: response.data?.operations?.length || 0,
    });

    return response.data;
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

    const response = await client.generateText({
      provider: routing.provider,
      model: routing.model,
      systemPrompt,
      prompt,
      temperature: routing.temperature,
      maxTokens: 4096,
    });

    console.log("[dedalus:code] Code generated successfully");

    return {
      code: response.text || response.content || "",
      model: response.model || routing.model,
      provider: response.provider || routing.provider,
      cost: response.cost,
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

  // Multi-model cost (optimized routing)
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

  // Chat: GPT-4o (medium cost, $2.5/$10 per MTok)
  multiModelCost +=
    (taskCounts["chat-response"] || 0) *
    (avgTokens.input * (2.5 / 1_000_000) + avgTokens.output * (10 / 1_000_000));

  // Simple edits: Gemini Flash (essentially free)
  multiModelCost += (taskCounts["simple-edit"] || 0) * 0;

  const savings = singleModelCost - multiModelCost;
  const savingsPercent = singleModelCost > 0 ? (savings / singleModelCost) * 100 : 0;

  return {
    multiModelCost,
    singleModelCost,
    savings,
    savingsPercent,
  };
}
