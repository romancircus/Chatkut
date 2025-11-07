# 🚀 Start Testing ChatKut

## Quick Start (3 Simple Steps)

### Step 1: Start Convex Backend

Open a terminal and run:

```bash
cd /Users/jigyoung/Dropbox/Mac\ \(2\)/Desktop/RomanCircus_Apps/Chatkut
npx convex dev
```

**What this does:**
- Deploys your Convex schema and functions
- Starts real-time sync server
- Provides logs for debugging

**Expected output:**
```
✓ Convex functions ready!
  View logs at: https://dashboard.convex.dev/...

[Watching for changes...]
```

Leave this terminal open and running.

---

### Step 2: Start Next.js Frontend

Open a **second terminal** and run:

```bash
cd /Users/jigyoung/Dropbox/Mac\ \(2\)/Desktop/RomanCircus_Apps/Chatkut
npm run dev
```

**Expected output:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully
```

---

### Step 3: Open Browser

Open your browser and navigate to:

**http://localhost:3000**

You should see the ChatKut homepage with:
- Dark theme background
- "ChatKut - AI-Powered Video Editor" header
- "New Project" button

---

## 🎯 First Test: Create a Project

1. Click **"New Project"** button
2. Enter:
   - Name: "Test Project"
   - Description: "My first video"
3. Click **"Create Project"**
4. You'll be redirected to the project dashboard

**You should see:**
- Left panel: Asset library (empty for now)
- Center: "No Composition Yet" message
- Right: Chat interface

---

## 🎥 Second Test: Try the Chat

In the chat interface (right side), type:

```
Hello! Can you help me create a video?
```

**Expected:**
- Your message appears (blue, right-aligned)
- Loading indicator
- AI response appears (gray, left-aligned)

---

## 📤 Third Test: Upload a Video

1. Click **"Upload"** tab in left panel
2. Drag and drop a video file (or click to browse)
3. Watch progress bar fill up
4. Click **"Library"** tab to see your video

**Note:** This uses Cloudflare Stream, so upload will be real!

---

## 🎬 Fourth Test: Preview

Once a composition exists:
- Center panel will show Remotion Player
- Click play to preview
- Use controls to seek through video

---

## 🔧 If Something Doesn't Work

### Check Convex is Running

In terminal 1, you should see:
```
[Watching for changes...]
```

If errors, try:
```bash
npx convex dev --debug
```

### Check Next.js is Running

In terminal 2, you should see:
```
ready - started server on 0.0.0.0:3000
```

If port 3000 is busy:
```bash
npm run dev -- -p 3001
# Then open http://localhost:3001
```

### Check Browser Console

Press `F12` (or `Cmd+Option+I` on Mac) to open developer tools.

Look for errors in:
- **Console** tab - JavaScript errors
- **Network** tab - Failed requests

### Check Environment Variables

Make sure `.env.local` exists and has:
```bash
NEXT_PUBLIC_CONVEX_URL=https://graceful-falcon-340.convex.cloud
DEDALUS_API_KEY=dsk_live_...
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_STREAM_TOKEN=...
```

---

## 📊 Monitoring

### View Convex Data

1. Go to https://dashboard.convex.dev
2. Select your project
3. Click **Data** tab
4. See all tables (projects, assets, chatMessages, etc.)

### View Convex Logs

In terminal 1 (where Convex is running), you'll see:
- Function calls
- Errors
- Database queries

Or run separately:
```bash
npx convex logs --tail
```

---

## 🎉 Success Checklist

- [ ] Convex dev server running without errors
- [ ] Next.js dev server running on port 3000
- [ ] Homepage loads at http://localhost:3000
- [ ] Can create a new project
- [ ] Project dashboard loads with 3 panels
- [ ] Chat interface is visible
- [ ] Can send a chat message
- [ ] AI responds (may take 5-10 seconds)

---

## 🐛 Common Issues

### "Module not found" errors

**Solution:**
```bash
npm install
```

### "Convex deployment not found"

**Solution:**
Your Convex URL might have changed. Check:
```bash
cat .env.local | grep CONVEX_URL
```

Should match the URL shown when you run `npx convex dev`

### AI doesn't respond

**Check:**
1. Dedalus API key is valid
2. Check terminal 1 logs for errors
3. Open browser console for errors

**Test API key:**
```bash
curl https://api.dedaluslabs.ai/v1/models \
  -H "Authorization: Bearer dsk_live_32cec63b7e6b_806856c75152ad8326ca52585d4f5d2a"
```

Should return list of models.

### Video upload fails

**Check:**
1. Cloudflare Stream token is valid
2. File size < 5GB
3. File format is supported (mp4, mov, avi, mkv, webm)

---

## 📞 Next Steps

Once basic testing works:

1. Follow full **TESTING_GUIDE.md** for comprehensive tests
2. Try all 10 testing scenarios
3. Test undo/redo with Cmd+Z
4. Test render panel
5. Upload multiple assets

---

## 🎬 Demo Video Ideas

Create a test composition:
1. Upload 2-3 short video clips
2. Chat: "Create a video with my clips in sequence"
3. Chat: "Add text saying 'Hello World'"
4. Chat: "Make the text fade in"
5. Preview your composition
6. Try undo/redo
7. Start a render

---

## 💡 Tips

- Keep both terminals visible to see logs
- Use browser DevTools to debug issues
- Check Convex dashboard for data
- All changes sync in real-time
- Try opening 2 browser tabs to see real-time sync

---

Good luck! 🚀

If you encounter issues, check the detailed **TESTING_GUIDE.md** or review error messages in:
1. Terminal 1 (Convex logs)
2. Terminal 2 (Next.js logs)
3. Browser console (F12)
