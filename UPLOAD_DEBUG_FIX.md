# Upload Debug Fix - November 8, 2025

## Problem

Video upload was stuck in "Uploading" status and never progressing.

## Root Causes Identified

### 1. Environment Variable Naming Mismatch
**Issue:** Convex backend code expected `CLOUDFLARE_STREAM_API_TOKEN` but the environment variable was set as `CLOUDFLARE_STREAM_TOKEN`.

**Impact:** The `requestStreamUploadUrl` action would fail to get upload URL from Cloudflare.

**Fix:**
```bash
npx convex env set CLOUDFLARE_STREAM_API_TOKEN "hboyS-5hifzfVZ0AJpXwsekLTmjcwG8Tf1jcTK4r"
```

### 2. Return Value Property Name Mismatch
**Issue:**
- `convex/media.ts` returns: `uploadUrl`
- `components/upload/VideoUpload.tsx` expected: `tusEndpoint`

**Impact:** VideoUpload component couldn't access the TUS upload URL, causing upload to fail.

**Fix:** Updated VideoUpload.tsx:
```typescript
// Before:
const { tusEndpoint, assetId } = await requestUploadUrl({...});

// After:
const { uploadUrl, assetId } = await requestUploadUrl({...});
```

And updated TUS client configuration:
```typescript
// Before:
const upload = new tus.Upload(file, {
  endpoint: tusEndpoint,
  ...
});

// After:
const upload = new tus.Upload(file, {
  endpoint: uploadUrl,
  ...
});
```

### 3. Missing Environment Variables
**Issue:** Several required Convex environment variables were missing:
- `CLOUDFLARE_WEBHOOK_SECRET` - Required for webhook signature verification
- `DEDALUS_API_KEY` - Required for AI features
- `CLOUDFLARE_R2_*` variables - Required for image uploads (not needed for video)

**Impact:** Webhook handling would fail when Cloudflare tries to notify us that video is ready.

**Fix:**
```bash
# Set Dedalus API key
npx convex env set DEDALUS_API_KEY "dsk_live_32cec63b7e6b_806856c75152ad8326ca52585d4f5d2a"

# Generate and set webhook secret
npx convex env set CLOUDFLARE_WEBHOOK_SECRET "$(openssl rand -base64 32)"
```

## Files Modified

### `/components/upload/VideoUpload.tsx`
**Lines 44-50:**
- Changed `tusEndpoint` to `uploadUrl`
- Updated console log message

**Line 61:**
- Changed `endpoint: tusEndpoint` to `endpoint: uploadUrl`

## Testing Steps

After applying these fixes:

1. **Restart Dev Server:**
   ```bash
   npm run dev
   ```

2. **Test Upload Flow:**
   - Navigate to project dashboard
   - Click "Upload" tab
   - Select a video file
   - Watch browser console for logs:
     ```
     [VideoUpload] Requesting TUS endpoint for: video.mp4
     [VideoUpload] Got TUS upload URL: https://upload.cloudflarestream.com/...
     [VideoUpload] Starting TUS upload...
     [VideoUpload] Progress: 25% (...)
     [VideoUpload] Progress: 50% (...)
     [VideoUpload] Progress: 100% (...)
     [VideoUpload] Upload finished successfully!
     ```

3. **Verify Asset Updates:**
   - Asset should show "Processing..." after upload completes
   - Cloudflare webhook should update status to "ready" within 30-60 seconds
   - Asset Library should show HLS playback URL when ready

## Expected Upload Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER SELECTS VIDEO FILE                                 │
│    Browser: File selected via dropzone                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. REQUEST UPLOAD URL                                       │
│    Frontend → Convex action: requestStreamUploadUrl        │
│    Convex → Cloudflare API: POST /stream/direct_upload     │
│    Response: { uploadURL, uid }                             │
│    Convex: Creates asset record (status: "uploading")      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TUS UPLOAD                                               │
│    Browser → Cloudflare TUS endpoint                       │
│    - Uses tus-js-client library                            │
│    - 50 MB chunks                                           │
│    - Progress updates every chunk                           │
│    - Authorization: Bearer {token}                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. UPLOAD COMPLETE                                          │
│    TUS client: onSuccess() callback                        │
│    Frontend: Updates local state to "processing"           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. CLOUDFLARE PROCESSING                                    │
│    Cloudflare Stream: Transcodes video to HLS              │
│    - Generates adaptive bitrate versions                    │
│    - Creates HLS manifest (.m3u8)                           │
│    - Generates thumbnail                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. WEBHOOK NOTIFICATION                                     │
│    Cloudflare → Convex webhook: handleStreamWebhook        │
│    - POST to /api/cloudflare/webhook                        │
│    - Includes: status="ready", uid, playbackURL             │
│    - Svix signature verification                            │
│    Convex: Updates asset (status: "ready", playbackUrl)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. ASSET READY                                              │
│    Frontend: Real-time subscription updates                │
│    Asset Library: Shows "Ready" status                      │
│    User can: Preview HLS video, use in composition         │
└─────────────────────────────────────────────────────────────┘
```

## Verification Commands

```bash
# 1. Check all environment variables are set
npx convex env list

# 2. Run environment variable test
npx convex run testEnvVars:testEnvironmentVariables

# 3. Check Convex logs during upload
npx convex logs --watch

# 4. Check Next.js dev server logs
# (Watch the terminal where `npm run dev` is running)
```

## Debug Checklist

If uploads still fail, check:

- [ ] Browser console shows no errors
- [ ] Convex logs show "[media:requestUpload] Got TUS URL"
- [ ] Network tab shows successful POST to Cloudflare TUS endpoint
- [ ] TUS upload progresses (check Network tab for PATCH requests)
- [ ] Asset record created in Convex (check via dashboard)
- [ ] Webhook receives notification from Cloudflare (check Convex logs)
- [ ] Asset status updates from "uploading" → "ready"

## Common Errors and Solutions

### Error: "Missing NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN"
**Solution:** Add to `.env.local`:
```bash
NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN=hboyS-5hifzfVZ0AJpXwsekLTmjcwG8Tf1jcTK4r
```
Restart dev server.

### Error: "Cloudflare not configured"
**Solution:** Set Convex environment variables:
```bash
npx convex env set CLOUDFLARE_ACCOUNT_ID "810f9243b0f88c79a3f2214365b9fa90"
npx convex env set CLOUDFLARE_STREAM_API_TOKEN "hboyS-5hifzfVZ0AJpXwsekLTmjcwG8Tf1jcTK4r"
```

### Error: TUS upload fails with 401 Unauthorized
**Solution:** Check that:
1. Token in `.env.local` matches token in Convex
2. Token has Stream write permissions in Cloudflare dashboard
3. Authorization header is correctly formatted: `Bearer {token}`

### Asset stuck in "uploading" after TUS completes
**Solution:** This means webhook isn't working:
1. Verify `CLOUDFLARE_WEBHOOK_SECRET` is set in Convex
2. Check Cloudflare Stream dashboard → Configure webhook URL
3. Webhook URL should be: `https://secret-puffin-489.convex.site/handleStreamWebhook`
4. Test webhook manually via Cloudflare dashboard

### Asset stuck in "processing" forever
**Solution:**
1. Check Cloudflare Stream dashboard for video status
2. Look for processing errors in Cloudflare
3. Video may be too large or unsupported format
4. Try a smaller test video (< 100 MB)

## Additional Notes

- **TUS Protocol:** Resumable uploads - if upload fails at 50%, it resumes from 50% not 0%
- **Webhook Security:** Svix library verifies Cloudflare signatures to prevent spoofing
- **HLS Streaming:** Videos are converted to adaptive bitrate HLS for efficient playback
- **No Convex File Storage:** Videos NEVER go through Convex - direct browser → Cloudflare

## Next Steps

1. **Set up Cloudflare Webhook:**
   - Go to Cloudflare Stream dashboard
   - Add webhook URL: `https://secret-puffin-489.convex.site/handleStreamWebhook`
   - Use the generated `CLOUDFLARE_WEBHOOK_SECRET` for signature verification

2. **Test with Real Video:**
   - Upload a short test video (< 50 MB)
   - Verify complete flow: upload → processing → ready
   - Check HLS playback in Asset Library

3. **Monitor Logs:**
   - Keep Convex logs open: `npx convex logs --watch`
   - Watch browser console during upload
   - Verify no errors in Network tab

## Reference Documentation

- **Cloudflare Stream TUS Upload:** https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
- **TUS Protocol:** https://tus.io/protocols/resumable-upload.html
- **Svix Webhooks:** https://docs.svix.com/receiving/verifying-payloads/how
- **Implementation Doc:** CLOUDFLARE_STREAM_IMPLEMENTATION.md
