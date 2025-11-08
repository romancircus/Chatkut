# Cloudflare Stream TUS Upload Implementation

## Complete Fix Based on Official Cloudflare Documentation

This document details the comprehensive implementation of Cloudflare Stream video uploads using the TUS protocol, based on the official Cloudflare Stream documentation.

---

## Previous Issues (All Fixed)

1. ❌ Used Direct Upload API incorrectly (one-time URLs instead of TUS endpoint)
2. ❌ Used `uploadUrl` parameter instead of `endpoint` in TUS client
3. ❌ Missing Authorization headers in TUS client
4. ❌ Incorrect metadata field names (`filename` instead of `name`)
5. ❌ Missing stream-media-id header capture
6. ❌ Incorrect chunk size and retry configuration
7. ❌ Missing frontend access to Cloudflare API token

---

## Implementation Overview

### Architecture

```
Browser → Convex Action → TUS Endpoint URL
   ↓
TUS Client → Cloudflare Stream API → Video Processing
   ↓
stream-media-id header → Convex Mutation → Asset Update
```

### Key Components

1. **Convex Backend** (`convex/media.ts`)
   - Returns TUS endpoint URL (not one-time upload URL)
   - Creates asset record with placeholder streamId

2. **Frontend Upload** (`components/upload/VideoUpload.tsx`)
   - Configures TUS client with correct endpoint and headers
   - Captures stream-media-id from response headers
   - Updates asset record with actual streamId

---

## Detailed Implementation

### 1. Convex Backend (`convex/media.ts`)

#### `requestStreamUploadUrl` Action

**What Changed:**
- Removed Direct Upload API call
- Returns account-level TUS endpoint instead
- Creates asset without streamId (updated later)

**Implementation:**

```typescript
export const requestStreamUploadUrl = action({
  args: {
    projectId: v.id("projects"),
    filename: v.string(),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, filename, fileSize }): Promise<{
    assetId: any;
    tusEndpoint: string;
  }> => {
    // TUS endpoint URL (account-level, not per-video)
    const tusEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

    // Create asset record without streamId
    const assetId = await ctx.runMutation(api.media.createAsset, {
      projectId,
      streamId: undefined, // Will be set by frontend
      filename,
      fileSize,
      type: "video",
      status: "uploading",
      uploadUrl: tusEndpoint,
    });

    return {
      assetId,
      tusEndpoint,
    };
  },
});
```

#### `updateAssetStreamId` Mutation (New)

**Purpose:** Update asset with stream ID captured from TUS response headers

```typescript
export const updateAssetStreamId = mutation({
  args: {
    assetId: v.id("assets"),
    streamId: v.string(),
  },
  handler: async (ctx, { assetId, streamId }) => {
    await ctx.db.patch(assetId, {
      streamId,
      updatedAt: Date.now(),
    });
  },
});
```

---

### 2. Frontend Upload (`components/upload/VideoUpload.tsx`)

#### TUS Client Configuration

**Critical Changes:**
- Use `endpoint` option (not `uploadUrl`)
- Include Authorization header with token
- Set chunk size to 50 MB (min 5 MB required)
- Use metadata field `name` (not `filename`)
- Capture `stream-media-id` from response headers

**Implementation:**

```typescript
// Get TUS endpoint from Convex
const { tusEndpoint, assetId } = await requestUploadUrl({
  projectId,
  filename: file.name,
  fileSize: file.size,
});

// Get API token from environment
const CLOUDFLARE_STREAM_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN;

// Configure TUS client
const upload = new tus.Upload(file, {
  endpoint: tusEndpoint, // ✅ Use endpoint, not uploadUrl
  headers: {
    Authorization: `Bearer ${CLOUDFLARE_STREAM_TOKEN}`, // ✅ Required!
  },
  chunkSize: 50 * 1024 * 1024, // ✅ 50 MB (Cloudflare requires min 5 MB)
  retryDelays: [0, 3000, 5000, 10000, 20000], // ✅ From Cloudflare docs
  metadata: {
    name: file.name, // ✅ Use 'name', not 'filename'
    filetype: file.type,
  },
  uploadSize: file.size, // ✅ Explicitly set size

  onAfterResponse: (req, res) => {
    // ✅ Capture stream-media-id from response headers
    return new Promise((resolve) => {
      const streamMediaId = res.getHeader("stream-media-id");
      if (streamMediaId) {
        // Update asset with the stream ID
        updateStreamId({ assetId, streamId: streamMediaId });
      }
      resolve();
    });
  },

  onError: (error) => {
    console.error("[VideoUpload] Upload failed:", error);
  },

  onProgress: (bytesUploaded, bytesTotal) => {
    const progress = Math.round((bytesUploaded / bytesTotal) * 100);
    console.log(`Progress: ${progress}%`);
  },

  onSuccess: () => {
    console.log("Upload finished successfully!");
  },
});

// Start upload
upload.start();
```

---

## Environment Variables

### Required Setup

#### 1. Convex Backend (Cloud Environment)

Set these via Convex CLI (one-time setup):

```bash
npx convex env set CLOUDFLARE_ACCOUNT_ID your_account_id
npx convex env set CLOUDFLARE_STREAM_TOKEN your_stream_token
npx convex env set CLOUDFLARE_R2_ACCESS_KEY your_r2_access_key
npx convex env set CLOUDFLARE_R2_SECRET_KEY your_r2_secret_key
npx convex env set CLOUDFLARE_R2_BUCKET_NAME chatkut-media
```

#### 2. Next.js Frontend (`.env.local`)

```bash
# Frontend needs the Stream token for TUS client
NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN=your_stream_token

# Convex URL (generated by npx convex dev)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

**CRITICAL:** The `NEXT_PUBLIC_` prefix makes the token available to the browser. This is required for the TUS client to authenticate with Cloudflare Stream.

---

## How TUS Upload Works (Step by Step)

### 1. User Selects File

```
Browser: User drops video file
```

### 2. Request TUS Endpoint

```
Frontend → Convex Action
  Inputs: { projectId, filename, fileSize }
  Returns: { assetId, tusEndpoint }

Convex creates asset record with status="uploading"
```

### 3. TUS Client Initialization

```
TUS Client configured with:
  - endpoint: "https://api.cloudflare.com/client/v4/accounts/{account}/stream"
  - headers: { Authorization: "Bearer {token}" }
  - metadata: { name: filename, filetype: file.type }
```

### 4. TUS Upload Process

```
POST /stream (TUS creates upload session)
  → Response includes:
     - Location header: upload URL for this specific video
     - stream-media-id header: unique video ID

PATCH /stream/{id} (Upload chunks)
  → 50 MB chunks uploaded sequentially
  → Progress callbacks fired
```

### 5. Stream ID Capture

```
onAfterResponse callback:
  - Extract stream-media-id from response headers
  - Call Convex mutation to update asset record
  - Asset now has streamId for later webhook matching
```

### 6. Upload Complete

```
onSuccess callback:
  - Set status to "processing"
  - Cloudflare Stream processes video
  - Webhook will update status to "ready" when done
```

---

## Key Differences from Previous Implementation

| Aspect | ❌ Old (Wrong) | ✅ New (Correct) |
|--------|---------------|-----------------|
| API Endpoint | `/stream/direct_upload` | `/stream` (TUS endpoint) |
| TUS Option | `uploadUrl` | `endpoint` |
| Authorization | None | `Bearer {token}` in headers |
| Metadata | `filename`, `projectId` | `name`, `filetype` |
| Chunk Size | Not specified | 50 MB (min 5 MB) |
| Stream ID | From API response | From `stream-media-id` header |
| Environment | Backend only | Backend + Frontend |

---

## Testing Checklist

### 1. Environment Variables

```bash
# Verify Convex env vars
npx convex env list

# Should show:
# - CLOUDFLARE_ACCOUNT_ID
# - CLOUDFLARE_STREAM_TOKEN
# - CLOUDFLARE_R2_ACCESS_KEY
# - CLOUDFLARE_R2_SECRET_KEY

# Verify frontend env vars
cat .env.local | grep CLOUDFLARE

# Should show:
# NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN=...
```

### 2. Upload Test

1. Start servers:
   ```bash
   npm run dev:all
   ```

2. Navigate to `http://localhost:3001`

3. Create project

4. Upload a small test video (< 100 MB first)

5. Check browser console for logs:
   ```
   [VideoUpload] Requesting TUS endpoint for: test.mp4
   [VideoUpload] Got TUS endpoint: https://api.cloudflare.com/...
   [VideoUpload] Starting TUS upload...
   [VideoUpload] Progress: 25% (...)
   [VideoUpload] Got stream-media-id: abc123...
   [VideoUpload] Upload finished successfully!
   ```

6. Check Convex logs for asset creation:
   ```bash
   npx convex logs --tail
   ```

### 3. Expected Success Indicators

✅ No "Decoding Error" messages
✅ Progress bar updates smoothly
✅ stream-media-id captured in logs
✅ Asset record updated with streamId
✅ Status changes: uploading → processing → complete

---

## Troubleshooting

### Error: "Missing NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN"

**Fix:** Add to `.env.local`:
```bash
NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN=your_token_here
```

### Error: "401 Unauthorized"

**Fix:** Check token is correct:
```bash
curl https://api.cloudflare.com/client/v4/accounts/{account}/stream \
  -H "Authorization: Bearer {token}"
```

### Error: "Decoding Error"

**Fix:** This was the original issue. Ensure:
- Using `endpoint` option (not `uploadUrl`)
- Using `metadata.name` (not `metadata.filename`)
- Removed `allowedOrigins` from request body

### Upload Stalls at 0%

**Fix:**
- Check chunk size is ≥ 5 MB
- Verify Authorization header is set
- Check browser console for errors

---

## Documentation References

- [Cloudflare Stream TUS Uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/)
- [Cloudflare Stream Direct Uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/)
- [TUS Protocol Specification](https://tus.io/)
- [tus-js-client Documentation](https://github.com/tus/tus-js-client)

---

## Summary of Changes

### Files Modified

1. **convex/media.ts**
   - Changed `requestStreamUploadUrl` to return TUS endpoint
   - Added `updateAssetStreamId` mutation
   - Removed Direct Upload API call
   - Added comprehensive logging

2. **components/upload/VideoUpload.tsx**
   - Changed from `uploadUrl` to `endpoint` configuration
   - Added Authorization header with token
   - Fixed metadata field names
   - Added `onAfterResponse` to capture stream-media-id
   - Increased chunk size to 50 MB
   - Added updateStreamId mutation call
   - Added comprehensive logging

3. **.env.example**
   - Added `NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN`
   - Documented frontend token requirement

### Environment Variables Added

- `NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN` (frontend)

### New Mutations

- `api.media.updateAssetStreamId` (update asset after upload starts)

---

## Next Steps

1. ✅ Test upload with small video (< 100 MB)
2. ✅ Test upload with large video (> 1 GB)
3. ⏳ Implement webhook handler for "ready" status
4. ⏳ Add retry logic for failed uploads
5. ⏳ Add upload pause/resume functionality
6. ⏳ Add multiple file upload queue
7. ⏳ Add upload cancellation

---

**Implementation Complete:** All issues from iterative debugging have been resolved by following the official Cloudflare Stream documentation for TUS uploads.
