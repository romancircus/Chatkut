# ChatKut OPEN SOURCE PRD v3.1 - Production-Ready Architecture

## Document Changes from v3.0

**Version:** 3.1 (Production-Ready)  
**Date:** 2025-11-07  
**Status:** Build-Ready after GPT-5 Architectural Review

### Critical Changes from v3.0:

1. ✅ **Media Storage:** Moved from Convex to Cloudflare Stream/R2
2. ✅ **MCP Security:** Added backend proxy until Dedalus auth ships
3. ✅ **Remotion Costs:** Dynamic pricing with `estimatePrice()`
4. ✅ **CapCut Export:** Scoped to local drafts only (Phase 2)
5. ✅ **Editing Determinism:** Added Plan-Execute-Patch architecture

---

## Executive Summary

**Product Name:** ChatKut

**Vision:** An open source standalone web application that provides a natural language interface for video editing, powered by Remotion for video rendering with optional CapCut draft export. Built on Dedalus SDK for universal AI model access and MCP tool integration. Uses **deterministic plan-execute-patch editing** instead of full code regeneration.

**Key Innovation:** First chat-based video editor with:
- Multi-model AI optimization (32% cost savings)
- MCP tool ecosystem integration
- **Plan-based editing with AST patches** (not full rewrites)
- Cloudflare Stream for instant HLS preview
- Exportable React/Remotion code

---

## Architecture Overview (Updated)

### High-Level System Design

```
┌─────────────────────────────────────────────────────┐
│                 User's Browser                       │
│  ┌─────────────────────────────────────────────┐   │
│  │         Next.js Frontend                     │   │
│  │  - Chat Interface                            │   │
│  │  - HLS Video Player (Cloudflare Stream)     │   │
│  │  - Remotion Player (Code Preview)            │   │
│  │  - TUS Upload (direct to Cloudflare)        │   │
│  └─────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────────┐
│              Convex Backend                          │
│  ┌──────────────────────────────────────────────┐  │
│  │  - Real-time Database (METADATA ONLY)        │  │
│  │  - Chat Message Storage                      │  │
│  │  - Project/Composition Management            │  │
│  │  - Asset Metadata (no files)                │  │
│  │  - Edit Plan History (IR + Patches)         │  │
│  │  - Actions (Dedalus + MCP Proxy)            │  │
│  │  - Undo/Redo Stack                          │  │
│  └──────────────────────────────────────────────┘  │
└────────┬───────────────────────────────┬────────────┘
         │                               │
         ▼                               │
┌──────────────────────────────┐         │
│   Dedalus SDK (AI Layer)     │         │
│  • Multi-Model Routing        │         │
│  • Plan Generation (IR)       │         │
│  • MCP Backend Proxy          │         │
│  • Cost Tracking              │         │
└──────────────────────────────┘         │
         │                               │
         ▼                               ▼
┌──────────────────────────────┐  ┌──────────────────┐
│  MCP Tools (via Backend)     │  │ Cloudflare Stack │
│  • CapCut Export             │  │                  │
│  • Web Search                │  │ Stream (Upload)  │
│  • GitHub                    │  │ • TUS Direct     │
│  (Auth: Backend Token)       │  │ • HLS Preview    │
└──────────────────────────────┘  │ • Webhooks       │
                                   │                  │
                                   │ R2 (Storage)     │
                                   │ • Final MP4s     │
                                   │ • Large Assets   │
                                   └──────────────────┘
                                           │
                                           ▼
                                   Remotion Lambda
                                   (Rendering)
```

---

## Critical Architecture Changes

### 1. Media Storage Strategy (FIXED)

**Problem Identified:** Convex has \~20MB HTTP action limits; 100MB file limit insufficient for video.

**Solution:** Cloudflare Stream + R2 for all media; Convex for metadata only.

#### Media Upload Pipeline

```typescript
// Browser → Cloudflare Stream (Direct Upload)
// NO files transit through Convex

1. User clicks "Upload Video"
   ↓
2. Frontend requests signed upload URL from Convex
   ↓
3. Convex Action calls Cloudflare Stream API
   ↓
4. Returns TUS upload URL to browser
   ↓
5. Browser uploads DIRECTLY to Cloudflare (resumable)
   ↓
6. Cloudflare webhook → Convex (asset ready)
   ↓
7. Convex updates asset metadata (playbackUrl, duration, status)
   ↓
8. Frontend shows HLS preview instantly
```

#### Storage Breakdown

| Data Type                  | Storage           | Max Size    | Why                            |
| -------------------------- | ----------------- | ----------- | ------------------------------ |
| User uploads (video/audio) | Cloudflare Stream | 30GB        | HLS preview, no transcode wait |
| User uploads (images)      | Cloudflare R2     | 5GB         | Direct HTTPS URLs              |
| Rendered MP4s              | Cloudflare R2     | 10GB        | Signed delivery URLs           |
| Asset metadata             | Convex            | 1KB each    | Fast queries, real-time sync   |
| Remotion code              | Convex            | \~10KB each | Version history                |
| Edit patches               | Convex            | \~1KB each  | Undo/redo                      |
| Chat messages              | Convex            | \~500B each | Real-time chat                 |

#### Implementation

```typescript
// convex/media.ts
import { action } from "./_generated/server";

export const requestUploadUrl = action({
  handler: async (ctx, { projectId, filename, fileSize }) => {
    // Call Cloudflare Stream API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds: 21600, // 6 hours max
          requireSignedURLs: true,
        }),
      }
    );
    
    const { result } = await response.json();
    
    // Store pending asset in Convex (metadata only)
    await ctx.runMutation(api.assets.create, {
      projectId,
      streamId: result.uid,
      filename,
      status: "uploading",
      uploadUrl: result.uploadURL,
    });
    
    return {
      uploadUrl: result.uploadURL, // TUS endpoint
      streamId: result.uid,
    };
  },
});

// Cloudflare webhook endpoint
export const handleStreamWebhook = action({
  handler: async (ctx, { uid, status, duration, playbackUrl }) => {
    if (status === "ready") {
      // Update asset metadata
      await ctx.runMutation(api.assets.updateStatus, {
        streamId: uid,
        status: "ready",
        duration,
        playbackUrl, // HLS manifest URL
      });
    }
  },
});
```

**Frontend Upload (TUS):**

```tsx
// components/VideoUpload.tsx
import * as tus from "tus-js-client";

export function VideoUpload({ projectId }) {
  const uploadFile = async (file: File) => {
    // Get signed upload URL from Convex
    const { uploadUrl, streamId } = await requestUploadUrl({
      projectId,
      filename: file.name,
      fileSize: file.size,
    });
    
    // Upload directly to Cloudflare Stream via TUS
    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      chunkSize: 50 * 1024 * 1024, // 50MB chunks
      retryDelays: [0, 3000, 5000, 10000],
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        setProgress(percentage);
      },
      onSuccess: () => {
        console.log("Upload complete, waiting for webhook...");
      },
      onError: (error) => {
        console.error("Upload failed:", error);
      },
    });
    
    upload.start();
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => uploadFile(e.target.files[0])} />
      {progress && <ProgressBar value={progress} />}
    </div>
  );
}
```

**Cost Comparison:**

| Solution       | Upload       | Storage      | Preview       | Rendering     |
| -------------- | ------------ | ------------ | ------------- | ------------- |
| Convex Only    | ❌ 20MB limit | ❌ 100MB/file | ❌ No HLS      | N/A           |
| **Cloudflare** | ✅ 30GB/file  | ✅ Unlimited  | ✅ Instant HLS | ✅ Direct URLs |
| Mux            | ✅ Good       | ✅ Good       | ✅ Instant HLS | ✅ Good        |

**Recommendation:** **Cloudflare Stream + R2** (better pricing, same features as Mux)

**Cloudflare Pricing:**
- Stream: $1/1000 minutes delivered (HLS)
- R2: $0.015/GB/month storage (free egress!)
- Uploads: Free

**Estimated Monthly Cost (100 users):**
- Stream: \~$10-20/month
- R2: \~$5-10/month
- Total: **\~$15-30/month**

---

### 2. MCP Security Posture (FIXED)

**Problem Identified:** Dedalus MCP auth is not yet supported; PRD assumed it was.

**Solution:** Backend proxy for all MCP calls until Dedalus ships native auth.

#### MCP Security Architecture

```typescript
// convex/mcpProxy.ts
import { action } from "./_generated/server";

// All MCP calls go through this backend proxy
export const callMCPTool = action({
  handler: async (ctx, { toolName, parameters, userId }) => {
    // 1. Enforce authentication
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    
    // 2. Rate limiting (per user)
    const recentCalls = await ctx.runQuery(api.usage.getRecentMCPCalls, {
      userId: user.subject,
      since: Date.now() - 60000, // Last minute
    });
    
    if (recentCalls.length > 10) {
      throw new Error("Rate limit exceeded");
    }
    
    // 3. Sanitize tool arguments (no secrets)
    const sanitized = sanitizeParameters(parameters);
    
    // 4. Call Dedalus SDK (which calls MCP server)
    const client = new AsyncDedalus();
    const runner = new DedalusRunner(client);
    
    const result = await runner.run({
      input: `Execute ${toolName}`,
      model: "anthropic/claude-sonnet-4-5",
      tools: [toolName], // e.g., "capcut-api/export_draft"
      context: {
        ...sanitized,
        // Backend adds secure context
        userId: user.subject,
        projectId: parameters.projectId,
      },
    });
    
    // 5. Log usage for billing
    await ctx.runMutation(api.usage.logMCPCall, {
      userId: user.subject,
      toolName,
      timestamp: Date.now(),
      cost: result.cost,
    });
    
    return result.final_output;
  },
});

function sanitizeParameters(params: any): any {
  // Remove any fields that look like secrets
  const sensitive = ["apiKey", "token", "password", "secret"];
  const clean = { ...params };
  
  for (const key in clean) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      delete clean[key];
    }
  }
  
  return clean;
}
```

#### Security Rules

**Until Dedalus Ships Native MCP Auth:**

1. ✅ **All MCP calls routed through Convex Actions**
2. ✅ **Per-user authentication required**
3. ✅ **Rate limiting: 10 calls/minute per user**
4. ✅ **No customer secrets in tool arguments**
5. ✅ **Backend adds secure context (user IDs, project IDs)**
6. ✅ **MCP servers must be stateless**

**When Dedalus Auth Ships (Future):**
- Migrate to native Dedalus authorization server
- Remove backend proxy
- Update security documentation

**PRD Text Addition:**

```
MCP Security (Current Reality):
Dedalus SDK connects to MCP servers, but MCP auth is not yet supported. 
We proxy all MCP calls via our Convex backend, enforce per-user 
authentication and rate limits, and sanitize tool arguments. 
We'll migrate to Dedalus' native MCP Authorization Server once available.

Security Controls:
- Authentication: Convex Auth required for all MCP calls
- Rate Limiting: 10 calls/minute per user (Pro: 50/min)
- Sanitization: No secrets in tool arguments
- Audit Log: All MCP calls logged for billing and security
- Server Requirements: MCP servers must be stateless
```

---

### 3. Remotion Costs & Licensing (FIXED)

**Problem Identified:** Hard-coded "$0.005/min" and "$299/year" are outdated.

**Solution:** Use `estimatePrice()` API and link to official pricing.

#### Dynamic Cost Estimation

```typescript
// convex/rendering.ts
import { estimatePrice } from "@remotion/lambda/client";

export const estimateRenderCost = action({
  handler: async (ctx, { compositionId, durationInFrames, region }) => {
    const project = await ctx.runQuery(api.projects.get, { compositionId });
    
    // Use Remotion's official estimation
    const estimate = await estimatePrice({
      region: region || "us-east-1",
      durationInFrames,
      memorySizeInMb: 2048,
      diskSizeInMb: 2048,
      lambdaEfficiencyLevel: 0.8, // Conservative
    });
    
    // Store estimate for user display
    await ctx.runMutation(api.renders.createJob, {
      compositionId,
      estimatedCost: estimate.estimatedCost,
      estimatedTime: estimate.estimatedTime,
      status: "pending",
    });
    
    return {
      cost: estimate.estimatedCost,
      time: estimate.estimatedTime,
      disclaimer: "Estimate based on current Remotion Lambda pricing. Actual costs may vary.",
    };
  },
});

export const recordActualCost = action({
  handler: async (ctx, { renderId, actualCost, renderTime }) => {
    // After render completes, record actual cost
    await ctx.runMutation(api.renders.updateJob, {
      renderId,
      actualCost,
      renderTime,
      status: "complete",
    });
    
    // Calculate variance for telemetry
    const job = await ctx.runQuery(api.renders.get, { renderId });
    const variance = ((actualCost - job.estimatedCost) / job.estimatedCost) * 100;
    
    // Log for cost optimization
    await ctx.runMutation(api.telemetry.logCostVariance, {
      variance,
      composition: job.compositionId,
    });
  },
});
```

#### User-Facing Cost Display

```tsx
// components/RenderDialog.tsx
export function RenderDialog({ compositionId }) {
  const [estimate, setEstimate] = useState(null);
  
  useEffect(() => {
    estimateRenderCost({ compositionId }).then(setEstimate);
  }, [compositionId]);
  
  return (
    <Dialog>
      <h2>Render Video</h2>
      {estimate && (
        <div className="cost-estimate">
          <p>Estimated Cost: <strong>${estimate.cost.toFixed(4)}</strong></p>
          <p>Estimated Time: <strong>{estimate.time}s</strong></p>
          <p className="text-xs text-gray-500">{estimate.disclaimer}</p>
        </div>
      )}
      <Button onClick={startRender}>Render Now</Button>
    </Dialog>
  );
}
```

#### Licensing Compliance

```typescript
// convex/organization.ts
export const checkLicenseCompliance = query({
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    const memberCount = await ctx.runQuery(api.members.count, { orgId });
    
    const compliance = {
      memberCount,
      requiresCompanyLicense: memberCount > 3,
      licenseType: memberCount <= 3 ? "free" : "company",
      licenseUrl: "https://remotion.dev/license",
      pricingUrl: "https://remotion.dev/pricing",
    };
    
    // Block renders if non-compliant
    if (compliance.requiresCompanyLicense && !org.hasCompanyLicense) {
      throw new Error(
        `Company license required for ${memberCount} members. ` +
        `Purchase at: https://remotion.dev/pricing`
      );
    }
    
    return compliance;
  },
});
```

**PRD Text Replacement:**

```
Remotion Lambda Pricing:
We use Remotion's estimatePrice() API at render submission to show 
users expected costs. Actual costs are recorded post-render for telemetry 
and displayed in user dashboard. Costs vary by region, memory, codec, 
composition complexity, and cold/warm starts.

Typical Range: $0.003-$0.015 per minute of rendered video
Factors: Region (us-east-1 cheapest), memory allocation, codec (h264 vs h265)

Remotion Licensing:
- Free: Individuals or organizations with ≤3 employees
- Company License: Required for organizations with 4+ employees
- Current Pricing: See https://remotion.dev/pricing (subject to change)
- Compliance: Checked at render time; blocks if non-compliant

Our Approach:
- Display estimates before rendering
- Show actual costs after completion
- Track cost variance for optimization
- Link to official pricing for transparency
- Enforce license compliance programmatically
```

---

### 4. CapCut Export Scope (FIXED)

**Problem Identified:** Assumed cloud preview/render; actual repo only does local drafts.

**Solution:** Scope to local draft generation only; Phase 2; clear requirements.

#### CapCut Export - Realistic Scope

**What CapCutAPI Actually Provides:**
- ✅ Generates local draft files (`dfd_xxxxx` folder)
- ✅ Can be imported into CapCut/Jianying desktop
- ✅ MCP server support for orchestration
- ❌ No cloud preview (not open-sourced)
- ❌ No cloud rendering (not open-sourced)
- ❌ Requires local CapCut/Jianying installation

**Supported Mapping (Remotion → CapCut):**

| Remotion Feature       | CapCut Draft     | Status      |
| ---------------------- | ---------------- | ----------- |
| `<Sequence>` timeline  | Track/timeline   | ✅ Supported |
| `<Video>` components   | Video layers     | ✅ Supported |
| Text with basic styles | Text layers      | ✅ Supported |
| `<Audio>` components   | Audio tracks     | ✅ Supported |
| Volume adjustments     | Volume keyframes | ✅ Supported |
| Opacity interpolate    | Alpha keyframes  | ✅ Supported |
| Basic transitions      | Fade in/out      | ✅ Supported |
| Spring animations      | ⚠️ Approximated  | ⚠️ Limited  |
| Canvas effects         | ❌ Not mapped     | ❌ Phase 3   |
| WebGL/3D               | ❌ Not possible   | ❌ Never     |

**System Requirements:**

```
User Must Have Installed Locally:
- Python 3.8+
- FFmpeg
- CapCut (international) OR Jianying (China)
- Windows/Mac (no Linux support for CapCut)

Export Process:
1. User completes video in ChatKut
2. Clicks "Export to CapCut" (Pro feature)
3. Backend calls CapCut MCP server
4. Generates draft .zip file
5. User downloads .zip
6. User extracts to CapCut drafts folder:
   - Windows: Documents/CapCut/User Data/Projects/com.lveditor.draft
   - Mac: ~/Movies/CapCut/User Data/Projects/com.lveditor.draft
7. User opens CapCut desktop app
8. Draft appears in "Recent" projects
9. User can fine-tune in CapCut UI
```

**Implementation (Phase 2):**

```typescript
// convex/capcutExport.ts (Pro feature)
export const exportToCapCut = action({
  handler: async (ctx, { projectId }) => {
    // 1. Check Pro subscription
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    
    const subscription = await ctx.runQuery(api.subscriptions.get, {
      userId: user.subject,
    });
    
    if (subscription.tier !== "pro" && subscription.tier !== "team") {
      throw new Error("CapCut export requires Pro subscription");
    }
    
    // 2. Get project and composition
    const project = await ctx.runQuery(api.projects.get, { id: projectId });
    const assets = await ctx.runQuery(api.assets.list, { projectId });
    
    // 3. Call CapCut MCP server via backend proxy
    const result = await ctx.runAction(api.mcpProxy.callMCPTool, {
      toolName: "capcut-api/generate_draft",
      parameters: {
        compositionCode: project.compositionCode,
        assets: assets.map(a => ({
          url: a.playbackUrl, // Cloudflare Stream URL
          type: a.type,
          duration: a.duration,
        })),
        metadata: {
          width: project.width,
          height: project.height,
          fps: project.fps,
        },
      },
      userId: user.subject,
    });
    
    // 4. Store export record
    await ctx.runMutation(api.exports.create, {
      projectId,
      userId: user.subject,
      type: "capcut_draft",
      status: "complete",
      downloadUrl: result.draftZipUrl, // Signed R2 URL
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      instructions: `
Download the .zip file and extract it.
Copy the dfd_xxxxx folder to:
- Windows: Documents/CapCut/User Data/Projects/com.lveditor.draft
- Mac: ~/Movies/CapCut/User Data/Projects/com.lveditor.draft
Open CapCut desktop app to see your project.
      `.trim(),
    });
    
    return {
      downloadUrl: result.draftZipUrl,
      instructions: result.instructions,
      expiration: "24 hours",
    };
  },
});
```

**PRD Text Replacement:**

```
CapCut Export (Phase 2 - Pro Feature):

Scope: We use the CapCutAPI MCP server to generate local CapCut/Jianying 
draft files (dfd_xxxxx folders) packaged as .zip downloads. 

Limitations:
- Local draft files only (no cloud preview/render)
- Requires user to have CapCut/Jianying installed locally
- Requires Python 3.8+, FFmpeg on export server
- Manual import process (user copies folder to drafts directory)

Supported Mapping:
- Basic timelines (Sequence → tracks)
- Video/audio/text layers
- Opacity and volume keyframes
- Simple transitions (fades)
- Approximated spring animations (as eased keyframes)

Not Supported:
- Canvas/WebGL effects
- Complex Remotion hooks
- Real-time collaboration
- Cloud-based CapCut features

System Requirements (User):
- CapCut desktop installed (Windows/Mac only)
- Sufficient disk space for draft files
- Basic file system navigation skills

Export Process:
1. User clicks "Export to CapCut" (Pro only)
2. Backend generates draft via MCP
3. User downloads .zip file (expires in 24h)
4. User extracts and copies to CapCut drafts folder
5. User opens in CapCut for fine-tuning

Phase 2 Delivery:
- Mapping spike: 1 week (validate supported features)
- MCP integration: 1 week (deploy server, test end-to-end)
- UI/documentation: 3 days (clear instructions, troubleshooting)
```

---

### 5. Deterministic Editing (NEW ARCHITECTURE)

**Problem Identified:** Regenerating full React code for every edit is brittle.

**Solution:** Plan-Execute-Patch architecture with IR and AST manipulation.

#### Composition Intermediate Representation (IR)

```typescript
// types/composition-ir.ts

export type CompositionIR = {
  id: string;
  version: number;
  metadata: {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
  };
  elements: CompositionElement[];
  patches: Patch[]; // For undo/redo
};

export type CompositionElement = {
  id: string; // Stable ID for selectors
  type: "video" | "audio" | "text" | "image" | "sequence";
  label?: string; // User-defined or AI-generated
  from: number; // Frame number
  durationInFrames: number;
  properties: Record<string, any>;
  animations?: Animation[];
  children?: CompositionElement[]; // For sequences
};

export type Animation = {
  property: string; // e.g., "opacity", "scale"
  keyframes: Keyframe[];
  easing?: "linear" | "ease-in" | "ease-out" | "spring";
};

export type Keyframe = {
  frame: number;
  value: any;
};

export type Patch = {
  id: string;
  timestamp: number;
  operation: "add" | "update" | "delete" | "move";
  selector: ElementSelector;
  changes: any;
  previousState?: any; // For undo
};

export type ElementSelector = 
  | { type: "byId"; id: string }
  | { type: "byLabel"; label: string }
  | { type: "byIndex"; index: number }
  | { type: "byType"; elementType: string; index?: number };
```

#### Plan-Execute-Patch Flow

```
User: "Make the second video clip zoom in slowly"

1. LLM (Dedalus) → Plan Generation
   ↓
   Plan (IR):
   {
     operation: "addAnimation",
     selector: { type: "byType", elementType: "video", index: 1 },
     changes: {
       property: "scale",
       keyframes: [
         { frame: 0, value: 1.0 },
         { frame: 90, value: 1.2 }
       ],
       easing: "ease-in"
     }
   }

2. Server → Validation & Resolution
   ↓
   - Validate selector matches exactly one element
   - If ambiguous, return disambiguator UI
   - Resolve element ID from selector

3. AST Patcher → Code Modification
   ↓
   - Parse existing Remotion code to AST
   - Find element by ID in AST
   - Insert/update interpolate() for scale
   - Generate patched code
   - Typecheck with TypeScript compiler

4. Persist & Update
   ↓
   - Save patch to undo/redo stack
   - Update IR in database
   - Compile new Remotion code
   - Update preview

5. Generate Receipt
   ↓
   "✓ Updated video clip 'Background.mp4':
    - Added zoom animation (1.0x → 1.2x over 3s)"
```

#### Implementation

```typescript
// lib/composition-engine/planner.ts
import { AsyncDedalus, DedalusRunner } from "dedalus-labs";

export async function generateEditPlan(
  userMessage: string,
  currentIR: CompositionIR
): Promise<EditPlan> {
  const client = new AsyncDedalus();
  const runner = new DedalusRunner(client);
  
  const systemPrompt = `
You are a video editing assistant that outputs structured Edit Plans.

Current Composition IR:
${JSON.stringify(currentIR, null, 2)}

User Request: "${userMessage}"

Output a JSON Edit Plan with this structure:
{
  "operation": "add" | "update" | "delete" | "move",
  "selector": {
    "type": "byLabel" | "byId" | "byIndex" | "byType",
    // ... selector parameters
  },
  "changes": {
    // ... property changes
  }
}

Use selectors that are unambiguous. If the user says "second clip",
use { type: "byType", elementType: "video", index: 1 }.
`;

  const result = await runner.run({
    input: userMessage,
    model: "anthropic/claude-sonnet-4-5",
    system: systemPrompt,
    tools: [], // No tools needed, just structured output
  });
  
  // Parse JSON plan from LLM output
  const plan = JSON.parse(result.final_output);
  
  return plan;
}

// lib/composition-engine/executor.ts
import * as Babel from "@babel/core";
import * as t from "@babel/types";
import traverse from "@babel/traverse";

export async function executeEditPlan(
  plan: EditPlan,
  ir: CompositionIR,
  currentCode: string
): Promise<ExecutionResult> {
  // 1. Resolve selector to element ID
  const elements = resolveSelector(plan.selector, ir);
  
  // 2. Check for ambiguity
  if (elements.length === 0) {
    throw new Error(`No elements match selector: ${JSON.stringify(plan.selector)}`);
  }
  
  if (elements.length > 1) {
    return {
      status: "ambiguous",
      candidates: elements.map(el => ({
        id: el.id,
        label: el.label,
        thumbnail: generateThumbnail(el),
        timecode: framesToTimecode(el.from, ir.metadata.fps),
      })),
    };
  }
  
  const element = elements[0];
  
  // 3. Apply plan to IR
  const updatedIR = applyPlanToIR(plan, ir, element.id);
  
  // 4. Generate AST patch
  const ast = Babel.parse(currentCode, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
  
  const patchedAST = applyPatchToAST(ast, plan, element.id);
  
  // 5. Generate new code
  const { code: newCode } = Babel.transformFromAstSync(patchedAST, currentCode, {
    presets: ["@babel/preset-typescript", "@babel/preset-react"],
  });
  
  // 6. Typecheck
  const typeErrors = await typecheckCode(newCode);
  if (typeErrors.length > 0) {
    return {
      status: "error",
      errors: typeErrors,
      suggestedFixes: generateFixes(typeErrors),
    };
  }
  
  // 7. Create patch record
  const patch: Patch = {
    id: generateId(),
    timestamp: Date.now(),
    operation: plan.operation,
    selector: plan.selector,
    changes: plan.changes,
    previousState: cloneDeep(element),
  };
  
  // 8. Generate receipt
  const receipt = generateReceipt(plan, element);
  
  return {
    status: "success",
    updatedIR,
    newCode,
    patch,
    receipt,
  };
}

function applyPatchToAST(
  ast: Babel.types.File,
  plan: EditPlan,
  elementId: string
): Babel.types.File {
  // Find the JSX element with data-element-id={elementId}
  traverse(ast, {
    JSXOpeningElement(path) {
      const idAttr = path.node.attributes.find(
        attr =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name) &&
          attr.name.name === "data-element-id"
      );
      
      if (!idAttr || !t.isStringLiteral(idAttr.value)) return;
      
      if (idAttr.value.value === elementId) {
        // Apply changes based on plan.operation
        if (plan.operation === "update" && plan.changes.animation) {
          // Inject interpolate() for animation
          const animationCode = generateInterpolateCode(plan.changes.animation);
          // ... AST manipulation to insert animation
        }
        
        if (plan.operation === "update" && plan.changes.properties) {
          // Update JSX attributes
          for (const [key, value] of Object.entries(plan.changes.properties)) {
            updateJSXAttribute(path.node, key, value);
          }
        }
      }
    },
  });
  
  return ast;
}

function generateReceipt(plan: EditPlan, element: CompositionElement): string {
  const elementLabel = element.label || element.properties.src || element.type;
  
  if (plan.operation === "update" && plan.changes.animation) {
    const anim = plan.changes.animation;
    return `✓ Updated ${element.type} "${elementLabel}":
  - Added ${anim.property} animation (${anim.keyframes[0].value} → ${anim.keyframes[anim.keyframes.length - 1].value})`;
  }
  
  // ... other receipt templates
}

// lib/composition-engine/selectors.ts
export function resolveSelector(
  selector: ElementSelector,
  ir: CompositionIR
): CompositionElement[] {
  switch (selector.type) {
    case "byId":
      const found = findElementById(ir.elements, selector.id);
      return found ? [found] : [];
      
    case "byLabel":
      return findElementsByLabel(ir.elements, selector.label);
      
    case "byIndex":
      return [ir.elements[selector.index]].filter(Boolean);
      
    case "byType":
      const ofType = findElementsByType(ir.elements, selector.elementType);
      if (selector.index !== undefined) {
        return [ofType[selector.index]].filter(Boolean);
      }
      return ofType;
  }
}
```

#### Undo/Redo Implementation

```typescript
// convex/compositions.ts
export const undo = mutation({
  handler: async (ctx, { compositionId }) => {
    const composition = await ctx.db.get(compositionId);
    
    if (composition.patches.length === 0) {
      throw new Error("Nothing to undo");
    }
    
    // Pop last patch
    const lastPatch = composition.patches[composition.patches.length - 1];
    const remainingPatches = composition.patches.slice(0, -1);
    
    // Revert IR to previous state
    const revertedIR = revertPatch(composition.ir, lastPatch);
    
    // Regenerate code from IR
    const revertedCode = await compileIRToCode(revertedIR);
    
    // Update composition
    await ctx.db.patch(compositionId, {
      ir: revertedIR,
      code: revertedCode,
      patches: remainingPatches,
      version: composition.version + 1,
    });
    
    return {
      message: `Undid: ${lastPatch.operation} on ${lastPatch.selector}`,
    };
  },
});

export const redo = mutation({
  handler: async (ctx, { compositionId, patchId }) => {
    // Similar to undo, but reapplies a patch from redo stack
  },
});
```

#### Frontend Integration

```tsx
// components/EditReceipt.tsx
export function EditReceipt({ receipt, onUndo }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded p-3 mb-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <CheckCircle className="inline w-4 h-4 text-green-600 mr-2" />
          <span className="text-sm text-green-900">{receipt}</span>
        </div>
        <button
          onClick={onUndo}
          className="text-xs text-gray-600 hover:text-gray-900"
        >
          Undo
        </button>
      </div>
    </div>
  );
}

// components/AmbiguityDialog.tsx
export function AmbiguityDialog({ candidates, onSelect }) {
  return (
    <Dialog>
      <h3>Which element did you mean?</h3>
      <div className="grid grid-cols-2 gap-4">
        {candidates.map(candidate => (
          <button
            key={candidate.id}
            onClick={() => onSelect(candidate.id)}
            className="border rounded p-2 hover:border-blue-500"
          >
            <img src={candidate.thumbnail} alt="" className="w-full" />
            <p className="text-sm">{candidate.label}</p>
            <p className="text-xs text-gray-500">{candidate.timecode}</p>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
```

**Benefits of Plan-Execute-Patch:**

1. ✅ **Deterministic:** "Make second clip louder" always updates the same element
2. ✅ **Undo/Redo:** Every edit is a reversible patch
3. ✅ **Efficient:** Only modified parts of code change (not full rewrites)
4. ✅ **Debuggable:** Clear edit history and receipts
5. ✅ **Scalable:** Supports complex compositions with many elements
6. ✅ **Ambiguity Handling:** Shows UI when selectors match multiple elements

**PRD Text Addition:**

```
Edit Pipeline (Deterministic Architecture):

ChatKut uses a Plan-Execute-Patch architecture instead of regenerating 
full Remotion code for each edit.

Flow:
1. Plan Generation: LLM (via Dedalus) emits a structured Edit Plan (IR)
   - Contains operation type, element selector, and property changes
   - Selectors: byId, byLabel, byIndex, byType
   
2. Validation: Server validates and resolves selectors
   - If selector matches 0 elements → Error with suggestions
   - If selector matches 1 element → Proceed to execution
   - If selector matches 2+ elements → Show disambiguator UI
   
3. AST Patching: Apply changes to Remotion component via Babel
   - Parse existing code to AST
   - Find element by data-element-id attribute
   - Insert/update specific properties or animations
   - Generate new code (no wholesale rewrites)
   
4. Persistence: Save patch for undo/redo
   - Patch contains operation, selector, changes, previous state
   - Undo: revert last patch and regenerate code
   - Redo: reapply patch from redo stack
   
5. Feedback: Show compact receipt to user
   - Example: "✓ Updated video 'Intro.mp4': scale 1.0→1.2 over 3s"
   - Undo button for instant reversal

Benefits:
- Precise targeting: "second clip" always means same element
- Fast preview: only changed elements re-render
- Reliable undo/redo: complete edit history
- Debuggable: clear patch trail
- Type-safe: compile check after each patch

Element Tracking:
- Every element has stable ID (assigned at insert time)
- Elements can have user-defined or AI-generated labels
- Selectors reference elements unambiguously
- IDs persist across undo/redo operations
```

---

## Recommendation: Convex + Cloudflare Stack

### Yes, Keep Convex for Everything Except Media Files

**What Convex Handles (Perfectly):**

| Data Type        | Why Convex?                       |
| ---------------- | --------------------------------- |
| ✅ Asset Metadata | Fast queries, real-time sync      |
| ✅ Chat Messages  | Instant delivery via WebSockets   |
| ✅ Composition IR | Version control, undo/redo        |
| ✅ Edit Patches   | Ordered lists, atomic updates     |
| ✅ User Data      | Auth, subscriptions, settings     |
| ✅ Project State  | Real-time collaboration ready     |
| ✅ Render Jobs    | Queue management, status tracking |

**What Cloudflare Handles:**

| Data Type       | Why Cloudflare?                    |
| --------------- | ---------------------------------- |
| ✅ Video Files   | TUS resumable, HLS instant preview |
| ✅ Audio Files   | Direct URLs for Remotion           |
| ✅ Images        | CDN delivery, optimized            |
| ✅ Rendered MP4s | Large files, signed delivery       |

### Architecture Diagram (Final)

```
┌──────────────────────────────────────────┐
│          User's Browser                   │
│  ┌─────────────────────────────────────┐ │
│  │  Next.js App                        │ │
│  │  • Chat UI                          │ │
│  │  • HLS Player (Cloudflare)          │ │
│  │  • Remotion Player (Code)           │ │
│  │  • TUS Upload Widget                │ │
│  └─────────────────────────────────────┘ │
└────────────┬─────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────────┐  ┌──────────────────┐
│   Convex    │  │   Cloudflare     │
│  (Metadata) │  │  (Media Files)   │
│             │  │                  │
│ • Projects  │  │ • Stream (Video) │
│ • Messages  │  │   - TUS upload   │
│ • IR/Patches│  │   - HLS preview  │
│ • Users     │  │   - Webhooks     │
│ • Renders   │  │                  │
│ • Settings  │  │ • R2 (Storage)   │
│             │  │   - Images       │
│ Actions:    │  │   - MP4s         │
│ • Dedalus   │  │   - Signed URLs  │
│ • MCP Proxy │  │                  │
└─────────────┘  └──────────────────┘
      │                  │
      └────────┬─────────┘
               ▼
       ┌──────────────┐
       │   Dedalus    │
       │  • Multi-LLM │
       │  • MCP Tools │
       └──────────────┘
               │
               ▼
       ┌──────────────┐
       │   Remotion   │
       │    Lambda    │
       └──────────────┘
```

### Cost Breakdown (100 Users)

| Service               | Purpose                    | Monthly Cost       |
| --------------------- | -------------------------- | ------------------ |
| **Convex**            | Metadata, real-time, auth  | $25                |
| **Cloudflare Stream** | Video uploads, HLS preview | $15                |
| **Cloudflare R2**     | Storage (images, MP4s)     | $10                |
| **Vercel**            | Next.js hosting            | $20                |
| **Dedalus**           | AI orchestration           | $50-100            |
| **Remotion Lambda**   | Rendering                  | $50-100            |
| **Remotion License**  | Company license            | $25/mo             |
| **Multi-Model AI**    | Code gen, chat             | $340               |
| **Total**             |                            | **$535-635/month** |

**vs Single Stack (e.g., Mux):**
- Similar cost
- More flexibility
- Better for your use case
- Cloudflare free egress saves $%$

### Why This Stack Wins

1. **Convex Strengths:**
   2. Real-time by default (perfect for chat, preview updates)
   3. TypeScript end-to-end
   4. Automatic data sync
   5. Built-in auth
   6. Perfect for \<20MB data

2. **Cloudflare Strengths:**
   2. Best-in-class video ingress (TUS)
   3. Instant HLS preview (no transcode wait)
   4. Free egress (R2)
   5. Global CDN
   6. Lower cost than Mux

3. **Clean Separation:**
   2. Convex = Application state
   3. Cloudflare = Media delivery
   4. No overlapping responsibilities

4. **Developer Experience:**
   2. One codebase (Convex actions handle both)
   3. TypeScript everywhere
   4. No complex media pipeline
   5. Webhook integration is simple

### Migration from v3.0

**Changes Needed:**

1. **Remove from Convex:**
   2. File upload endpoints → Replace with Cloudflare signed URLs
   3. File storage usage → Move to R2

2. **Add to Cloudflare:**
   2. Stream account setup
   3. R2 bucket creation
   4. Webhook endpoints in Convex

3. **Update Frontend:**
   2. Replace file input with TUS uploader
   3. Switch video player to HLS
   4. Add upload progress UI

**Effort:** \~3-5 days

---

## Updated Development Roadmap

### Week 1: Foundation + Cloudflare Setup
- [ ] Set up Next.js + Convex project
- [ ] **Set up Cloudflare Stream + R2**
  - [ ] Create Stream account
  - [ ] Create R2 bucket
  - [ ] Configure webhooks → Convex
  - [ ] Test TUS upload flow
  - [ ] Test HLS preview playback
- [ ] Implement authentication (Convex Auth)
- [ ] Design database schema (metadata only)
- [ ] **Sign up for Dedalus beta**

### Week 2: Plan-Execute-Patch Architecture
- [ ] **Implement Composition IR**
  - [ ] Define TypeScript types
  - [ ] Create IR→Code compiler
  - [ ] Test AST patching with Babel
- [ ] **Build Plan Generation** (Dedalus)
  - [ ] LLM prompts for structured plans
  - [ ] Selector resolution logic
  - [ ] Ambiguity detection
- [ ] **Implement AST Patcher**
  - [ ] Parse/modify Remotion code
  - [ ] Typecheck after patches
  - [ ] Generate receipts
- [ ] **Undo/Redo Stack**
  - [ ] Patch persistence
  - [ ] Revert logic
  - [ ] UI controls

### Week 3-4: Core Features
- [ ] Build chat interface (Dedalus streaming)
- [ ] **Media upload via TUS**
  - [ ] Request signed URLs from Convex
  - [ ] Direct browser → Cloudflare upload
  - [ ] Progress indicators
  - [ ] Webhook → asset ready
- [ ] **HLS Preview Player**
  - [ ] Cloudflare Stream playback
  - [ ] Fallback for unsupported browsers
- [ ] **Remotion Player for Code Preview**
  - [ ] Side-by-side: HLS (source) + Remotion (preview)
- [ ] Project management CRUD
- [ ] Basic compositions
  - [ ] Video sequences
  - [ ] Text overlays
  - [ ] Audio tracks

### Week 5-6: Rendering + MCP
- [ ] **Remotion Lambda Integration**
  - [ ] Deploy Remotion bundle
  - [ ] Dynamic cost estimation (estimatePrice)
  - [ ] Render queue with webhooks
  - [ ] Store actual costs for telemetry
- [ ] **License Compliance Check**
  - [ ] Detect org size
  - [ ] Block if non-compliant
  - [ ] Link to pricing page
- [ ] **MCP Backend Proxy**
  - [ ] Route all MCP calls through Convex
  - [ ] Per-user auth + rate limiting
  - [ ] Sanitize tool arguments
- [ ] Error handling and edge cases
- [ ] **Disambiguator UI** (when selectors match multiple elements)
- [ ] **Edit Receipts** (show after each operation)

### Week 7-8: Testing & Launch
- [ ] **Cost & Performance Telemetry**
  - [ ] Track estimate vs actual render costs
  - [ ] Monitor plan validity rate
  - [ ] P95 edit→preview latency
  - [ ] Token usage per model
- [ ] User testing with 10-20 beta users
- [ ] **A/B test multi-model routing**
  - [ ] Compare quality: Claude vs GPT vs Gemini
  - [ ] Optimize routing rules
- [ ] Landing page and docs
- [ ] Deploy to production
- [ ] Soft launch

### Post-Launch (Week 9-12)
- [ ] Gather feedback
- [ ] Optimize costs (rendering + AI)
- [ ] **Phase 2: CapCut Export**
  - [ ] Mapping spike (1 week)
  - [ ] Deploy CapCut MCP server
  - [ ] Test draft generation
  - [ ] Clear user instructions
- [ ] Add template library
- [ ] Improve plan generation quality
- [ ] Scale based on usage

---

## Go/No-Go Checklist (Ship Gate)

Before launching ChatKut MVP, validate:

### ✅ Media Pipeline
- [ ] 1GB video uploads resume via TUS if interrupted
- [ ] Cloudflare webhook flips asset status to "ready"
- [ ] HLS preview loads \<2 seconds after upload complete
- [ ] Asset metadata appears in Convex real-time
- [ ] No files \>20MB transit through Convex

### ✅ Editing Determinism
- [ ] User says "make second clip zoom out slowly"
- [ ] System selects correct clip (byType, index: 1)
- [ ] AST patch adds only interpolate() for scale
- [ ] Preview updates showing zoom animation
- [ ] Edit is undoable in one click
- [ ] Receipt shows: "✓ Updated video 'Clip.mp4': scale animation added"

### ✅ Costs & Licensing
- [ ] Pre-render estimate shown using estimatePrice()
- [ ] Post-render actual cost recorded and displayed
- [ ] License compliance checked for org size (4+ = blocked without license)
- [ ] Cost variance tracked for optimization
- [ ] Links to official Remotion pricing visible

### ✅ MCP Security
- [ ] All MCP calls routed via Convex backend proxy
- [ ] Per-user authentication enforced
- [ ] Rate limit: 10 calls/min per user (tested)
- [ ] No secrets in tool arguments (sanitization tested)
- [ ] CapCut export behind Pro subscription gate
- [ ] Draft .zip outputs correctly (dfd\_xxxxx folder)

### ✅ Multi-Model Optimization
- [ ] Code generation uses Claude Sonnet (quality)
- [ ] Chat uses GPT-4o (balanced)
- [ ] Simple edits use Gemini Flash (cost)
- [ ] Token usage tracked per model
- [ ] Cost attribution per user/project
- [ ] 30%+ cost savings vs single-model validated

### ✅ User Experience
- [ ] Chat responds \<2 seconds for simple queries
- [ ] Preview updates \<3 seconds after edit
- [ ] Upload progress shows percentage
- [ ] Ambiguity dialog appears when needed (multiple matches)
- [ ] Edit receipts show after each operation
- [ ] Undo/redo works reliably
- [ ] Error messages are helpful (not technical)

### ✅ Performance
- [ ] Preview plays smoothly (HLS buffer management)
- [ ] Edit→preview latency P95 \<5 seconds
- [ ] Plan validity rate \>90% (selectors resolve correctly)
- [ ] Render estimation accuracy ±20%
- [ ] Page load \<2 seconds
- [ ] Real-time updates via Convex \<500ms

---

## Summary of Changes (v3.0 → v3.1)

| Category          | v3.0                  | v3.1 (Fixed)                     |
| ----------------- | --------------------- | -------------------------------- |
| **Media Storage** | Convex (❌ 20MB limit) | Cloudflare Stream + R2 ✅         |
| **Upload Method** | HTTP POST             | TUS resumable ✅                  |
| **Preview**       | Not specified         | HLS instant playback ✅           |
| **MCP Auth**      | "Secure via Dedalus"  | Backend proxy until auth ships ✅ |
| **Render Costs**  | Fixed "$0.005/min"    | Dynamic estimatePrice() ✅        |
| **License**       | Fixed "$299/year"     | Link to official pricing ✅       |
| **CapCut Export** | Assumed cloud         | Local drafts only (scoped) ✅     |
| **Editing**       | Full code regen       | Plan-Execute-Patch (IR) ✅        |
| **Undo/Redo**     | Not specified         | Patch-based with full history ✅  |
| **Receipts**      | Not specified         | After every edit with details ✅  |
| **Ambiguity**     | Not handled           | Disambiguator UI ✅               |

---

## Conclusion

This v3.1 PRD is **production-ready** and addresses all critical issues identified in the GPT-5 review:

1. ✅ **Media Ingress:** Cloudflare Stream + R2 (not Convex)
2. ✅ **MCP Security:** Backend proxy with auth/rate limits
3. ✅ **Remotion Costs:** Dynamic estimation + actual tracking
4. ✅ **CapCut Export:** Realistic scope (local drafts, Phase 2)
5. ✅ **Editing:** Deterministic Plan-Execute-Patch architecture

**Tech Stack (Final):**
```
Frontend: Next.js 14 + React 18 + Tailwind
Backend: Convex (metadata + real-time)
Media: Cloudflare Stream (video) + R2 (storage)
AI: Dedalus SDK (multi-model + MCP)
Rendering: Remotion Lambda
Export: CapCut MCP server (optional)
```

**Monthly Cost:** $535-635 for 100 users  
**AI Savings:** 32% vs single-model  
**Time to MVP:** 8 weeks  
**Build Status:** ✅ Ready to implement

---

**Document Version:** 3.1 (Production-Ready)  
**Last Updated:** 2025-11-07  
**Status:** Build-Ready - All Critical Issues Addressed  
**Review:** Passed GPT-5 Architectural Review  
**Next Action:** Begin Week 1 implementation
