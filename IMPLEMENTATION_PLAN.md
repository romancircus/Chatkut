# ChatKut Implementation Plan

## Overview

This is a detailed, actionable implementation plan for building ChatKut MVP (Phase 1) over 8 weeks. The plan follows the architecture defined in `chatkut-prd-v3.1-production-ready.md` and is optimized for solo developer execution with Claude Code assistance.

**Timeline:** 8 weeks to MVP
**Deployment Target:** Production-ready beta
**Success Metrics:** See Go/No-Go Checklist at end

---

## Week 1: Foundation + Cloudflare Setup

### Day 1-2: Project Scaffolding

**Goal:** Set up Next.js 14 + Convex project with TypeScript

**Tasks:**
- [ ] Create Next.js 14 app with TypeScript
  ```bash
  npx create-next-app@latest chatkut --typescript --tailwind --app --no-src-dir
  ```
- [ ] Initialize Convex
  ```bash
  npm install convex
  npx convex dev
  ```
- [ ] Set up project structure:
  ```
  app/(auth)/
  app/(dashboard)/
  components/
  convex/
  lib/
  types/
  remotion/
  ```
- [ ] Configure TypeScript strict mode
- [ ] Set up ESLint + Prettier
- [ ] Initialize Git repository (already done ✓)
- [ ] Create `.env.local` template

**Deliverables:**
- Running Next.js dev server
- Convex dev deployment
- Project structure in place

### Day 3: Cloudflare Setup

**Goal:** Configure Cloudflare Stream + R2 for media storage

**Tasks:**
- [ ] Create Cloudflare account
- [ ] Set up Cloudflare Stream:
  - [ ] Create Stream API token
  - [ ] Note Account ID
  - [ ] Test TUS upload endpoint via curl
  - [ ] Configure webhook URL (will point to Convex)
- [ ] Set up Cloudflare R2:
  - [ ] Create R2 bucket: `chatkut-media`
  - [ ] Configure CORS for browser uploads
  - [ ] Create R2 API token (read/write)
  - [ ] Test upload/download via AWS S3 SDK
- [ ] Add credentials to `.env.local`:
  ```
  CLOUDFLARE_ACCOUNT_ID=xxx
  CLOUDFLARE_STREAM_TOKEN=xxx
  CLOUDFLARE_R2_ACCESS_KEY=xxx
  CLOUDFLARE_R2_SECRET_KEY=xxx
  ```

**Deliverables:**
- Cloudflare Stream account configured
- R2 bucket created and accessible
- Credentials stored securely

### Day 4-5: Convex Schema + Auth

**Goal:** Define database schema and implement authentication

**Tasks:**
- [ ] Define Convex schema in `convex/schema.ts`:
  ```typescript
  // Tables:
  // - users (auth)
  // - projects (name, userId, created/updated)
  // - compositions (projectId, ir, code, patches, version)
  // - assets (projectId, streamId, type, status, playbackUrl, duration)
  // - chatMessages (projectId, userId, role, content, timestamp)
  // - renderJobs (compositionId, status, estimatedCost, actualCost)
  // - mcpUsage (userId, toolName, timestamp, cost)
  // - subscriptions (userId, tier, validUntil)
  ```
- [ ] Implement Convex Auth:
  - [ ] Set up email/password auth
  - [ ] Add Google OAuth (optional)
  - [ ] Create auth helper functions
- [ ] Create basic user profile mutations
- [ ] Test auth flow (signup, login, logout)

**Deliverables:**
- Complete database schema
- Working authentication system
- Auth helpers (`getUserOrThrow`, etc.)

### Week 1 Checkpoint

**Review:**
- [ ] Next.js dev server running
- [ ] Convex deployed and syncing
- [ ] Cloudflare Stream + R2 configured
- [ ] Auth working (can create users)
- [ ] All credentials in `.env.local`

---

## Week 2: Plan-Execute-Patch Architecture

### Day 6-7: Composition IR Types

**Goal:** Define TypeScript types for Composition IR

**Tasks:**
- [ ] Create `types/composition-ir.ts`:
  ```typescript
  export type CompositionIR = { /* ... */ }
  export type CompositionElement = { /* ... */ }
  export type Animation = { /* ... */ }
  export type Patch = { /* ... */ }
  export type ElementSelector = { /* ... */ }
  ```
- [ ] Create IR helper functions:
  - [ ] `createEmptyComposition()`
  - [ ] `addElement(ir, element)`
  - [ ] `updateElement(ir, elementId, changes)`
  - [ ] `deleteElement(ir, elementId)`
  - [ ] `moveElement(ir, elementId, newIndex)`
- [ ] Write unit tests for IR helpers
- [ ] Create sample IR fixtures for testing

**Deliverables:**
- Complete IR type definitions
- IR manipulation helpers with tests
- Sample compositions for development

### Day 8-9: IR → Remotion Code Compiler

**Goal:** Convert IR to valid Remotion React code

**Tasks:**
- [ ] Create `lib/composition-engine/compiler.ts`
- [ ] Implement `compileIRToCode(ir: CompositionIR): string`:
  - [ ] Generate imports (Remotion, assets)
  - [ ] Generate composition metadata (width, height, fps, duration)
  - [ ] Convert elements to JSX (with `data-element-id` attributes)
  - [ ] Handle nested sequences
  - [ ] Generate animations using `interpolate()`
  - [ ] Generate text styles
  - [ ] Format with Prettier
- [ ] Test compiler with sample IRs
- [ ] Validate generated code with TypeScript compiler API
- [ ] Create Remotion preview bundle

**Deliverables:**
- Working IR → Remotion code compiler
- Generated code passes TypeScript checks
- Remotion Player can render compiled code

### Day 10: AST Patcher

**Goal:** Modify existing Remotion code via Babel AST manipulation

**Tasks:**
- [ ] Create `lib/composition-engine/patcher.ts`
- [ ] Install dependencies:
  ```bash
  npm install @babel/core @babel/parser @babel/traverse @babel/types @babel/preset-typescript @babel/preset-react
  ```
- [ ] Implement `applyPatchToAST(code, patch)`:
  - [ ] Parse code to AST
  - [ ] Find element by `data-element-id`
  - [ ] Apply changes based on patch operation
  - [ ] Generate new code from AST
  - [ ] Typecheck result
- [ ] Test patching operations:
  - [ ] Add animation
  - [ ] Update property
  - [ ] Delete element
  - [ ] Move element
- [ ] Handle edge cases (element not found, invalid patch)

**Deliverables:**
- AST patcher with full CRUD operations
- Tests covering all patch types
- Error handling for invalid patches

### Week 2 Checkpoint

**Review:**
- [ ] IR types defined and tested
- [ ] IR → Code compiler working
- [ ] AST patcher can modify code
- [ ] Generated code renders in Remotion Player
- [ ] TypeScript checks pass

---

## Week 3: Media Upload + HLS Preview

### Day 11-12: Cloudflare Upload Integration

**Goal:** Implement TUS upload to Cloudflare Stream

**Tasks:**
- [ ] Create `convex/media.ts`:
  - [ ] `requestUploadUrl` action (calls Cloudflare API)
  - [ ] `handleStreamWebhook` action (updates asset status)
  - [ ] Asset CRUD mutations
- [ ] Create `components/upload/VideoUpload.tsx`:
  - [ ] Install `tus-js-client`
  - [ ] Request signed URL from Convex
  - [ ] Upload directly to Cloudflare
  - [ ] Show progress bar
  - [ ] Handle errors and retries
- [ ] Test upload flow:
  - [ ] 1MB test video
  - [ ] 100MB video
  - [ ] 1GB video (resume test)
- [ ] Set up webhook endpoint:
  - [ ] Create Convex HTTP action
  - [ ] Configure Cloudflare webhook URL
  - [ ] Test webhook delivery

**Deliverables:**
- Working TUS upload widget
- Cloudflare webhook updating asset status
- Progress indicators showing upload %
- Resumable uploads (tested with interruption)

### Day 13: HLS Preview Player

**Goal:** Display uploaded videos using HLS playback

**Tasks:**
- [ ] Create `components/player/HLSPlayer.tsx`:
  - [ ] Install `hls.js` or use native HLS (Safari)
  - [ ] Load HLS manifest from Cloudflare Stream
  - [ ] Show loading state until ready
  - [ ] Handle playback errors
  - [ ] Add controls (play, pause, seek, volume)
- [ ] Create asset gallery:
  - [ ] List uploaded assets
  - [ ] Show thumbnails (from Stream)
  - [ ] Click to preview
  - [ ] Show upload status (uploading, ready, error)
- [ ] Test HLS playback:
  - [ ] Chrome (hls.js)
  - [ ] Safari (native HLS)
  - [ ] Firefox (hls.js)

**Deliverables:**
- HLS player component
- Asset gallery with previews
- Cross-browser compatibility

### Day 14-15: R2 Image Upload

**Goal:** Handle image uploads via R2

**Tasks:**
- [ ] Create `convex/r2.ts`:
  - [ ] `requestImageUploadUrl` action (generates presigned URL)
  - [ ] Store image metadata in Convex
- [ ] Create `components/upload/ImageUpload.tsx`:
  - [ ] Request presigned URL
  - [ ] Upload directly to R2
  - [ ] Show preview after upload
- [ ] Create image gallery component
- [ ] Test with various formats (JPG, PNG, GIF, WebP)
- [ ] Add image optimization (resize, format conversion)

**Deliverables:**
- Image upload to R2
- Image gallery with previews
- Direct HTTPS URLs for Remotion

### Week 3 Checkpoint

**Review:**
- [ ] Video uploads work via TUS
- [ ] HLS preview loads <2 seconds after upload
- [ ] Images upload to R2
- [ ] Asset metadata in Convex
- [ ] No files transit through Convex actions
- [ ] Uploads resume after interruption

---

## Week 4: Chat Interface + Dedalus Integration

### Day 16-17: Chat UI

**Goal:** Build chat interface for video editing

**Tasks:**
- [ ] Create `components/chat/ChatInterface.tsx`:
  - [ ] Message list (user + assistant)
  - [ ] Input field with send button
  - [ ] Loading state during AI response
  - [ ] Markdown rendering for receipts
  - [ ] Auto-scroll to latest message
- [ ] Create Convex chat schema:
  - [ ] Store messages (projectId, userId, role, content)
  - [ ] Query messages by project
  - [ ] Real-time subscription
- [ ] Implement message persistence:
  - [ ] Save user message
  - [ ] Save assistant response
  - [ ] Show typing indicator
- [ ] Style chat UI with Tailwind

**Deliverables:**
- Chat interface component
- Real-time message sync via Convex
- Typing indicators and loading states

### Day 18-19: Dedalus SDK Integration

**Goal:** Set up Dedalus for multi-model AI routing

**Tasks:**
- [ ] Sign up for Dedalus beta access
- [ ] Install Dedalus SDK:
  ```bash
  npm install dedalus-labs
  ```
- [ ] Add API key to `.env.local`:
  ```
  DEDALUS_API_KEY=xxx
  ```
- [ ] Create `lib/dedalus/client.ts`:
  - [ ] Initialize AsyncDedalus client
  - [ ] Create DedalusRunner wrapper
  - [ ] Implement model routing:
    - Code generation → Claude Sonnet 4.5
    - Chat responses → GPT-4o
    - Simple edits → Gemini Flash 2.0
- [ ] Create Convex action for AI calls:
  - [ ] `convex/ai.ts`: `generateResponse(message, context)`
  - [ ] Stream response to frontend
  - [ ] Track token usage
- [ ] Test with sample queries:
  - [ ] "Create a 10-second video with text 'Hello World'"
  - [ ] "Add background music"
  - [ ] "Make the text bigger"

**Deliverables:**
- Dedalus SDK configured
- AI responses streaming to chat
- Multi-model routing working
- Token usage tracking

### Day 20: Edit Plan Generation

**Goal:** Generate structured Edit Plans from user messages

**Tasks:**
- [ ] Create `lib/composition-engine/planner.ts`
- [ ] Implement `generateEditPlan(message, ir)`:
  - [ ] Build system prompt with IR context
  - [ ] Call Dedalus with Claude Sonnet
  - [ ] Parse JSON output to EditPlan type
  - [ ] Validate plan structure
- [ ] Create EditPlan type:
  ```typescript
  type EditPlan = {
    operation: "add" | "update" | "delete" | "move";
    selector: ElementSelector;
    changes: any;
  }
  ```
- [ ] Test plan generation with queries:
  - [ ] "Add a video clip" → add operation
  - [ ] "Make second clip louder" → update with selector
  - [ ] "Remove the text" → delete operation
- [ ] Handle plan generation errors

**Deliverables:**
- Plan generator using Dedalus + Claude
- Valid EditPlan objects from user queries
- Error handling for invalid plans

### Week 4 Checkpoint

**Review:**
- [ ] Chat UI working with real-time sync
- [ ] Dedalus SDK integrated
- [ ] AI responses streaming to chat
- [ ] Edit plans generated from queries
- [ ] Multi-model routing configured

---

## Week 5: Edit Execution + Remotion Preview

### Day 21-22: Selector Resolution

**Goal:** Resolve element selectors to actual elements

**Tasks:**
- [ ] Create `lib/composition-engine/selectors.ts`
- [ ] Implement `resolveSelector(selector, ir)`:
  - [ ] byId: Direct lookup
  - [ ] byLabel: Search by label (case-insensitive)
  - [ ] byType: Filter by type, optionally index
  - [ ] byIndex: Top-level index
- [ ] Handle ambiguity:
  - [ ] Return all matches if 2+
  - [ ] Return empty array if 0 matches
- [ ] Create helper functions:
  - [ ] `findElementById(elements, id)`
  - [ ] `findElementsByLabel(elements, label)`
  - [ ] `findElementsByType(elements, type)`
- [ ] Write tests for all selector types
- [ ] Test ambiguous cases (multiple matches)

**Deliverables:**
- Selector resolver with full support
- Tests covering all selector types
- Ambiguity detection working

### Day 23-24: Edit Executor

**Goal:** Execute edit plans and generate patches

**Tasks:**
- [ ] Create `lib/composition-engine/executor.ts`
- [ ] Implement `executeEditPlan(plan, ir, code)`:
  - [ ] Resolve selector to element(s)
  - [ ] Check for ambiguity (return candidates)
  - [ ] Apply plan to IR
  - [ ] Apply patch to AST
  - [ ] Generate new code
  - [ ] Typecheck result
  - [ ] Create patch record
  - [ ] Generate user-friendly receipt
- [ ] Handle all operations:
  - [ ] Add element
  - [ ] Update properties
  - [ ] Delete element
  - [ ] Move element
  - [ ] Add animation
- [ ] Test execution with sample plans
- [ ] Handle errors gracefully

**Deliverables:**
- Edit executor with full CRUD
- Patch generation for undo/redo
- Receipt generation for user feedback
- Error handling and validation

### Day 25: Disambiguator UI

**Goal:** Let users choose from multiple matching elements

**Tasks:**
- [ ] Create `components/editor/AmbiguityDialog.tsx`:
  - [ ] Show candidate elements
  - [ ] Display thumbnails (frame from video)
  - [ ] Show labels and timecodes
  - [ ] Click to select
- [ ] Integrate with edit flow:
  - [ ] If executor returns ambiguous, show dialog
  - [ ] User selects element
  - [ ] Re-execute plan with specific ID
- [ ] Generate thumbnails:
  - [ ] Use Remotion to render specific frame
  - [ ] Or extract from video stream
- [ ] Test with ambiguous queries:
  - [ ] "Make the video louder" (3 videos)
  - [ ] "Change the text" (2 text elements)

**Deliverables:**
- Disambiguator UI component
- Thumbnail generation
- User can resolve ambiguous edits

### Week 5 Checkpoint

**Review:**
- [ ] Selectors resolve correctly
- [ ] Edit executor works for all operations
- [ ] Patches generated for undo/redo
- [ ] Disambiguator UI appears when needed
- [ ] Receipts show after edits

---

## Week 6: Undo/Redo + Remotion Rendering

### Day 26-27: Undo/Redo Stack

**Goal:** Implement reversible edits

**Tasks:**
- [ ] Create Convex mutations:
  - [ ] `undo(compositionId)`: Revert last patch
  - [ ] `redo(compositionId, patchId)`: Reapply patch
- [ ] Implement patch reversal:
  - [ ] Pop last patch from stack
  - [ ] Revert IR to previous state
  - [ ] Regenerate code from IR
  - [ ] Update composition
- [ ] Create redo stack:
  - [ ] Store undone patches
  - [ ] Reapply on redo
  - [ ] Clear on new edit
- [ ] Add UI controls:
  - [ ] Undo button (Cmd+Z)
  - [ ] Redo button (Cmd+Shift+Z)
  - [ ] Disable when no history
- [ ] Test undo/redo flow:
  - [ ] Make 5 edits
  - [ ] Undo all 5
  - [ ] Redo all 5
  - [ ] Make new edit (clears redo stack)

**Deliverables:**
- Undo mutation working
- Redo mutation working
- UI controls with keyboard shortcuts
- Undo history preserved

### Day 28: Remotion Player Integration

**Goal:** Preview Remotion compositions in browser

**Tasks:**
- [ ] Install Remotion:
  ```bash
  npm install remotion @remotion/player
  ```
- [ ] Create `components/player/RemotionPlayer.tsx`:
  - [ ] Load composition code dynamically
  - [ ] Render with Remotion Player
  - [ ] Show loading state
  - [ ] Handle errors
  - [ ] Sync with HLS player (optional)
- [ ] Create `remotion/Root.tsx` (Remotion entry)
- [ ] Bundle compositions for preview:
  - [ ] Use Remotion bundler
  - [ ] Serve via Convex or Vercel
- [ ] Test preview updates:
  - [ ] Make edit
  - [ ] Preview updates <3 seconds

**Deliverables:**
- Remotion Player embedded in UI
- Dynamic composition loading
- Preview updates after edits

### Day 29-30: Remotion Lambda Setup

**Goal:** Set up cloud rendering with Remotion Lambda

**Tasks:**
- [ ] Sign up for Remotion License (if company has 4+ employees)
- [ ] Install Remotion Lambda:
  ```bash
  npm install @remotion/lambda
  ```
- [ ] Deploy Remotion Lambda:
  ```bash
  npx remotion lambda deploy
  ```
- [ ] Create `convex/rendering.ts`:
  - [ ] `estimateRenderCost(compositionId)` action
  - [ ] `startRender(compositionId)` action
  - [ ] `handleRenderWebhook(renderId, status)` action
- [ ] Implement cost estimation:
  - [ ] Use `estimatePrice()` API
  - [ ] Show estimate to user before render
  - [ ] Store estimate in render job
- [ ] Implement render queue:
  - [ ] Start render on Lambda
  - [ ] Poll for status or use webhooks
  - [ ] Download MP4 to R2
  - [ ] Update render job with actual cost
- [ ] Test rendering:
  - [ ] 10-second composition
  - [ ] 1-minute composition
  - [ ] Check cost accuracy

**Deliverables:**
- Remotion Lambda deployed
- Cost estimation working
- Render queue with status tracking
- Rendered MP4s stored in R2

### Week 6 Checkpoint

**Review:**
- [ ] Undo/redo working
- [ ] Remotion Player showing previews
- [ ] Remotion Lambda rendering videos
- [ ] Cost estimates shown before render
- [ ] Actual costs tracked after render

---

## Week 7: MCP Integration + Security

### Day 31-32: MCP Backend Proxy

**Goal:** Secure MCP tool access via Convex backend

**Tasks:**
- [ ] Create `convex/mcpProxy.ts`:
  - [ ] `callMCPTool(toolName, parameters)` action
  - [ ] Enforce authentication
  - [ ] Rate limiting (10 calls/min per user)
  - [ ] Sanitize parameters (remove secrets)
  - [ ] Call Dedalus SDK with MCP tools
  - [ ] Log usage for billing
- [ ] Implement rate limiter:
  - [ ] Track calls per user per minute
  - [ ] Return 429 if exceeded
  - [ ] Pro users: 50 calls/min
- [ ] Implement parameter sanitization:
  - [ ] Remove apiKey, token, password, secret fields
  - [ ] Validate parameter types
- [ ] Test MCP proxy:
  - [ ] Call sample MCP tool
  - [ ] Test rate limiting (make 11 calls)
  - [ ] Test sanitization (pass fake apiKey)

**Deliverables:**
- MCP backend proxy working
- Rate limiting enforced
- Parameter sanitization active
- Usage logging for billing

### Day 33: License Compliance Check

**Goal:** Enforce Remotion licensing requirements

**Tasks:**
- [ ] Create `convex/organization.ts`:
  - [ ] `checkLicenseCompliance(orgId)` query
  - [ ] Count org members
  - [ ] Block renders if 4+ members without license
  - [ ] Link to Remotion pricing
- [ ] Add license field to user schema:
  - [ ] `hasCompanyLicense: boolean`
  - [ ] `licenseValidUntil: number`
- [ ] Integrate with render flow:
  - [ ] Check compliance before rendering
  - [ ] Show error if non-compliant
  - [ ] Provide link to purchase
- [ ] Test compliance:
  - [ ] 3-person org → allowed
  - [ ] 4-person org without license → blocked
  - [ ] 4-person org with license → allowed

**Deliverables:**
- License compliance checks
- Render blocking for non-compliant orgs
- Clear error messages with purchase links

### Day 34-35: Receipt Generation + Error Handling

**Goal:** Generate user-friendly receipts and error messages

**Tasks:**
- [ ] Create `lib/composition-engine/receipts.ts`:
  - [ ] `generateReceipt(plan, element)` function
  - [ ] Templates for each operation type:
    - Add: "✓ Added video 'Intro.mp4' at 0:00"
    - Update: "✓ Updated text 'Title': font size 24→36"
    - Delete: "✓ Removed audio 'Background.mp3'"
    - Animation: "✓ Added zoom animation to 'Clip.mp4'"
- [ ] Create `components/editor/EditReceipt.tsx`:
  - [ ] Show receipt message
  - [ ] Undo button
  - [ ] Success styling (green)
- [ ] Implement error handling:
  - [ ] Element not found → suggest alternatives
  - [ ] Invalid selector → ask for clarification
  - [ ] Typecheck failed → show error details
  - [ ] Rate limit exceeded → show upgrade prompt
- [ ] Test all receipt types
- [ ] Test all error scenarios

**Deliverables:**
- Receipt generation for all operations
- Receipt UI component
- Comprehensive error handling
- Helpful error messages

### Week 7 Checkpoint

**Review:**
- [ ] MCP proxy working with auth
- [ ] Rate limiting enforced (tested)
- [ ] License compliance checked
- [ ] Receipts show after edits
- [ ] Errors are user-friendly

---

## Week 8: Testing + Polish + Launch

### Day 36-37: End-to-End Testing

**Goal:** Validate entire user flow

**Tasks:**
- [ ] Test complete editing flow:
  1. Create project
  2. Upload video (1GB, test resume)
  3. Chat: "Create a 10-second intro with this video"
  4. Chat: "Add text 'Welcome' in the center"
  5. Chat: "Make the text fade in"
  6. Undo last edit
  7. Redo last edit
  8. Render video
  9. Download MP4
- [ ] Test ambiguity handling:
  - Upload 3 videos
  - Chat: "Make the video louder"
  - Select specific video in disambiguator
- [ ] Test error scenarios:
  - Invalid query → helpful error
  - Element not found → suggestions
  - Network error during upload → retry
- [ ] Test performance:
  - Edit→preview latency (target: P95 <5s)
  - Chat response time (target: <2s)
  - Page load time (target: <2s)
- [ ] Test multi-device:
  - Desktop Chrome
  - Desktop Safari
  - Desktop Firefox
  - Mobile (basic functionality)

**Deliverables:**
- All user flows tested
- Performance targets met
- Cross-browser compatibility confirmed

### Day 38: Cost & Telemetry

**Goal:** Track costs and usage for optimization

**Tasks:**
- [ ] Create telemetry dashboard (simple):
  - [ ] Total AI token usage (by model)
  - [ ] Render costs (estimated vs actual)
  - [ ] MCP tool usage (by tool)
  - [ ] User activity (projects created, renders completed)
- [ ] Implement cost tracking:
  - [ ] Log every AI call (model, tokens, cost)
  - [ ] Log every render (estimated, actual, variance)
  - [ ] Log every MCP call (tool, cost)
- [ ] Calculate metrics:
  - [ ] Average render cost
  - [ ] Cost variance (estimate vs actual)
  - [ ] AI cost savings (multi-model vs single)
  - [ ] Plan validity rate (selectors resolved / total)
- [ ] Create admin view to see metrics

**Deliverables:**
- Telemetry tracking implemented
- Cost dashboard (admin only)
- Metrics tracked for optimization

### Day 39: Polish + Bug Fixes

**Goal:** Fix bugs and improve UX

**Tasks:**
- [ ] Fix any bugs found during testing
- [ ] Improve loading states:
  - [ ] Upload progress
  - [ ] AI thinking indicator
  - [ ] Render progress
- [ ] Improve error messages:
  - [ ] Show actionable next steps
  - [ ] Add "Try again" buttons
- [ ] Add keyboard shortcuts:
  - [ ] Cmd+Z: Undo
  - [ ] Cmd+Shift+Z: Redo
  - [ ] Cmd+Enter: Send chat message
  - [ ] Space: Play/pause preview
- [ ] Improve responsive design:
  - [ ] Mobile-friendly chat
  - [ ] Mobile-friendly preview
- [ ] Add tooltips and help text
- [ ] Improve accessibility (aria labels, keyboard nav)

**Deliverables:**
- Bug-free experience
- Polished UI/UX
- Keyboard shortcuts working
- Accessibility improvements

### Day 40: Deployment + Launch

**Goal:** Deploy to production and soft launch

**Tasks:**
- [ ] Deploy Convex to production:
  ```bash
  npx convex deploy --prod
  ```
- [ ] Deploy Next.js to Vercel:
  ```bash
  vercel deploy --prod
  ```
- [ ] Deploy Remotion Lambda (if not already)
- [ ] Configure production environment variables:
  - [ ] Cloudflare credentials
  - [ ] Dedalus API key
  - [ ] Remotion Lambda function ARN
- [ ] Set up monitoring:
  - [ ] Error tracking (Sentry)
  - [ ] Analytics (Vercel Analytics)
  - [ ] Uptime monitoring (UptimeRobot)
- [ ] Create landing page:
  - [ ] Hero section with demo video
  - [ ] Feature highlights
  - [ ] Sign up form
  - [ ] FAQ
- [ ] Soft launch:
  - [ ] Invite 10-20 beta users
  - [ ] Collect feedback
  - [ ] Monitor errors and performance
- [ ] Create documentation:
  - [ ] User guide (how to use ChatKut)
  - [ ] API docs (if exposing APIs)
  - [ ] Troubleshooting guide

**Deliverables:**
- Production deployment live
- Landing page published
- Beta users invited
- Monitoring active

### Week 8 Checkpoint - GO/NO-GO

**Must Pass Before Launch:**

#### Media Pipeline ✅
- [ ] 1GB video uploads resume via TUS if interrupted
- [ ] Cloudflare webhook flips asset status to "ready"
- [ ] HLS preview loads <2 seconds after upload complete
- [ ] Asset metadata appears in Convex real-time
- [ ] No files >20MB transit through Convex

#### Editing Determinism ✅
- [ ] User says "make second clip zoom out slowly"
- [ ] System selects correct clip (byType, index: 1)
- [ ] AST patch adds only interpolate() for scale
- [ ] Preview updates showing zoom animation
- [ ] Edit is undoable in one click
- [ ] Receipt shows: "✓ Updated video 'Clip.mp4': scale animation added"

#### Costs & Licensing ✅
- [ ] Pre-render estimate shown using estimatePrice()
- [ ] Post-render actual cost recorded and displayed
- [ ] License compliance checked for org size (4+ = blocked without license)
- [ ] Cost variance tracked for optimization
- [ ] Links to official Remotion pricing visible

#### MCP Security ✅
- [ ] All MCP calls routed via Convex backend proxy
- [ ] Per-user authentication enforced
- [ ] Rate limit: 10 calls/min per user (tested)
- [ ] No secrets in tool arguments (sanitization tested)

#### User Experience ✅
- [ ] Chat responds <2 seconds for simple queries
- [ ] Preview updates <3 seconds after edit
- [ ] Upload progress shows percentage
- [ ] Ambiguity dialog appears when needed (multiple matches)
- [ ] Edit receipts show after each operation
- [ ] Undo/redo works reliably
- [ ] Error messages are helpful (not technical)

#### Performance ✅
- [ ] Preview plays smoothly (HLS buffer management)
- [ ] Edit→preview latency P95 <5 seconds
- [ ] Plan validity rate >90% (selectors resolve correctly)
- [ ] Render estimation accuracy ±20%
- [ ] Page load <2 seconds
- [ ] Real-time updates via Convex <500ms

---

## Post-MVP (Week 9+)

### Phase 2: CapCut Export (Optional)

**Timeline:** 2-3 weeks after MVP launch

**Tasks:**
- [ ] **Mapping Spike (1 week)**:
  - [ ] Study CapCutAPI MCP server
  - [ ] Map Remotion features to CapCut drafts
  - [ ] Identify unsupported features
  - [ ] Create mapping documentation
- [ ] **MCP Integration (1 week)**:
  - [ ] Deploy CapCut MCP server (Python 3.8+)
  - [ ] Integrate with Convex backend proxy
  - [ ] Generate draft .zip files
  - [ ] Store in R2 with signed URLs
  - [ ] Test end-to-end export
- [ ] **UI + Documentation (3 days)**:
  - [ ] "Export to CapCut" button (Pro only)
  - [ ] Download .zip file
  - [ ] Clear instructions for import
  - [ ] Troubleshooting guide
  - [ ] Video tutorial

**Out of Scope:**
- Cloud preview/render (not open-sourced by CapCutAPI)
- Automatic import to CapCut (requires manual step)
- Complex effects (Canvas, WebGL)

### Other Post-MVP Features

**Template Library:**
- [ ] Predefined composition templates
- [ ] One-click apply
- [ ] Customization via chat

**Advanced Effects:**
- [ ] Canvas animations
- [ ] Particle systems
- [ ] Custom transitions

**Collaboration (Phase 3):**
- [ ] Real-time multi-user editing
- [ ] Comments and annotations
- [ ] Version history

**Mobile App (Phase 4):**
- [ ] React Native app
- [ ] Mobile-optimized UI
- [ ] Offline support

---

## Development Best Practices

### Daily Workflow

1. **Start of day:**
   - Pull latest code
   - Run `npx convex dev` (auto-syncs schema)
   - Run `npm run dev` (Next.js)
   - Check for errors in console

2. **During development:**
   - Make small, incremental commits
   - Test each feature before moving on
   - Use TypeScript strict mode (catch errors early)
   - Run `npm run type-check` frequently

3. **End of day:**
   - Commit all work (even WIP)
   - Push to GitHub
   - Update IMPLEMENTATION_PLAN.md with progress

### Testing Strategy

**Unit Tests:**
- IR helpers (`types/composition-ir.ts`)
- Selectors (`lib/composition-engine/selectors.ts`)
- Compiler (`lib/composition-engine/compiler.ts`)
- Patcher (`lib/composition-engine/patcher.ts`)

**Integration Tests:**
- Upload flow (browser → Cloudflare → Convex webhook)
- Edit flow (chat → plan → execution → preview)
- Render flow (estimate → Lambda → webhook → download)

**E2E Tests (Playwright):**
- Full user journey (signup → upload → edit → render → download)
- Ambiguity handling
- Error scenarios

**Performance Tests:**
- Load testing (simulate 100 concurrent users)
- Edit→preview latency (P95, P99)
- Render queue throughput

### Code Review Checklist

Before merging any feature:
- [ ] TypeScript types are correct (no `any`)
- [ ] Error handling implemented (try/catch)
- [ ] Loading states shown (no silent failures)
- [ ] Real-time sync working (Convex subscriptions)
- [ ] No media files through Convex (use Cloudflare)
- [ ] MCP calls via backend proxy (never frontend)
- [ ] Costs tracked (AI tokens, renders)
- [ ] Tests passing (unit + integration)
- [ ] Performance acceptable (<2s response)
- [ ] Accessibility considered (keyboard nav, aria labels)

### Common Pitfalls to Avoid

1. **Uploading media through Convex**
   - ❌ Don't: Use Convex file storage or HTTP actions for media
   - ✅ Do: Direct TUS upload to Cloudflare Stream

2. **MCP calls from frontend**
   - ❌ Don't: Call MCP servers directly from browser
   - ✅ Do: Proxy all calls via Convex backend

3. **Hard-coding costs**
   - ❌ Don't: Assume fixed render costs
   - ✅ Do: Use `estimatePrice()` and track actual costs

4. **Full code regeneration**
   - ❌ Don't: Regenerate entire Remotion component for each edit
   - ✅ Do: Use AST patching for targeted changes

5. **Ignoring ambiguity**
   - ❌ Don't: Assume selectors match one element
   - ✅ Do: Check for 0 or 2+ matches, show disambiguator

6. **No undo/redo**
   - ❌ Don't: Forget to create patches
   - ✅ Do: Every edit generates a reversible patch

7. **Poor error messages**
   - ❌ Don't: Show raw errors to users
   - ✅ Do: Provide actionable next steps

---

## Success Metrics

### Week 4 Checkpoint
- [ ] Chat interface functional
- [ ] AI responses streaming
- [ ] Edit plans generated

### Week 6 Checkpoint
- [ ] Uploads working (TUS + HLS)
- [ ] Edits applied via AST patching
- [ ] Previews updating
- [ ] Renders working on Lambda

### Week 8 Launch
- [ ] All Go/No-Go items passed
- [ ] 10-20 beta users onboarded
- [ ] Zero critical bugs
- [ ] Performance targets met

### Post-Launch (Month 1)
- [ ] 100+ users signed up
- [ ] 500+ renders completed
- [ ] AI cost savings validated (>30%)
- [ ] User satisfaction >80%

---

## Support Resources

### Documentation
- Remotion: https://remotion.dev/docs
- Convex: https://docs.convex.dev
- Cloudflare Stream: https://developers.cloudflare.com/stream
- Dedalus: https://dedalus.ai/docs (beta)

### Community
- Remotion Discord: https://remotion.dev/discord
- Convex Discord: https://convex.dev/community
- Cloudflare Discord: https://discord.gg/cloudflaredev

### Troubleshooting
- TUS upload errors → Check CORS settings
- HLS not loading → Verify signed URLs
- Render failures → Check Lambda logs
- High costs → Review model routing

---

## Final Notes

This implementation plan is designed for a solo developer using Claude Code for assistance. The plan is:

- **Incremental**: Each week builds on the previous
- **Testable**: Checkpoints validate progress
- **Realistic**: Based on PRD v3.1 constraints
- **Flexible**: Can adjust timeline as needed

**Estimated Timeline:**
- Week 1-2: Foundation (40% complete)
- Week 3-4: Core Features (70% complete)
- Week 5-6: Rendering (90% complete)
- Week 7-8: Polish + Launch (100% complete)

**Total Effort:** ~320 hours (40 hours/week × 8 weeks)

**Next Steps:**
1. Review this plan
2. Set up development environment (Week 1, Day 1-2)
3. Start building!

Good luck! 🚀
