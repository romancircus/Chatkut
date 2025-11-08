# Convex Environment Variables - CRITICAL KNOWLEDGE

## ⚠️ THE FUNDAMENTAL MISTAKE I MADE

**WRONG ASSUMPTION**: I thought Convex backend functions run locally in Node.js, so I spent hours trying to pass environment variables through `process.env` via shell scripts.

**REALITY**: Convex backend functions run **IN THE CLOUD**, not locally! When you run `npx convex dev`:
1. Your local code is watched for changes
2. Code is uploaded to Convex's cloud infrastructure
3. Functions execute in **Convex's cloud environment**
4. Local `process.env` variables are **completely ignored**

## ✅ THE CORRECT WAY

Convex has its own environment variable system that stores secrets in the cloud.

### Setting Environment Variables (One-Time Setup)

```bash
# Use Convex CLI to set environment variables in the cloud
npx convex env set CLOUDFLARE_ACCOUNT_ID your_account_id
npx convex env set CLOUDFLARE_STREAM_TOKEN your_token
npx convex env set CLOUDFLARE_R2_ACCESS_KEY your_key
npx convex env set CLOUDFLARE_R2_SECRET_KEY your_secret
npx convex env set CLOUDFLARE_R2_BUCKET_NAME chatkut-media
```

### Accessing in Convex Functions

```typescript
// convex/media.ts
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
// This works because Convex injects env vars set via `convex env set`
```

### Listing Environment Variables

```bash
npx convex env list
```

### Getting a Specific Variable

```bash
npx convex env get CLOUDFLARE_ACCOUNT_ID
```

### Removing a Variable

```bash
npx convex env remove CLOUDFLARE_ACCOUNT_ID
```

## 🚫 WHAT DOESN'T WORK

1. ❌ `.env.local` files in project root (only for Next.js frontend)
2. ❌ `convex/.env.local` files (Convex doesn't read these)
3. ❌ Passing env vars through shell when running `npx convex dev`
4. ❌ Any Node.js environment variable tricks

## 📚 Why This Matters

- **Frontend (Next.js)**: Uses `.env.local` - runs in your browser/Node.js server
- **Backend (Convex)**: Uses `npx convex env set` - runs in Convex's cloud

They are **completely separate environments** with different environment variable systems.

## 🎯 Quick Reference

| Environment | How to Set Vars | Where Code Runs | Access Method |
|-------------|----------------|-----------------|---------------|
| Next.js Frontend | `.env.local` | Browser/Local Node | `process.env.NEXT_PUBLIC_*` |
| Convex Backend | `npx convex env set` | Convex Cloud | `process.env.*` |

## 🔄 Development Workflow

1. **Frontend secrets** → Add to `.env.local`
2. **Backend secrets** → Run `npx convex env set KEY value`
3. **Both need same secret?** → Set it in BOTH places

## ⚡ The Script I Created Was Wrong

The `scripts/dev-convex.js` script that loads `.env.local` and passes vars to `npx convex dev` **does nothing useful** because Convex ignores those environment variables.

**Keep it anyway** for consistency with npm scripts, but know that environment variables must be set via `npx convex env set` for Convex to actually use them.

## 📖 Official Documentation

https://docs.convex.dev/production/environment-variables

---

**LESSON LEARNED**: Always check WHERE code executes (local vs cloud) before assuming environment variable mechanisms!
