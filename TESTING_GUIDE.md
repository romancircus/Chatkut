# ChatKut Testing Guide

This guide will help you test the application locally.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the project root:

```bash
# Convex (auto-generated when you run npx convex dev)
NEXT_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment-name

# Dedalus AI (for GPT-4o access)
DEDALUS_API_KEY=your-dedalus-api-key

# Cloudflare Stream (for video uploads)
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_STREAM_TOKEN=your-stream-token

# Cloudflare R2 (for storage)
CLOUDFLARE_R2_ACCESS_KEY=your-r2-access-key
CLOUDFLARE_R2_SECRET_KEY=your-r2-secret-key
CLOUDFLARE_R2_BUCKET=chatkut-assets
CLOUDFLARE_R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Remotion Lambda (optional - for cloud rendering)
REMOTION_AWS_REGION=us-east-1
REMOTION_FUNCTION_NAME=remotion-render-lambda
REMOTION_S3_BUCKET=chatkut-renders
```

### 3. Initialize Convex Backend

```bash
# First terminal - Start Convex dev server
npx convex dev
```

This will:
- Create a Convex project (if first time)
- Generate schema
- Deploy functions
- Provide your `NEXT_PUBLIC_CONVEX_URL`

### 4. Start Next.js Dev Server

```bash
# Second terminal - Start Next.js
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

---

## 🧪 Testing Scenarios

### Test 1: Create a Project

**Goal:** Verify homepage and project creation

1. Navigate to `http://localhost:3001`
2. You should see the ChatKut homepage
3. Click **"New Project"** button
4. Fill in project details:
   - Name: "My Test Project"
   - Description: "Testing ChatKut features"
5. Click **"Create Project"**
6. Should navigate to `/project/{id}` with 3-panel layout

**Expected Result:**
- ✅ Homepage loads with dark theme
- ✅ Modal opens with form
- ✅ Project created in Convex
- ✅ Redirected to project dashboard

---

### Test 2: Upload a Video

**Goal:** Test TUS upload and asset management

**Prerequisites:**
- Have a small video file ready (< 100MB for testing)
- Cloudflare Stream credentials configured

**Steps:**

1. In project dashboard, ensure **Left Panel** is open
2. Click **"Upload"** tab
3. Drag and drop a video file OR click to browse
4. Watch upload progress bar
5. Click **"Library"** tab to see uploaded asset

**Expected Result:**
- ✅ Dropzone accepts video files
- ✅ Progress shows (0% → 100%)
- ✅ Status changes: uploading → processing → ready
- ✅ Thumbnail appears in library
- ✅ Can preview video by clicking asset

**Troubleshooting:**
- If upload fails, check Cloudflare Stream token
- Check browser console for errors
- Verify `convex/media.ts` functions deployed

---

### Test 3: Chat with AI

**Goal:** Test real-time chat and AI integration

**Prerequisites:**
- Dedalus API key configured
- At least one asset uploaded

**Steps:**

1. In chat panel (right side), type a message:
   ```
   Create a simple video composition with my uploaded video
   ```
2. Press Enter or click Send
3. Watch for AI response
4. Check for:
   - Loading state
   - Assistant message appears
   - Edit plan preview (if generated)
   - Receipt confirmation

**Expected Result:**
- ✅ User message appears instantly (blue, right-aligned)
- ✅ Loading indicator shows
- ✅ AI response appears (gray, left-aligned)
- ✅ Message persists after page refresh

**Troubleshooting:**
- Check Dedalus API key is valid
- Open browser console for errors
- Check `convex/ai.ts` logs in Convex dashboard

---

### Test 4: Composition Preview

**Goal:** Test Remotion Player integration

**Prerequisites:**
- Project has a composition created
- Composition has at least one element

**Steps:**

1. In center panel, you should see Remotion preview
2. Click play button
3. Watch composition render
4. Test controls:
   - Play/pause
   - Seek through timeline
   - Fullscreen

**Expected Result:**
- ✅ Preview loads automatically
- ✅ Video/elements render correctly
- ✅ Animations play smoothly
- ✅ Controls work

**Mock Data (if needed):**
If no composition exists, you can create one via Convex dashboard:

```javascript
// In Convex dashboard, run this mutation:
compositions.create({
  projectId: "your-project-id",
  name: "Test Composition",
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300
})
```

---

### Test 5: Undo/Redo

**Goal:** Test history system and keyboard shortcuts

**Prerequisites:**
- Composition with at least one element

**Steps:**

1. Make an edit via chat (e.g., "Add text saying Hello")
2. Wait for edit to apply
3. Press **Cmd+Z** (Mac) or **Ctrl+Z** (Windows)
4. Verify edit is undone
5. Press **Cmd+Shift+Z** (Mac) or **Ctrl+Shift+Z** (Windows)
6. Verify edit is redone

**Expected Result:**
- ✅ Undo button becomes enabled after edit
- ✅ Keyboard shortcut works
- ✅ Composition preview updates
- ✅ History count updates

---

### Test 6: Render Video

**Goal:** Test render panel and job management

**Prerequisites:**
- Composition ready
- Remotion Lambda configured (optional)

**Steps:**

1. Toggle **Right Panel** open (click icon in header)
2. Select codec (H.264 recommended)
3. Adjust quality slider
4. Click **"Estimate Cost"**
5. Review estimated cost
6. Click **"Start Render"**
7. Watch progress in recent renders list

**Expected Result:**
- ✅ Settings panel loads
- ✅ Cost estimate appears
- ✅ Render job created
- ✅ Progress updates (0% → 100%)
- ✅ Download button appears when done

**Note:** Without Remotion Lambda configured, renders will be mocked but UI will still work.

---

### Test 7: Asset Library Filters

**Goal:** Test asset management features

**Steps:**

1. Upload multiple assets:
   - 2 videos
   - 1 image
   - 1 audio file (if possible)
2. Click filter tabs: All → Videos → Images → Audio
3. Click an asset to preview
4. Hover over asset and click delete button

**Expected Result:**
- ✅ Filters show correct assets
- ✅ Preview panel updates
- ✅ Delete confirmation appears
- ✅ Asset removed from grid

---

### Test 8: Selector Disambiguation

**Goal:** Test when AI needs clarification

**Steps:**

1. Upload 3 similar video clips
2. In chat, ask: "Make the video louder"
3. AI should show disambiguation options
4. Select one option
5. Edit should apply to selected element

**Expected Result:**
- ✅ Disambiguation UI appears
- ✅ Shows all matching options
- ✅ User can select one
- ✅ Edit executes correctly

---

### Test 9: Responsive Layout

**Goal:** Test UI adaptability

**Steps:**

1. Toggle left panel (asset library)
2. Toggle right panel (render panel)
3. Resize browser window
4. Test on different screen sizes

**Expected Result:**
- ✅ Panels collapse/expand smoothly
- ✅ Preview panel adjusts
- ✅ Chat stays functional
- ✅ Mobile view works

---

### Test 10: Real-time Sync

**Goal:** Test Convex real-time features

**Prerequisites:**
- Open same project in 2 browser tabs

**Steps:**

1. In Tab 1: Send a chat message
2. In Tab 2: Message should appear instantly
3. In Tab 1: Upload an asset
4. In Tab 2: Asset should appear in library

**Expected Result:**
- ✅ Changes sync across tabs
- ✅ No page refresh needed
- ✅ Updates happen within 1 second

---

## 🐛 Troubleshooting

### Issue: "Not authenticated" error

**Solution:**
- Convex auth is not yet set up
- For now, auth checks return mock user ID
- Check `convex/ai.ts` - user ID should be from `identity.subject`

### Issue: Upload fails immediately

**Possible causes:**
- Cloudflare Stream token invalid
- File too large (>5GB limit)
- CORS issues

**Debug:**
```bash
# Check Convex logs
npx convex logs

# Check browser console
# Look for network errors
```

### Issue: Preview doesn't load

**Solution:**
- Check if composition exists in Convex
- Verify `components/player/RemotionPreview.tsx` console logs
- Ensure Remotion packages installed: `npm list remotion`

### Issue: AI doesn't respond

**Possible causes:**
- Dedalus API key missing/invalid
- Rate limit hit
- Network error

**Debug:**
```bash
# Check Convex action logs
npx convex logs --filter="sendChatMessage"
```

### Issue: Undo doesn't work

**Solution:**
- History might be empty (no edits made yet)
- Check `convex/history.ts` - snapshots should be saving
- Verify keyboard shortcuts are registering (check console)

---

## 🔍 Checking Data

### View Database in Convex Dashboard

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Navigate to **Data** tab
4. Inspect tables:
   - `projects` - All projects
   - `compositions` - Composition IRs
   - `assets` - Uploaded media
   - `chatMessages` - Chat history
   - `compositionHistory` - Undo/redo snapshots
   - `renderJobs` - Render history

### View Logs

```bash
# All logs
npx convex logs

# Filter by function
npx convex logs --filter="sendChatMessage"

# Real-time tail
npx convex logs --tail
```

### Check Functions Deployed

```bash
# List all functions
npx convex functions

# Should see:
# - projects.*
# - compositions.*
# - ai.*
# - history.*
# - rendering.*
# - media.*
```

---

## 📊 Performance Testing

### Test Large Files

1. Upload a 1GB+ video
2. Monitor TUS resumable upload
3. Verify progress updates
4. Test pause/resume (close/reopen browser)

### Test Many Assets

1. Upload 20+ assets
2. Test library performance
3. Check virtual scrolling
4. Measure load time

### Test Long Compositions

1. Create composition with 50+ elements
2. Test preview performance
3. Check undo/redo speed
4. Measure render time

---

## ✅ Success Checklist

Mark these off as you test:

- [ ] Homepage loads correctly
- [ ] Can create new project
- [ ] Can upload video via TUS
- [ ] Assets appear in library
- [ ] Can preview assets with HLS player
- [ ] Chat interface sends/receives messages
- [ ] AI responds to queries
- [ ] Edit plans generate correctly
- [ ] Composition preview renders
- [ ] Undo/redo works with Cmd+Z
- [ ] History panel shows changes
- [ ] Render panel loads
- [ ] Can estimate render cost
- [ ] Can start render job
- [ ] Progress updates in real-time
- [ ] Panels collapse/expand
- [ ] Filters work in asset library
- [ ] Real-time sync works across tabs
- [ ] No console errors
- [ ] Dark theme looks good

---

## 🚢 Ready for Production?

Before deploying to production, ensure:

1. **Authentication**
   - [ ] Clerk or Auth0 integrated
   - [ ] User sessions work
   - [ ] Protected routes

2. **Error Handling**
   - [ ] All try-catch blocks in place
   - [ ] User-friendly error messages
   - [ ] Sentry or error tracking

3. **Performance**
   - [ ] Lighthouse score > 90
   - [ ] Bundle size optimized
   - [ ] Images optimized

4. **Security**
   - [ ] Environment variables secure
   - [ ] CORS configured
   - [ ] Rate limiting enabled

5. **Monitoring**
   - [ ] Convex logs configured
   - [ ] Analytics setup
   - [ ] Cost tracking active

---

## 📞 Need Help?

- Check `IMPLEMENTATION_SUMMARY.md` for architecture details
- Review `CLAUDE.md` for development guidance
- Open an issue on GitHub
- Check Convex logs for backend errors
- Check browser console for frontend errors

Happy testing! 🎬
