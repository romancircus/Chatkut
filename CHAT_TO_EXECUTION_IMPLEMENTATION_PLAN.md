# Chat-to-Execution Implementation Plan

**Status:** Design Complete - Ready for Implementation
**Created:** 2025-11-09
**Goal:** Wire chat messages into executing actual composition edits using Anthropic Claude Tool Use API

---

## Executive Summary

Currently, the chat interface **responds with conversational text but does NOT execute composition edits**. This plan implements a complete **Plan-Execute-Verify** pipeline using:

1. **Anthropic Claude Tool Use API** - LLM calls structured functions (tools)
2. **Convex Mutations** - Existing composition editing functions
3. **Real-time Updates** - Composition updates trigger UI refresh

### What's Currently Working ✅
- Chat UI saves user messages
- AI generates text responses using Anthropic SDK
- Composition mutations exist (addElement, updateElement, etc.)
- Asset upload and HLS/MP4 dual-URL system

### What's Missing ❌
- AI doesn't call tools to execute edits
- Chat responses are pure text, no actions taken
- No feedback loop for tool execution results

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER SENDS MESSAGE                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  convex/ai.ts: sendChatMessage                                      │
│  1. Save user message                                               │
│  2. Get composition context (IR, assets, chat history)              │
│  3. Build system prompt with TOOL DEFINITIONS                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Anthropic Claude API Call (with tools parameter)                   │
│  Tools Defined:                                                     │
│  - add_video_element                                                │
│  - add_text_element                                                 │
│  - add_animation                                                    │
│  - update_element_properties                                        │
│  - delete_element                                                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AI Response Contains:                                              │
│  1. Text response (explanation to user)                             │
│  2. Tool use blocks (structured function calls)                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Process Tool Use Blocks                                            │
│  For each tool_use:                                                 │
│  1. Extract tool_name and input parameters                          │
│  2. Call corresponding Convex mutation                              │
│  3. Collect tool_result                                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Send Tool Results Back to Claude                                   │
│  - tool_result blocks with outputs                                  │
│  - Claude generates final user-facing message                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Save Assistant Response + Update UI                                │
│  - Composition updated (triggers React re-render)                   │
│  - Chat message saved with execution summary                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Critical Design Decisions

### 1. Tool Calling vs Function Calling
**Choice:** Use Anthropic's **Tool Use API** (not deprecated function calling)

**Reasoning:**
- Tool Use is the current standard (function calling deprecated)
- Better structured output with `tool_use` content blocks
- Supports multi-turn tool conversations
- Official Anthropic SDK has native support

**Implementation:**
```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-5",
  tools: [...toolDefinitions],  // ← Tools parameter
  messages: [...]
});

// Response contains tool_use blocks when AI wants to call tools
if (response.stop_reason === "tool_use") {
  // Process tool calls
}
```

### 2. Tool Granularity
**Choice:** **Element-level tools** (not operation-level)

**Why NOT operation-level** (add/update/delete):
- Too generic, AI would need complex selectors
- Hard to validate parameters
- Difficult to provide good error messages

**Why element-level** (add_video, add_text, add_animation):
- Specific parameter schemas per tool
- Better validation (e.g., video requires `assetId`)
- Clearer error messages
- AI can be more precise

**Tool List:**
```typescript
const tools = [
  {
    name: "add_video_element",
    description: "Add a video clip to the timeline at a specific time",
    input_schema: {
      type: "object",
      properties: {
        assetId: { type: "string", description: "ID of uploaded video asset" },
        from: { type: "number", description: "Start frame" },
        durationInFrames: { type: "number" },
        label: { type: "string" }
      },
      required: ["assetId"]
    }
  },
  {
    name: "add_text_element",
    description: "Add text overlay to the composition",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        from: { type: "number" },
        durationInFrames: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        fontSize: { type: "number" },
        color: { type: "string" }
      },
      required: ["text", "from", "durationInFrames"]
    }
  },
  {
    name: "add_animation",
    description: "Add animation to an existing element",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string" },
        property: {
          type: "string",
          enum: ["opacity", "scale", "scaleX", "scaleY", "x", "y", "rotation"]
        },
        keyframes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              frame: { type: "number" },
              value: { type: "number" }
            }
          }
        },
        easing: {
          type: "string",
          enum: ["linear", "ease-in", "ease-out", "ease-in-out"]
        }
      },
      required: ["elementId", "property", "keyframes"]
    }
  },
  // ... more tools
];
```

### 3. Multi-Turn Conversation Flow
**Choice:** **Single-turn with multiple tool calls**

**Why:**
- Faster execution (no back-and-forth)
- Simpler state management
- Better UX (immediate results)

**Flow:**
```
User: "Add zoom effect to the gorilla video and add text saying 'Big Foot'"

AI Response:
├─ tool_use: add_animation (zoom on video element)
├─ tool_use: add_text_element (text overlay)
└─ text: "I've added a zoom effect and text overlay to your video!"
```

### 4. Error Handling Strategy
**Choice:** **Graceful degradation with user feedback**

**Scenarios:**
1. **Ambiguous selector** (e.g., "the video" but 3 videos exist)
   - Tool returns error with list of candidates
   - AI rephrases or asks for clarification

2. **Invalid parameters** (e.g., negative frame number)
   - Tool validation fails
   - Error message returned to AI
   - AI explains issue to user

3. **Asset not found**
   - Tool returns error
   - AI suggests uploading asset first

**Example:**
```typescript
// In tool execution
if (matchingElements.length > 1) {
  return {
    error: "Multiple elements match 'video'. Candidates: Intro.mp4, Main.mp4, Outro.mp4",
    candidates: matchingElements.map(e => ({id: e.id, label: e.label}))
  };
}
```

### 5. Real-time UI Updates
**Choice:** **Optimistic updates via Convex reactivity**

**Flow:**
1. Tool executes mutation → Composition updated in Convex
2. Convex reactivity triggers → useQuery hook re-fetches
3. React re-renders → Timeline/Preview update automatically

**No additional code needed** - Convex handles this!

---

## Implementation Steps

### Phase 1: Tool Definitions & System Prompt (2-3 hours)

**File:** `lib/dedalus/tools.ts` (new file)

**Create tool definitions:**
```typescript
import type { Tool } from "@anthropic-ai/sdk/resources/messages.mjs";

export const COMPOSITION_TOOLS: Tool[] = [
  {
    name: "add_video_element",
    description: "Add a video clip from uploaded assets to the timeline. Use this when the user wants to add, place, or insert a video.",
    input_schema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "ID of the uploaded video asset. Must match an asset._id from the available assets list."
        },
        from: {
          type: "number",
          description: "Start frame (frame number where video begins). Defaults to 0."
        },
        durationInFrames: {
          type: "number",
          description: "Duration in frames. If not specified, uses the video's natural duration."
        },
        label: {
          type: "string",
          description: "Human-readable label for this element (e.g., 'Intro clip', 'Main footage')."
        }
      },
      required: ["assetId"]
    }
  },
  {
    name: "add_text_element",
    description: "Add text overlay to the composition. Use for titles, captions, subtitles, or any on-screen text.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text content to display" },
        from: { type: "number", description: "Start frame" },
        durationInFrames: { type: "number", description: "How long text appears" },
        x: { type: "number", description: "Horizontal position in pixels (0=left edge, 960=center for 1920px width)" },
        y: { type: "number", description: "Vertical position in pixels (0=top edge, 540=center for 1080px height)" },
        fontSize: { type: "number", description: "Font size in pixels. Default: 48" },
        color: { type: "string", description: "Text color (hex or CSS color name). Default: #ffffff" },
        fontWeight: { type: "string", description: "Font weight (normal, bold, 100-900). Default: normal" }
      },
      required: ["text", "from", "durationInFrames"]
    }
  },
  {
    name: "add_animation",
    description: "Animate an element's properties over time. Use for zoom, fade, slide, rotate effects.",
    input_schema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "ID of the element to animate. Use the element ID returned from previous tool calls or from the composition context."
        },
        property: {
          type: "string",
          enum: ["opacity", "scale", "scaleX", "scaleY", "x", "y", "rotation", "rotateX", "rotateY", "translateX", "translateY"],
          description: "Property to animate. scale=zoom, opacity=fade, rotation=spin, x/y=move"
        },
        keyframes: {
          type: "array",
          description: "Array of keyframes defining animation. Each keyframe has frame (number) and value (number).",
          items: {
            type: "object",
            properties: {
              frame: { type: "number", description: "Frame number (relative to element start)" },
              value: { type: "number", description: "Property value at this frame" }
            },
            required: ["frame", "value"]
          }
        },
        easing: {
          type: "string",
          enum: ["linear", "ease-in", "ease-out", "ease-in-out"],
          description: "Animation easing function. Default: linear"
        }
      },
      required: ["elementId", "property", "keyframes"]
    }
  },
  {
    name: "update_element_properties",
    description: "Update properties of an existing element (volume, position, color, etc.)",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string", description: "ID of element to update" },
        properties: {
          type: "object",
          description: "Properties to update. Can include: volume (0-1), x, y, color, fontSize, etc."
        }
      },
      required: ["elementId", "properties"]
    }
  },
  {
    name: "delete_element",
    description: "Remove an element from the composition",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string", description: "ID of element to delete" }
      },
      required: ["elementId"]
    }
  }
];
```

**Update system prompt** in `lib/dedalus/client.ts`:
```typescript
function buildChatSystemPrompt(context: any): string {
  const assetsList = context.assets
    ?.map((a: any) => `- ${a.filename} (${a.type}, ID: ${a._id})`)
    .join("\n") || "No assets uploaded yet";

  const elementsList = context.composition?.ir?.elements
    ?.map((e: any) => `- ${e.type} "${e.label || 'Unlabeled'}" (ID: ${e.id}, frames ${e.from}-${e.from + e.durationInFrames})`)
    .join("\n") || "No elements yet";

  return `You are ChatKut, an AI video editing assistant with tool use capabilities.

AVAILABLE ASSETS:
${assetsList}

CURRENT COMPOSITION:
- Duration: ${context.composition?.ir?.metadata?.durationInFrames || 0} frames
- FPS: ${context.composition?.ir?.metadata?.fps || 30}
- Dimensions: ${context.composition?.ir?.metadata?.width || 1920}x${context.composition?.ir?.metadata?.height || 1080}

ELEMENTS IN TIMELINE:
${elementsList}

IMPORTANT TOOL USE GUIDELINES:
1. When user requests edits, USE THE TOOLS to make changes
2. Call tools BEFORE responding with text (tools execute first, then you explain)
3. Use element IDs from the ELEMENTS IN TIMELINE list above
4. Use asset IDs from the AVAILABLE ASSETS list above
5. Frame calculations: 30fps = 30 frames per second (e.g., 3 seconds = 90 frames)
6. For animations, keyframes are relative to element start frame
7. ALWAYS provide a friendly text response explaining what you did

EXAMPLE INTERACTIONS:

User: "Add the bigfoot video to the timeline"
Assistant: [calls add_video_element with assetId] "I've added the bigfoot video to your timeline starting at frame 0!"

User: "Zoom into the gorilla as he enters frame"
Assistant: [calls add_animation with scale property] "I've added a zoom animation that scales from 1.0x to 2.5x over the first 3 seconds!"

User: "Add text saying 'Big Foot spotted'"
Assistant: [calls add_text_element] "I've added text that says 'Big Foot spotted' at the top of the frame!"`;
}
```

---

### Phase 2: Tool Execution Handler (3-4 hours)

**File:** `convex/ai.ts` - Update `sendChatMessage` action

**Current flow:**
```typescript
export const sendChatMessage = action({
  handler: async (ctx, { projectId, message }) => {
    // 1. Save user message
    // 2. Get context
    // 3. Call AI
    // 4. Save response
    // 5. Return
  }
});
```

**New flow with tool execution:**
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { COMPOSITION_TOOLS } from "@/lib/dedalus/tools";

export const sendChatMessage = action({
  args: {
    projectId: v.id("projects"),
    message: v.string(),
  },
  handler: async (ctx, { projectId, message }): Promise<{
    messageId: any;
    content: string;
    model: string;
    toolsExecuted: number;
  }> => {
    const userId = "temp_user_1" as any;

    // 1. Save user message
    await ctx.runMutation(api.ai.saveChatMessage, {
      projectId,
      userId,
      role: "user",
      content: message,
    });

    // 2. Get composition context
    const project = await ctx.runQuery(api.ai.getProjectContext, { projectId });
    const history = await ctx.runQuery(api.ai.getChatMessages, { projectId, limit: 10 });

    // 3. Build messages array for multi-turn conversation
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: message }
    ];

    // 4. Call Anthropic with tools
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const systemPrompt = buildChatSystemPrompt(project);

    let response = await client.messages.create({
      model: "claude-sonnet-4-5",
      system: systemPrompt,
      messages,
      tools: COMPOSITION_TOOLS,
      max_tokens: 2000,
    });

    let toolsExecuted = 0;

    // 5. Process tool use (loop for multi-turn if needed)
    while (response.stop_reason === "tool_use") {
      console.log("[ai:chat] Processing tool use blocks");

      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`[ai:chat] Executing tool: ${toolUse.name}`, toolUse.input);

        try {
          const result = await executeTool(ctx, toolUse.name, toolUse.input, project);
          toolsExecuted++;

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          console.error(`[ai:chat] Tool execution error:`, error);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: String(error) }),
            is_error: true,
          });
        }
      }

      // 6. Send tool results back to Claude
      messages.push({
        role: "assistant",
        content: response.content,
      });
      messages.push({
        role: "user",
        content: toolResults,
      });

      // 7. Get final response from Claude
      response = await client.messages.create({
        model: "claude-sonnet-4-5",
        system: systemPrompt,
        messages,
        tools: COMPOSITION_TOOLS,
        max_tokens: 2000,
      });
    }

    // 8. Extract final text response
    const finalText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map(block => block.text)
      .join("\n");

    // 9. Save assistant response
    const assistantMessageId = await ctx.runMutation(api.ai.saveChatMessage, {
      projectId,
      userId,
      role: "assistant",
      content: finalText,
    });

    // 10. Track usage
    await ctx.runMutation(api.ai.trackAIUsage, {
      userId,
      projectId,
      task: "chat-response-with-tools",
      model: response.model,
      provider: "anthropic",
      tokenUsage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    });

    return {
      messageId: assistantMessageId,
      content: finalText,
      model: response.model,
      toolsExecuted,
    };
  },
});

/**
 * Execute a tool by name
 */
async function executeTool(
  ctx: any,
  toolName: string,
  input: any,
  project: any
): Promise<any> {
  const compositionId = project.composition?._id;

  if (!compositionId) {
    throw new Error("No composition found for this project");
  }

  switch (toolName) {
    case "add_video_element":
      const videoElementId = await ctx.runMutation(api.compositions.addElement, {
        compositionId,
        assetId: input.assetId,
        from: input.from,
        durationInFrames: input.durationInFrames,
        label: input.label,
      });
      return { elementId: videoElementId, success: true };

    case "add_text_element":
      const textElementId = await ctx.runMutation(api.compositions.addTextElement, {
        compositionId,
        text: input.text,
        from: input.from,
        durationInFrames: input.durationInFrames,
        x: input.x,
        y: input.y,
        fontSize: input.fontSize,
        color: input.color,
        fontWeight: input.fontWeight,
      });
      return { elementId: textElementId, success: true };

    case "add_animation":
      await ctx.runMutation(api.compositions.addAnimation, {
        compositionId,
        elementId: input.elementId,
        property: input.property,
        keyframes: input.keyframes,
        easing: input.easing,
      });
      return { success: true };

    case "update_element_properties":
      await ctx.runMutation(api.compositions.updateElement, {
        compositionId,
        elementId: input.elementId,
        changes: { properties: input.properties },
      });
      return { success: true };

    case "delete_element":
      await ctx.runMutation(api.compositions.deleteElement, {
        compositionId,
        elementId: input.elementId,
      });
      return { success: true };

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

---

### Phase 3: New Composition Mutations (2-3 hours)

**File:** `convex/compositions.ts` - Add missing mutations

**Add these new mutations:**
```typescript
/**
 * Add text element to composition
 */
export const addTextElement = mutation({
  args: {
    compositionId: v.id("compositions"),
    text: v.string(),
    from: v.optional(v.number()),
    durationInFrames: v.number(),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    fontSize: v.optional(v.number()),
    color: v.optional(v.string()),
    fontWeight: v.optional(v.union(v.string(), v.number())),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const composition = await ctx.db.get(args.compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    const newElement = {
      id: generateElementId(),
      type: "text" as const,
      from: args.from ?? 0,
      durationInFrames: args.durationInFrames,
      properties: {
        text: args.text,
        x: args.x ?? 960, // Center by default (1920/2)
        y: args.y ?? 540, // Center by default (1080/2)
        fontSize: args.fontSize ?? 48,
        color: args.color ?? "#ffffff",
        fontWeight: args.fontWeight ?? "normal",
      },
      label: args.label || args.text.substring(0, 20),
    };

    const updatedIR = {
      ...composition.ir,
      elements: [...composition.ir.elements, newElement],
      version: composition.ir.version + 1,
    };

    await ctx.db.patch(args.compositionId, {
      ir: updatedIR,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    console.log(`[addTextElement] Added text element ${newElement.id}: "${args.text}"`);
    return newElement.id;
  },
});

/**
 * Add animation to an existing element
 */
export const addAnimation = mutation({
  args: {
    compositionId: v.id("compositions"),
    elementId: v.string(),
    property: v.string(),
    keyframes: v.array(
      v.object({
        frame: v.number(),
        value: v.number(),
      })
    ),
    easing: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const composition = await ctx.db.get(args.compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    // Find element
    const element = composition.ir.elements.find((el: any) => el.id === args.elementId);
    if (!element) {
      throw new Error(`Element ${args.elementId} not found`);
    }

    // Create new animation
    const newAnimation = {
      property: args.property,
      keyframes: args.keyframes,
      easing: args.easing || "linear",
    };

    // Update element with new animation
    const updatedElements = composition.ir.elements.map((el: any) => {
      if (el.id === args.elementId) {
        return {
          ...el,
          animations: [...(el.animations || []), newAnimation],
        };
      }
      return el;
    });

    const updatedIR = {
      ...composition.ir,
      elements: updatedElements,
      version: composition.ir.version + 1,
    };

    await ctx.db.patch(args.compositionId, {
      ir: updatedIR,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    console.log(`[addAnimation] Added ${args.property} animation to element ${args.elementId}`);
    return true;
  },
});

/**
 * Delete element from composition
 */
export const deleteElement = mutation({
  args: {
    compositionId: v.id("compositions"),
    elementId: v.string(),
  },
  handler: async (ctx, args) => {
    const composition = await ctx.db.get(args.compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    const updatedElements = composition.ir.elements.filter(
      (el: any) => el.id !== args.elementId
    );

    const updatedIR = {
      ...composition.ir,
      elements: updatedElements,
      version: composition.ir.version + 1,
    };

    await ctx.db.patch(args.compositionId, {
      ir: updatedIR,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    console.log(`[deleteElement] Deleted element ${args.elementId}`);
    return true;
  },
});

// Helper to generate unique element IDs
function generateElementId(): string {
  return `elem_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
```

---

### Phase 4: Testing & Validation (2-3 hours)

**Test Cases:**

1. **Simple video add:**
   - User: "Add the bigfoot video"
   - Expected: `add_video_element` called, video appears on timeline

2. **Text overlay:**
   - User: "Add text saying 'Big Foot spotted!'"
   - Expected: `add_text_element` called, text appears

3. **Zoom animation:**
   - User: "Zoom into the gorilla as he enters frame"
   - Expected: `add_animation` called with scale keyframes

4. **Multiple operations:**
   - User: "Add the video and put text saying 'Amazing!' at the bottom"
   - Expected: 2 tool calls (add_video_element, add_text_element)

5. **Error handling:**
   - User: "Delete the video" (but multiple videos exist)
   - Expected: Error returned, AI asks for clarification

**Validation Checklist:**
- [ ] Tools are called with correct parameters
- [ ] Composition IR updates correctly
- [ ] Timeline UI refreshes automatically
- [ ] Preview updates with new elements/animations
- [ ] Error messages are user-friendly
- [ ] Multi-tool calls work in single response
- [ ] Conversation history maintains context

---

## Success Metrics

1. **Functional Correctness:**
   - ✅ Chat messages trigger actual composition edits
   - ✅ All tool types execute successfully
   - ✅ Errors are handled gracefully

2. **User Experience:**
   - ✅ User sees immediate visual feedback (timeline updates)
   - ✅ AI provides clear explanations of actions taken
   - ✅ Ambiguous requests prompt clarification

3. **Performance:**
   - ⏱️ Tool execution <500ms per tool
   - ⏱️ Full conversation turn <3 seconds
   - ⏱️ UI updates within 100ms of composition change

4. **Reliability:**
   - 🎯 >90% of valid user requests execute correctly
   - 🎯 <5% false tool calls (calling wrong tool)
   - 🎯 100% of errors return actionable feedback

---

## Rollout Strategy

### Week 1: Core Implementation
- Day 1-2: Tool definitions + system prompt
- Day 3-4: Tool execution handler
- Day 5: New mutations (addTextElement, addAnimation, deleteElement)

### Week 2: Testing & Refinement
- Day 1-2: Manual testing with test cases
- Day 3: Bug fixes and error handling improvements
- Day 4: Performance optimization
- Day 5: Documentation and demo video

### Week 3: Production Deployment
- Deploy to staging
- User acceptance testing
- Production rollout with monitoring

---

## Risk Mitigation

### Risk 1: AI calls wrong tool
**Mitigation:** Detailed tool descriptions, examples in system prompt

### Risk 2: Invalid parameters passed to tools
**Mitigation:** Strict input_schema validation, Convex mutation validation

### Risk 3: Composition gets into invalid state
**Mitigation:** Undo/redo system (already planned), composition validation

### Risk 4: Performance issues with many tool calls
**Mitigation:** Limit max tools per turn (5), cache composition context

---

## Open Questions

1. **Q:** Should we support undo via chat? (e.g., "undo that")
   **A:** Yes, add `undo_last_change` tool for Phase 2

2. **Q:** How to handle element selection ambiguity?
   **A:** Return error with candidates, let AI ask user for clarification

3. **Q:** Should tools return preview URLs?
   **A:** No, UI updates automatically via Convex reactivity

4. **Q:** Rate limiting for tool calls?
   **A:** 5 tools per message initially, monitor and adjust

---

## Conclusion

This plan transforms the chat interface from **conversational-only to fully agentic**, enabling users to edit videos through natural language. The implementation leverages:

- ✅ Anthropic's proven Tool Use API
- ✅ Existing Convex mutation infrastructure
- ✅ Real-time UI updates via Convex reactivity
- ✅ Comprehensive error handling

**Estimated Total Implementation Time:** 10-12 hours
**Estimated Testing Time:** 4-6 hours
**Total Project Time:** 2-3 days

**Next Step:** Begin Phase 1 implementation of tool definitions.
