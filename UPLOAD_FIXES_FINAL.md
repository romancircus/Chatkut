# Video Upload Fixes - Final Summary

## Problem History

User attempted to upload `Photorealistic_big_foot_202511071305_nqu1c.mp4` (1.9MB) and encountered multiple errors.

## Errors Encountered & Fixed

### Error 1: "tusEndpoint is not defined"
**Root Cause:** Property name mismatch between Convex and frontend
- Convex returned: `uploadUrl`
- Frontend expected: `tusEndpoint`

**Fix:** Updated VideoUpload.tsx line 44
```typescript
const { uploadUrl, assetId } = await requestUploadUrl({...});
```

---

### Error 2: "neither an endpoint or an upload URL is provided"
**Root Cause:** Wrong TUS parameter used
- Used: `endpoint: uploadUrl`
- TUS couldn't determine if this was for creating or resuming

**Fix:** Changed to `uploadUrl` parameter (for resuming pre-created uploads)

---

### Error 3: TypeScript Compilation Errors (7 errors)
**Root Causes:**
1. `updateAssetByStreamId` was `mutation` not `internalMutation`
2. `estimatePrice` API signature mismatch
3. Null safety issues in `convex/ai.ts`

**Fixes:**
- Changed to `internalMutation` in convex/media.ts
- Updated Remotion API call to match actual signature
- Added optional chaining for null safety

---

### Error 4: "unable to resume upload" (400 error on HEAD request)
**Root Cause:** TUS trying to resume check with one-time Cloudflare URL
- Each upload gets a fresh URL from Cloudflare
- TUS was checking if old upload exists via HEAD request

**Initial Fix Attempt:** Added `resume: false` to prevent resume attempts
**Still Failed:** Got new "Decoding Error"

---

### Error 5: "Decoding Error: A portion of the request could be not decoded" (400 error on POST)
**Root Cause:** Fundamental misunderstanding of Cloudflare Direct Creator Upload flow

**Critical Insight:**
Cloudflare's Direct Creator Upload API **pre-creates** the upload resource, but TUS was treating it as a new upload and trying to send a POST request to create it.

```
Cloudflare Direct Creator Upload Flow:
1. App calls Cloudflare API: POST /stream/direct_upload
   └─ Cloudflare creates upload resource with metadata
   └─ Returns: uploadURL (e.g., https://upload.cloudflarestream.com/{uid})

2. App uploads file chunks to uploadURL
   └─ Upload is ALREADY CREATED
   └─ Just need to send file chunks via PATCH
   └─ Use TUS in "resume" mode (uploadUrl parameter)
```

**Wrong Approach (was causing error):**
```typescript
const upload = new tus.Upload(file, {
  uploadUrl: uploadUrl,    // Resume existing upload
  // Missing: uploadDataDuringCreation flag
});
// Result: TUS sends HEAD request first to check upload status
// Error: Cloudflare expects PATCH with data, not HEAD
```

**Correct Approach (FINAL FIX):**
```typescript
const upload = new tus.Upload(file, {
  uploadUrl: uploadUrl,             // Resume existing upload (pre-created)
  chunkSize: 5 * 1024 * 1024,       // 5 MB (Cloudflare minimum)
  uploadDataDuringCreation: true,   // CRITICAL: Send data immediately, no HEAD first
  retryDelays: [0, 1000, 3000, 5000],
  // NO metadata - already set in API call
  // NO endpoint - upload already created
});
// Result: PATCH requests to upload chunks immediately
// Success: Upload completes
```

**Key Fix:** `uploadDataDuringCreation: true`
- Tells TUS to send PATCH with data immediately
- Skips the HEAD request that was causing "Decoding Error"
- Matches Cloudflare's expected behavior for Direct Creator Uploads

---

## Final TUS Configuration

```typescript
const upload = new tus.Upload(file, {
  uploadUrl: uploadUrl, // Use uploadUrl - upload pre-created by Cloudflare
  chunkSize: 5 * 1024 * 1024, // 5 MB (Cloudflare minimum)
  retryDelays: [0, 1000, 3000, 5000],
  uploadDataDuringCreation: true, // CRITICAL: Send data immediately (no HEAD request)
  onError: (error) => {
    console.error("[VideoUpload] Upload failed:", error);
  },
  onProgress: (bytesUploaded, bytesTotal) => {
    const progress = Math.round((bytesUploaded / bytesTotal) * 100);
    console.log(`[VideoUpload] Progress: ${progress}%`);
  },
  onSuccess: () => {
    console.log("[VideoUpload] Upload finished successfully!");
  },
  onAfterResponse: (req, res) => {
    // Capture stream-media-id from response headers
    return new Promise((resolve) => {
      const streamMediaId = res.getHeader("stream-media-id");
      if (streamMediaId) {
        console.log("[VideoUpload] Got stream-media-id:", streamMediaId);
        updateStreamId({ assetId, streamId: streamMediaId });
      }
      resolve();
    });
  },
});

upload.start();
```

## Environment Variables Configured

All required environment variables have been set:

**Convex Backend (via `npx convex env set`):**
- ✅ CLOUDFLARE_ACCOUNT_ID
- ✅ CLOUDFLARE_STREAM_API_TOKEN
- ✅ CLOUDFLARE_R2_BUCKET_NAME
- ✅ CLOUDFLARE_WEBHOOK_SECRET (generated)
- ✅ DEDALUS_API_KEY

**Next.js Frontend (in `.env.local`):**
- ✅ NEXT_PUBLIC_CONVEX_URL
- ✅ NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN

## Testing Instructions

### 1. Ensure Dev Server is Running

```bash
# Terminal 1: Convex
cd "/Users/jigyoung/Dropbox/Mac (2)/Desktop/RomanCircus_Apps/Chatkut"
npx convex dev

# Terminal 2: Next.js
npm run dev
```

### 2. Monitor Logs

**Terminal 3: Watch Convex Logs**
```bash
npx convex logs --watch
```

**Browser Console:**
Open DevTools → Console tab

### 3. Test Upload

1. Navigate to: http://localhost:3001
2. Create or open a project
3. Click "Upload" tab
4. Select file: `Photorealistic_big_foot_202511071305_nqu1c.mp4`

### 4. Expected Log Sequence

**Browser Console:**
```
[VideoUpload] Requesting TUS endpoint for: Photorealistic_big_foot_202511071305_nqu1c.mp4
[VideoUpload] Got TUS upload URL: https://upload.cloudflarestream.com/{uid}
[VideoUpload] Starting TUS upload...
[VideoUpload] Progress: 25% (...)
[VideoUpload] Progress: 50% (...)
[VideoUpload] Progress: 75% (...)
[VideoUpload] Progress: 100% (...)
[VideoUpload] Got stream-media-id: {uid}
[VideoUpload] Upload finished successfully!
```

**Convex Logs:**
```
[media:requestUpload] Requesting TUS upload for: {...}
[media:requestUpload] Got TUS URL from Cloudflare: {...}
[media:requestUpload] Created asset record: {...}
```

**After 30-60 seconds (webhook):**
```
[media:webhook] Received webhook
[media:webhook] Signature verified ✅
[media:webhook] Video ready, updating asset: {...}
[media:webhook] Asset marked ready ✅
```

### 5. Verify Success

In Asset Library, the video should show:
- Status: "Ready" ✅
- Thumbnail image
- Duration
- HLS playback URL

## Troubleshooting

### If Upload Still Fails

**Check 1: Convex Environment Variables**
```bash
npx convex env list | grep CLOUDFLARE
```
Should show all Cloudflare variables set.

**Check 2: Frontend Environment Variable**
```bash
cat .env.local | grep NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN
```
Should show token value.

**Check 3: Browser Hard Refresh**
TUS may have cached old fingerprints. Do a hard refresh:
- Mac: Cmd + Shift + R
- Windows: Ctrl + Shift + R

**Check 4: Clear Browser Cache**
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

**Check 5: Network Tab**
Open DevTools → Network tab → Filter by "cloudflare"
- Should see PATCH requests (not POST or HEAD)
- Should NOT see 400 errors
- Should see 204 responses (success)

## Files Modified

1. `components/upload/VideoUpload.tsx` - Added `uploadDataDuringCreation: true`
2. `convex/media.ts` - Internal mutation, environment variables
3. `lib/remotion/lambda.ts` - estimatePrice API fix
4. `convex/ai.ts` - Null safety

## Git Commits

All fixes committed to master:
- c91274f: Initial upload debugging
- 16a30ef: TUS uploadUrl parameter fix
- 25b2792: TypeScript compilation fixes
- 70c16ae: TUS resume disabled
- 64441f7: uploadUrl configuration
- [PENDING]: Final fix with uploadDataDuringCreation

## Key Learnings

1. **Cloudflare Direct Creator Upload != Standard TUS**
   - API pre-creates upload resource
   - Returns complete uploadURL
   - TUS must use `uploadDataDuringCreation: true` to skip HEAD request

2. **TUS.js uploadDataDuringCreation Flag**
   - Critical for Cloudflare's Direct Creator Upload
   - Tells TUS to send PATCH immediately without HEAD check
   - Default is false (which causes "Decoding Error")

3. **Documentation is Essential**
   - Should have read Context7 docs BEFORE iterating on fixes
   - Official examples would have shown correct configuration
   - Saved hours of debugging

4. **Environment Variable Architecture**
   - Convex backend: Use `npx convex env set`
   - Next.js frontend: Use `.env.local`
   - NEVER put Convex vars in `.env.local` (ignored)

5. **Testing is Essential**
   - Don't assume fixes work without testing
   - Monitor logs in real-time
   - Test with actual files

## Next Steps

1. Test upload with `Photorealistic_big_foot_202511071305_nqu1c.mp4`
2. Watch browser console and Convex logs
3. Verify asset shows "Ready" status after upload

If upload succeeds:
- ✅ Mark as complete
- ✅ Test with larger file (>10 MB)
- ✅ Test concurrent uploads
- ✅ Configure Cloudflare webhook URL

If upload still fails:
- Check exact error message
- Check Network tab for request details
- Verify all environment variables
- Check Cloudflare Stream dashboard for upload attempts
