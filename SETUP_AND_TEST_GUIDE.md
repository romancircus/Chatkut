# ChatKut Setup & Testing Guide

## Current Status

✅ **All core files implemented** (Weeks 1-6 complete)
⚠️ **Some TypeScript errors need fixing**
🔴 **Not yet tested end-to-end**

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Convex Dev Server

```bash
npx convex dev
```

This will:
- Push schema to Convex Cloud
- Generate TypeScript types
- Watch for changes

### 3. Start Next.js Dev Server (in new terminal)

```bash
npm run dev
```

### 4. Open Browser

Navigate to http://localhost:3000

---

## Testing Checklist

### Phase 1: Basic UI
- [ ] Homepage loads
- [ ] Create new project modal works
- [ ] Project created successfully
- [ ] Redirects to project dashboard

### Phase 2: Asset Upload
- [ ] Upload panel visible
- [ ] Can select video file
- [ ] TUS upload starts
- [ ] Progress bar updates
- [ ] Asset appears in library with "uploading" status
- [ ] Cloudflare webhook updates status to "ready"
- [ ] HLS preview URL available

### Phase 3: Chat & AI
- [ ] Chat interface visible
- [ ] Can type message
- [ ] Message sends to backend
- [ ] AI response received
- [ ] Message appears in chat

### Phase 4: Composition & Preview
- [ ] Chat command: "Add my video to the composition"
- [ ] AI generates edit plan
- [ ] Composition IR updated
- [ ] Remotion preview updates
- [ ] Video plays in preview

### Phase 5: Editing
- [ ] Chat command: "Make the video 5 seconds long"
- [ ] AI generates edit plan
- [ ] Selector resolves correctly
- [ ] Composition updated
- [ ] Preview reflects change
- [ ] Edit receipt shown in chat

### Phase 6: Undo/Redo
- [ ] Undo button enabled after edit
- [ ] Click undo
- [ ] Composition reverts
- [ ] Preview updates
- [ ] Redo button enabled
- [ ] Redo works

### Phase 7: Rendering (Optional - requires AWS setup)
- [ ] Render panel shows composition info
- [ ] Cost estimate button works
- [ ] Shows estimated cost
- [ ] Start render button
- [ ] Render job created
- [ ] Progress updates
- [ ] Render completes
- [ ] Download link available

---

## Known Issues to Fix

### 1. React Hooks Errors

**Problem**: Components use `useMutation` for action functions

**Files affected**:
- `components/chat/ChatInterface.tsx`
- `components/upload/VideoUpload.tsx`
- `components/library/AssetLibrary.tsx`

**Fix**: Change `useMutation` to `useAction` for Convex actions

```tsx
// Before
const sendMessage = useMutation(api.ai.sendChatMessage);

// After  
const sendMessage = useAction(api.ai.sendChatMessage);
```

### 2. Convex Function Type Errors

**Problem**: Some Convex functions have incorrect `runMutation`/`runQuery` calls

**Files affected**:
- `convex/rendering.ts` (multiple locations)

**Fix**: Use proper Convex API references

```ts
// Before
await ctx.runMutation((ctx) => { ... });

// After
await ctx.runMutation(api.compositions.update, { ... });
```

### 3. Remotion Config Error

**Problem**: `setAwsRegion` doesn't exist in Remotion v4

**File**: `remotion.config.ts:25`

**Fix**: Remove or update to new API

```ts
// Remove this line:
Config.setAwsRegion("us-east-1");

// Or use new API:
Config.Rendering.setLambdaAwsRegion("us-east-1");
```

### 4. Missing Type in Remotion Component

**Problem**: `backgroundColor` doesn't exist on `CompositionMetadata`

**File**: `remotion/DynamicComposition.tsx:47`

**Fix**: Move backgroundColor to element properties or remove

### 5. Shape Element Type

**Problem**: `shape` type not in `ElementType` union

**File**: `types/composition-ir.ts:38`

**Fix**: Add `"shape"` to ElementType union

```ts
export type ElementType = "video" | "audio" | "text" | "image" | "sequence" | "shape";
```

---

## Environment Variables Required

### Must Have (for basic functionality):
- `NEXT_PUBLIC_CONVEX_URL` - ✅ Set (https://graceful-falcon-340.convex.cloud)
- `CLOUDFLARE_ACCOUNT_ID` - ✅ Set
- `CLOUDFLARE_STREAM_TOKEN` - ✅ Set
- `CLOUDFLARE_R2_ACCESS_KEY` - ✅ Set
- `CLOUDFLARE_R2_SECRET_KEY` - ✅ Set
- `DEDALUS_API_KEY` - ✅ Set

### Optional (for full functionality):
- `REMOTION_AWS_ACCESS_KEY_ID` - ❌ Not set (needed for cloud rendering)
- `REMOTION_AWS_SECRET_ACCESS_KEY` - ❌ Not set
- `REMOTION_LAMBDA_FUNCTION_ARN` - ❌ Not set
- `REMOTION_S3_BUCKET` - ❌ Not set

---

## Debugging Tips

### Convex Logs
View real-time logs in Convex dashboard:
https://dashboard.convex.dev/t/taikuun/graceful-falcon-340/logs

### Browser Console
Check for:
- Network errors (failed API calls)
- React errors (component rendering issues)
- Convex connection status

### Common Errors

**"TypeError: fetch failed"**
- Network/internet connection issue
- Try again or check firewall

**"Property 'X' does not exist"**
- TypeScript error
- Run `npm run type-check` to see all errors
- Fix type definitions

**"Rate limit exceeded"**
- Too many API calls
- Wait 1 minute or upgrade tier

---

## Next Steps After Testing

1. **Fix all TypeScript errors** - Run `npm run type-check` and fix one by one
2. **Test upload flow** - Upload a real video file
3. **Test AI chat** - Send a message and verify response
4. **Test composition editing** - Make changes via chat
5. **Test undo/redo** - Verify history works
6. **Set up Remotion Lambda** (optional) - For cloud rendering
7. **Add authentication** - Clerk or Auth0 integration
8. **Deploy to production** - Vercel + Convex production deployment

---

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check Convex dashboard logs
3. Run `npm run type-check` for TypeScript errors
4. Check network tab for failed requests
5. Verify environment variables are loaded

---

## Architecture Reminder

```
User → Chat → AI (Dedalus) → Edit Plan → Executor → IR Update → Preview Refresh
                                                    ↓
                                              History Snapshot (Undo)
```

**Key principle**: Never regenerate full Remotion code. Always use Plan-Execute-Patch for deterministic editing.
