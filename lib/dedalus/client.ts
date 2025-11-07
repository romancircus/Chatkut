/**
 * Dedalus AI Client Wrapper
 *
 * Provides unified interface for multi-model AI access.
 * Routes different tasks to optimal models for cost/quality balance.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const DEDALUS_API_KEY = process.env.DEDALUS_API_KEY;

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
    reasoning: string;
  }
> = {
  "code-generation": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    reasoning: "Best code quality, understands Remotion/React patterns",
  },
  "plan-generation": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    reasoning: "Excellent structured output, precise edit plans",
  },
  "chat-response": {
    provider: "openai",
    model: "gpt-4o",
    reasoning: "Balanced cost/quality for conversational responses",
  },
  "simple-edit": {
    provider: "google",
    model: "gemini-2.0-flash",
    reasoning: "Fast and cheap for simple property updates",
  },
  "code-analysis": {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    reasoning: "Deep understanding of code structure",
  },
};

/**
 * AI Client wrapper
 */
export class AIClient {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private google?: GoogleGenerativeAI;

  constructor() {
    // Initialize clients if API keys are available
    if (ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    }
    if (OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    }
    if (GOOGLE_API_KEY) {
      this.google = new GoogleGenerativeAI(GOOGLE_API_KEY);
    }
  }

  /**
   * Generate text completion with optimal model for task
   */
  async generateText(params: {
    task: ModelTask;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{
    text: string;
    model: string;
    provider: string;
    tokenUsage?: {
      input: number;
      output: number;
      total: number;
    };
    cost?: number;
  }> {
    const routing = MODEL_ROUTING[params.task];
    const { provider, model } = routing;

    console.log(
      `[AI] Task: ${params.task} → ${provider}/${model} (${routing.reasoning})`
    );

    switch (provider) {
      case "anthropic":
        return await this.generateWithClaude(params, model);
      case "openai":
        return await this.generateWithGPT(params, model);
      case "google":
        return await this.generateWithGemini(params, model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Generate with Claude (Anthropic)
   */
  private async generateWithClaude(
    params: {
      prompt: string;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    },
    model: string
  ) {
    if (!this.anthropic) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await this.anthropic.messages.create({
      model: model,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: [
        {
          role: "user",
          content: params.prompt,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

    // Estimate cost (Claude Sonnet 4.5: $3/MTok input, $15/MTok output)
    const inputCost = (response.usage.input_tokens / 1_000_000) * 3;
    const outputCost = (response.usage.output_tokens / 1_000_000) * 15;

    return {
      text,
      model,
      provider: "anthropic",
      tokenUsage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      cost: inputCost + outputCost,
    };
  }

  /**
   * Generate with GPT (OpenAI)
   */
  private async generateWithGPT(
    params: {
      prompt: string;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    },
    model: string
  ) {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    const messages: any[] = [];
    if (params.systemPrompt) {
      messages.push({ role: "system", content: params.systemPrompt });
    }
    messages.push({ role: "user", content: params.prompt });

    const response = await this.openai.chat.completions.create({
      model: model,
      messages,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature || 0.7,
    });

    const text = response.choices[0]?.message?.content || "";

    // Estimate cost (GPT-4o: $2.5/MTok input, $10/MTok output)
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const inputCost = (inputTokens / 1_000_000) * 2.5;
    const outputCost = (outputTokens / 1_000_000) * 10;

    return {
      text,
      model,
      provider: "openai",
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: inputCost + outputCost,
    };
  }

  /**
   * Generate with Gemini (Google)
   */
  private async generateWithGemini(
    params: {
      prompt: string;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    },
    model: string
  ) {
    if (!this.google) {
      throw new Error("Google API key not configured");
    }

    const geminiModel = this.google.getGenerativeModel({ model });

    const fullPrompt = params.systemPrompt
      ? `${params.systemPrompt}\n\n${params.prompt}`
      : params.prompt;

    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: params.maxTokens || 4096,
        temperature: params.temperature || 0.7,
      },
    });

    const text = result.response.text();

    // Estimate tokens (rough approximation)
    const inputTokens = Math.ceil(fullPrompt.length / 4);
    const outputTokens = Math.ceil(text.length / 4);

    // Gemini Flash 2.0: Free tier or very low cost
    const cost = 0; // Essentially free for our use case

    return {
      text,
      model,
      provider: "google",
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost,
    };
  }

  /**
   * Generate structured JSON output
   */
  async generateJSON<T = any>(params: {
    task: ModelTask;
    prompt: string;
    systemPrompt?: string;
    schema?: any;
  }): Promise<{
    data: T;
    model: string;
    provider: string;
    cost?: number;
  }> {
    const response = await this.generateText({
      ...params,
      prompt: `${params.prompt}\n\nRespond ONLY with valid JSON. No markdown, no explanation.`,
    });

    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = response.text.trim();
      const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // Try to find JSON object
        const objectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }
      }

      const data = JSON.parse(jsonText);

      return {
        data,
        model: response.model,
        provider: response.provider,
        cost: response.cost,
      };
    } catch (error) {
      console.error("Failed to parse JSON response:", response.text);
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  /**
   * Stream text generation (for chat UI)
   */
  async *streamText(params: {
    task: ModelTask;
    prompt: string;
    systemPrompt?: string;
  }): AsyncGenerator<string> {
    const routing = MODEL_ROUTING[params.task];

    // For now, we'll do non-streaming and yield the full response
    // In production, implement actual streaming for each provider
    const response = await this.generateText(params);
    yield response.text;
  }
}

/**
 * Get singleton AI client instance
 */
let aiClientInstance: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new AIClient();
  }
  return aiClientInstance;
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

  // Chat: GPT-4o (medium cost, $2.5/$10 per MTok)
  multiModelCost +=
    (taskCounts["chat-response"] || 0) *
    (avgTokens.input * (2.5 / 1_000_000) + avgTokens.output * (10 / 1_000_000));

  // Simple edits: Gemini Flash (essentially free)
  multiModelCost += (taskCounts["simple-edit"] || 0) * 0;

  const savings = singleModelCost - multiModelCost;
  const savingsPercent = (savings / singleModelCost) * 100;

  return {
    multiModelCost,
    singleModelCost,
    savings,
    savingsPercent,
  };
}
