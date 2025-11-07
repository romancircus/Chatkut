# ChatKut - Quick Start Guide

## ✅ All Fixes Applied\!

All TypeScript errors have been fixed. You're ready to run the servers\!

---

## 🚀 Running the Application

### Port Configuration
**Important:** ChatKut now runs on **port 3001** (not 3000) to avoid conflicts with your other project.

### Step 1: Start Convex Dev Server (Terminal 1)

```bash
npx convex dev
```

This will:
- Push the updated schema to Convex Cloud
- Generate TypeScript types in `convex/_generated/`
- Watch for changes

**First time?** It will ask you to log in to Convex.

### Step 2: Start Next.js Dev Server (Terminal 2)

```bash
npm run dev
```

This starts Next.js on **http://localhost:3001**

### Step 3: Open Browser

Navigate to: **http://localhost:3001**

---

## 📋 What Was Fixed

### 1. React Hooks ✅
- Changed `useMutation` → `useAction` for Convex actions
- Files: ChatInterface.tsx, VideoUpload.tsx, AssetLibrary.tsx

### 2. Type System ✅
- Added `"shape"` to ElementType union
- Fixed Element → CompositionElement throughout
- Fixed Selector → ElementSelector
- Fixed animation → animations

### 3. Convex Functions ✅
- Fixed inline anonymous functions in rendering.ts
- Added helper mutations (createRenderJob, updateRenderJob)
- Fixed composition.ts IR structure
- Removed non-existent projectId field from renderJobs

### 4. Remotion Config ✅
- Removed deprecated setAwsRegion() call
- Removed non-existent backgroundColor from metadata

### 5. Port Configuration ✅
- Changed from port 3000 → 3001
- Updated package.json dev and start scripts

---

## 🧪 Testing Workflow

Once both servers are running, test in this order:

### 1. Homepage (http://localhost:3001)
- Should show empty project list
- Click "Create Project" button
- Enter project name
- Verify redirect to project dashboard

### 2. Project Dashboard
- Should see 3-panel layout:
  - **Left**: Asset library + Upload
  - **Center**: Remotion preview (black screen initially)
  - **Right**: Chat + Render panel
- All panels should load without errors

### 3. Upload a Video
- Click "Upload" tab (left panel)
- Drag & drop a video file or click to select
- Watch progress bar
- Video should appear in Asset Library when done
- Status should change: uploading → processing → ready

### 4. Chat with AI
- Type a message in chat: "Hello"
- Press Enter or click send
- Wait for AI response (via Dedalus/GPT-4o)
- Response should appear in chat

### 5. Add Video to Composition
- Type: "Add my video to the composition"
- AI should generate edit plan
- Composition IR should update
- Remotion preview should show your video

### 6. Edit the Composition
- Type: "Make the video 5 seconds long"
- AI generates edit plan
- Selector resolves to your video
- Composition updates
- Preview reflects the change
- Edit receipt shown in chat

### 7. Undo/Redo
- Click undo button (or Cmd+Z)
- Composition reverts
- Click redo button (or Cmd+Shift+Z)
- Composition re-applies change

---

## 🐛 Troubleshooting

### Convex Connection Issues
```
Error: Cannot connect to Convex
```
**Fix**: Check your internet connection and verify `NEXT_PUBLIC_CONVEX_URL` in `.env.local`

### Port Already in Use
```
Error: Port 3001 is already in use
```
**Fix**: Either:
1. Stop the process using port 3001: `lsof -ti:3001 | xargs kill`
2. Or change port in `package.json`: `"dev": "next dev -p 3002"`

### TypeScript Errors in IDE
```
Cannot find module '@/convex/_generated/api'
```
**Fix**: Run `npx convex dev` first to generate types

### Cloudflare Upload Fails
```
Error: Failed to upload to Cloudflare
```
**Fix**: Verify Cloudflare credentials in `.env.local`:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_STREAM_TOKEN
- CLOUDFLARE_R2_ACCESS_KEY
- CLOUDFLARE_R2_SECRET_KEY

### AI Responses Not Working
```
Error: Invalid API key
```
**Fix**: Verify DEDALUS_API_KEY in `.env.local`

---

## 📊 Architecture Quick Reference

```
Frontend (Next.js on :3001)
  ↓
Convex (Backend + Real-time DB)
  ↓
├─ Dedalus AI (Multi-model routing: GPT-4o, Claude)
├─ Cloudflare Stream (Video uploads + HLS playback)
├─ Cloudflare R2 (Image storage)
└─ Remotion (Video composition + rendering)
```

---

## 🎯 Key URLs

- **App**: http://localhost:3001
- **Convex Dashboard**: https://dashboard.convex.dev/t/taikuun/graceful-falcon-340
- **Dedalus Dashboard**: https://platform.dedaluslabs.ai

---

## 📝 Environment Variables Status

✅ = Configured | ❌ = Missing (optional)

| Variable | Status | Required For |
|----------|--------|--------------|
| NEXT_PUBLIC_CONVEX_URL | ✅ | Everything |
| CLOUDFLARE_ACCOUNT_ID | ✅ | Uploads |
| CLOUDFLARE_STREAM_TOKEN | ✅ | Video uploads |
| CLOUDFLARE_R2_ACCESS_KEY | ✅ | Image storage |
| CLOUDFLARE_R2_SECRET_KEY | ✅ | Image storage |
| DEDALUS_API_KEY | ✅ | AI chat |
| REMOTION_AWS_ACCESS_KEY_ID | ❌ | Cloud rendering |
| REMOTION_AWS_SECRET_ACCESS_KEY | ❌ | Cloud rendering |

Cloud rendering can be added later. All core features work without it\!

---

## 🚦 Next Steps After Testing

1. **Test the full workflow** (upload → chat → edit → undo)
2. **Report any errors** in browser console or Convex logs
3. **Add authentication** (Clerk or Auth0)
4. **Deploy to production** (Vercel + Convex)
5. **Set up Remotion Lambda** (for cloud rendering)

---

## 💡 Pro Tips

- **Check Convex Logs**: https://dashboard.convex.dev/.../logs for backend errors
- **Use Browser DevTools**: Network tab shows API calls, Console shows errors
- **Hot Reload Works**: Changes to code auto-refresh (no restart needed)
- **Database Browser**: Convex dashboard lets you view/edit database records
- **Type Safety**: TypeScript errors show in VS Code as you code

---

## ✨ You're All Set\!

Run the two commands in separate terminals:

```bash
# Terminal 1
npx convex dev

# Terminal 2  
npm run dev
```

Then open **http://localhost:3001** and start building\! 🎉
