# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatKut is an open-source chat-based video editor that provides a natural language interface for video editing. It uses Remotion for video rendering, Dedalus SDK for multi-model AI orchestration, and implements a deterministic Plan-Execute-Patch editing architecture.

**Current Status:** ✅ Weeks 3-6 Complete (Frontend UI, Composition Engine, Undo/Redo, Remotion Preview, Cloud Rendering)

## Core Architecture

### Tech Stack
- **Frontend**: Next.js 14 + React 18 + Tailwind CSS
- **Backend**: Convex (metadata, real-time sync, auth)
- **Media Storage**: Cloudflare Stream (video uploads/HLS preview) + R2 (storage)
- **AI Layer**: Dedalus SDK (multi-model routing + MCP tool integration)
- **Video Rendering**: Remotion + Remotion Lambda
- **Export**: CapCut MCP server (Phase 2 - local drafts only)

### Key Design Decisions

#### 1. Plan-Execute-Patch Editing (NOT Full Code Regeneration)
The system uses a **deterministic editing pipeline** instead of regenerating full Remotion code for every edit:

```
User Query → LLM Plan (IR) → Selector Resolution → AST Patch → Updated Code
```

**Critical Files:**
- `convex/ai.ts` - AI actions (sendChatMessage, generateEditPlan, generateRemotionCode)
- `lib/dedalus/client.ts` - Multi-model AI routing with cost tracking
- `lib/composition-engine/ir-helpers.ts` - IR manipulation utilities (CRUD operations, selectors)
- `types/composition-ir.ts` - Composition Intermediate Representation (IR) types
- `remotion/DynamicComposition.tsx` - Renders composition from IR

**Why This Matters:**
- Edits must be **deterministic**: "make second clip louder" always updates the same element
- Every edit creates a reversible **Patch** for undo/redo
- Use **Babel AST manipulation** to modify specific parts of Remotion code
- Elements have stable IDs tracked via `data-element-id` JSX attributes

#### 2. Media Storage Architecture
**CRITICAL**: Convex has ~20MB HTTP action limits and 100MB file size limits.

**Storage Rules:**
- **Convex**: ONLY metadata (asset records, chat messages, composition IR, patches)
- **Cloudflare Stream**: Video/audio uploads (TUS resumable, HLS preview)
- **Cloudflare R2**: Images, rendered MP4s (direct HTTPS URLs)

**Upload Flow:**
```
Browser → Request signed URL (Convex) → Direct TUS upload (Cloudflare) → Webhook (Convex) → HLS ready
```

**Never** upload media files through Convex actions. Always use direct Cloudflare uploads.

#### 3. MCP Security (Backend Proxy Required)
Dedalus MCP auth is not yet supported. **All MCP calls MUST go through Convex backend proxy:**

```typescript
// convex/mcpProxy.ts
export const callMCPTool = action({
  handler: async (ctx, { toolName, parameters, userId }) => {
    // 1. Enforce auth
    // 2. Rate limit (10 calls/min per user)
    // 3. Sanitize parameters (no secrets)
    // 4. Call Dedalus SDK
    // 5. Log usage
  }
});
```

**Security Requirements:**
- Per-user authentication required
- Rate limiting: 10 calls/min (Free), 50/min (Pro)
- Sanitize tool arguments (remove apiKey, token, password, secret fields)
- Audit log for billing and security

#### 4. Remotion Licensing & Cost Tracking
**DO NOT hard-code costs.** Use Remotion's `estimatePrice()` API:

```typescript
import { estimatePrice } from "@remotion/lambda/client";

// Before render: show estimate
const estimate = await estimatePrice({
  region: "us-east-1",
  durationInFrames,
  memorySizeInMb: 2048,
  diskSizeInMb: 2048,
  lambdaEfficiencyLevel: 0.8,
});

// After render: record actual cost for telemetry
await recordActualCost({ renderId, actualCost, renderTime });
```

**License Compliance:**
- Free: Individuals or orgs with ≤3 employees
- Company License required for 4+ employees
- Block renders if non-compliant
- Link to https://remotion.dev/pricing

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# Set up Convex
npx convex dev

# Set up environment variables
cp .env.example .env.local
# Add: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, DEDALUS_API_KEY
```

### Development
```bash
# Run dev server (Next.js + Convex)
npm run dev

# Run Convex functions locally
npx convex dev

# Type check
npm run type-check

# Lint
npm run lint
```

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.spec.ts

# Run tests in watch mode
npm test -- --watch
```

### Deployment
```bash
# Deploy Convex backend
npx convex deploy

# Deploy Next.js frontend (Vercel)
vercel deploy --prod

# Deploy Remotion Lambda bundle
npx remotion lambda deploy
```

## Implementation Details

### Composition IR Structure
The IR is the single source of truth for all video compositions:

```typescript
type CompositionIR = {
  id: string;
  version: number;
  metadata: { width, height, fps, durationInFrames };
  elements: CompositionElement[];
  patches: Patch[]; // For undo/redo
};

type CompositionElement = {
  id: string;              // Stable ID (nanoid)
  type: ElementType;       // video, audio, text, image, sequence
  label?: string;          // User-defined or AI-generated
  from: number;            // Start frame
  durationInFrames: number;
  properties: Record<string, any>;  // Element-specific props
  animations?: Animation[];
  children?: CompositionElement[];  // For nested sequences
};
```

**IR Helpers** (`lib/composition-engine/ir-helpers.ts`):
- `createEmptyComposition()` - Initialize new composition
- `addElement()`, `updateElement()`, `deleteElement()`, `moveElement()` - CRUD operations
- `findElementById()`, `findElementsByLabel()`, `findElementsByType()` - Selectors
- `revertLastPatch()` - Undo implementation
- `validateComposition()` - Ensure IR integrity

### AI Integration Architecture
All AI operations flow through Convex actions in `convex/ai.ts`:

**1. Chat Flow:**
```
User Message → convex/ai.ts:sendChatMessage
  → Get project context (assets, composition, chat history)
  → Build system prompt with context
  → Route to GPT-4o via Dedalus
  → Save assistant response
  → Track token usage and cost
```

**2. Edit Plan Generation:**
```
User Request → convex/ai.ts:generateEditPlan
  → Get current composition IR
  → Build system prompt with IR context
  → Route to Claude Sonnet for structured output
  → Return EditPlan JSON with operation/selector/changes
```

**3. Code Generation:**
```
Composition IR → convex/ai.ts:generateRemotionCode
  → Build system prompt with IR
  → Route to Claude Sonnet (temp=0.3 for determinism)
  → Extract TypeScript code
  → Update composition record
```

### Remotion Rendering Pipeline
The `remotion/DynamicComposition.tsx` component renders from IR:

**Process:**
1. Parse CompositionIR.elements array
2. For each element, create a `<Sequence>` with from/durationInFrames
3. Add `data-element-id` attribute for tracking
4. Apply animations using `interpolate()` from keyframes
5. Render element content based on type (Video, Audio, Img, text div)

**Animation Handling:**
```typescript
const animatedStyle = calculateAnimatedStyle(element, currentFrame);
// Interpolates keyframes: { frame: 0, value: 1.0 } → { frame: 90, value: 1.2 }
// Supports: opacity, scale, x, y, rotation
// Uses Remotion's interpolate() with easing functions
```

### Media Upload Flow
Direct browser-to-Cloudflare uploads (NO files through Convex):

**Video Upload:**
```
1. Browser: Call convex/media.ts:requestStreamUploadUrl
2. Convex: Call Cloudflare Stream API, get TUS endpoint
3. Convex: Create asset record (status: "uploading")
4. Browser: Upload via TUS client directly to Cloudflare
5. Cloudflare: Process video, send webhook to Convex
6. Convex: Update asset (status: "ready", playbackUrl: HLS manifest)
```

**Image Upload:**
```
1. Browser: Call convex/media.ts:requestR2UploadUrl
2. Convex: Generate presigned R2 URL
3. Browser: PUT directly to R2
4. Browser: Call convex/media.ts:completeR2Upload
5. Convex: Update asset (status: "ready", playbackUrl: R2 URL)
```

## Code Patterns

### Convex Queries/Mutations
```typescript
// convex/compositions.ts
import { mutation, query } from "./_generated/server";

export const get = query({
  handler: async (ctx, { compositionId }) => {
    return await ctx.db.get(compositionId);
  },
});

export const update = mutation({
  handler: async (ctx, { compositionId, changes }) => {
    await ctx.db.patch(compositionId, changes);
  },
});
```

### Convex Actions (for external API calls)
```typescript
// convex/media.ts
import { action } from "./_generated/server";

export const requestUploadUrl = action({
  handler: async (ctx, { projectId, filename }) => {
    // Call external API (Cloudflare)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/direct_upload`,
      { /* ... */ }
    );

    // Store metadata in Convex
    await ctx.runMutation(api.assets.create, { /* ... */ });

    return result;
  },
});
```

### Dedalus Multi-Model Routing
```typescript
import { getAIClient, MODEL_ROUTING } from "@/lib/dedalus/client";

const aiClient = getAIClient();

// Code generation: Claude Sonnet 4.5 (best quality)
const codeResponse = await aiClient.generateText({
  task: "code-generation",
  systemPrompt: "Generate Remotion component...",
  prompt: "Create a video with...",
  temperature: 0.3,
});

// Chat responses: GPT-4o (balanced cost/quality)
const chatResponse = await aiClient.generateText({
  task: "chat-response",
  systemPrompt: "You are ChatKut assistant...",
  prompt: userMessage,
  temperature: 0.7,
});

// Edit plans: Claude Sonnet (precise structured output)
const planResponse = await aiClient.generateJSON<EditPlan>({
  task: "plan-generation",
  systemPrompt: "Generate structured edit plan...",
  prompt: userMessage,
});

// All responses include cost tracking:
// { text, model, provider, tokenUsage: { input, output, total }, cost }
```

**Cost Optimization:**
Multi-model routing saves ~32% compared to using Claude for everything by routing simple tasks to cheaper models.

### AST Patching Pattern
```typescript
import * as Babel from "@babel/core";
import traverse from "@babel/traverse";

// Parse Remotion code
const ast = Babel.parse(code, {
  sourceType: "module",
  plugins: ["jsx", "typescript"],
});

// Find element by data-element-id
traverse(ast, {
  JSXOpeningElement(path) {
    const idAttr = path.node.attributes.find(
      attr => attr.name?.name === "data-element-id"
    );

    if (idAttr?.value?.value === targetElementId) {
      // Apply patch to this element
    }
  },
});

// Generate new code
const { code: newCode } = Babel.transformFromAstSync(ast, code, {
  presets: ["@babel/preset-typescript", "@babel/preset-react"],
});
```

## Critical Implementation Notes

### Element Selectors
When implementing edit operations, selectors MUST be unambiguous:

- `{ type: "byId", id: "elem_123" }` - Most precise
- `{ type: "byLabel", label: "Intro Video" }` - User-friendly
- `{ type: "byType", elementType: "video", index: 1 }` - Positional (e.g., "second clip")
- `{ type: "byIndex", index: 0 }` - Top-level elements only

**If selector matches 0 elements:** Return error with suggestions
**If selector matches 1 element:** Proceed with edit
**If selector matches 2+ elements:** Show disambiguator UI

### Undo/Redo Stack
Every edit must create a Patch object:
```typescript
type Patch = {
  id: string;
  timestamp: number;
  operation: "add" | "update" | "delete" | "move";
  selector: ElementSelector;
  changes: any;
  previousState?: any; // For undo
};
```

Undo: Revert last patch and regenerate code
Redo: Reapply patch from redo stack

### Edit Receipts
After every successful edit, generate a user-friendly receipt:
```
✓ Updated video "Intro.mp4":
  - Added zoom animation (1.0x → 1.2x over 3s)
```

Include an undo button for instant reversal.

## File Organization

```
chatkut/
├── app/                    # Next.js 14 app router
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── (dashboard)/       # Main app pages
│   └── api/               # API routes (webhooks)
├── components/            # React components
│   ├── chat/             # Chat interface components
│   ├── editor/           # Video editor UI
│   ├── player/           # HLS + Remotion players
│   └── upload/           # TUS upload widget
├── convex/               # Convex backend
│   ├── _generated/       # Generated types
│   ├── schema.ts         # Database schema
│   ├── compositions.ts   # Composition CRUD
│   ├── media.ts          # Cloudflare integration
│   ├── mcpProxy.ts       # MCP backend proxy
│   ├── rendering.ts      # Remotion Lambda
│   └── auth.ts           # Authentication
├── lib/                  # Shared utilities
│   ├── composition-engine/
│   │   ├── planner.ts    # Edit plan generation
│   │   ├── executor.ts   # AST patching
│   │   ├── selectors.ts  # Selector resolution
│   │   └── compiler.ts   # IR → Remotion code
│   ├── dedalus/          # Dedalus SDK wrappers
│   └── utils/            # Helpers
├── types/                # TypeScript types
│   └── composition-ir.ts # IR type definitions
└── remotion/             # Remotion compositions
    └── templates/        # Starter templates
```

## Architecture References

For detailed architecture information, see:
- `chatkut-prd-v3.1-production-ready.md` - Complete PRD with all design decisions
- Section 1: Media Storage Strategy - Cloudflare integration
- Section 2: MCP Security Posture - Backend proxy implementation
- Section 3: Remotion Costs & Licensing - Dynamic cost tracking
- Section 5: Deterministic Editing - Plan-Execute-Patch architecture

## Key Constraints

1. **No media files through Convex** - Use Cloudflare direct uploads only
2. **All MCP calls via backend proxy** - Never expose MCP tokens to frontend
3. **Deterministic editing** - Use Plan-Execute-Patch, not full code regeneration
4. **Cost transparency** - Always show estimates before renders
5. **License compliance** - Check org size before rendering
6. **Multi-model optimization** - Route to appropriate model based on task
7. **Undo/redo support** - Every edit must be reversible

## Phase 1 Scope (MVP - 8 weeks)

**COMPLETED (Week 1-2):**
- ✅ Next.js 14 + TypeScript + Tailwind setup
- ✅ Convex backend with complete schema (11 tables)
- ✅ Composition IR type system with CRUD operations
- ✅ Cloudflare Stream + R2 integration (media.ts)
- ✅ Dedalus AI integration with multi-model routing
- ✅ AI actions: sendChatMessage, generateEditPlan, generateRemotionCode
- ✅ Remotion configuration and DynamicComposition component

**IN PROGRESS (Week 3-4):**
- Chat UI component with message list
- TUS upload widget for video files
- HLS video player component
- Asset library UI
- Project dashboard layout

**IN SCOPE (Remaining):**
- Plan-Execute-Patch editing with undo/redo
- Remotion Lambda rendering with cost estimation
- Disambiguator UI for ambiguous selectors
- Edit receipts for user feedback
- AST patching for code modifications

**OUT OF SCOPE (Phase 2+):**
- CapCut export (local drafts only, Phase 2)
- Real-time collaboration
- Template library
- Advanced effects (Canvas, WebGL)
- Mobile app
- Bulk operations

## Testing Strategy

### Must Test
- **Upload resumability**: 1GB video upload interrupted and resumed
- **Edit determinism**: "make second clip louder" always selects same element
- **Undo/redo**: Every edit is reversible
- **Cost accuracy**: Render estimates within ±20% of actual
- **Security**: MCP rate limits enforced
- **Ambiguity handling**: Multiple matches show disambiguator UI
- **Preview latency**: P95 edit→preview <5 seconds
- **Plan validity**: >90% of selectors resolve correctly

### Test Data
- Use sample videos from Cloudflare Stream test assets
- Test with 1MB, 100MB, 1GB video files
- Test ambiguous queries ("make the video louder" with 3 videos)
- Test complex compositions (10+ elements)
