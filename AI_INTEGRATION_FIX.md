# AI Integration Fix - Anthropic SDK Fallback

## 🎯 Status: READY FOR TESTING

The AI chat functionality has been fixed by implementing a fallback to Anthropic SDK when Dedalus SDK is unavailable.

## 🔧 What Was Fixed

**Root Cause:** Dedalus SDK doesn't have Node.js/TypeScript support yet (only Python SDK available).

**The Fix:** Implemented API key detection and fallback logic:
- Check if API key starts with `sk-ant-` (Anthropic) or `dsk_` (Dedalus)
- If Anthropic key: Use Anthropic SDK directly via `@anthropic-ai/sdk`
- If Dedalus key but no Anthropic SDK available: Return helpful error message

## 📋 Setup Instructions

### Option 1: Use Anthropic API Key (Recommended)

1. **Get Anthropic API key:**
   - Visit: https://console.anthropic.com/
   - Create account or sign in
   - Navigate to API Keys section
   - Create a new API key (starts with `sk-ant-`)

2. **Set in Convex:**
   ```bash
   npx convex env set ANTHROPIC_API_KEY "sk-ant-your-api-key-here"
   ```

3. **Verify:**
   ```bash
   npx convex env list | grep ANTHROPIC
   ```
   Should show: `ANTHROPIC_API_KEY=sk-ant-...`

### Option 2: Wait for Dedalus Node.js SDK

If you want to use the existing Dedalus key (`dsk_live_...`), you'll need to wait for official Node.js support from Dedalus Labs.

Currently, the system will show this message:
```
I understand you want to: [your message]

However, I need a valid Anthropic API key to process this request.
Please set ANTHROPIC_API_KEY in your Convex environment.
```

## 📊 How It Works

### API Key Detection

```typescript
function createDedalusClient(apiKey: string): DedalusClient {
  const Anthropic = require("@anthropic-ai/sdk");
  const isAnthropicKey = apiKey.startsWith("sk-ant-");

  if (!isAnthropicKey) {
    console.warn("[dedalus:client] Non-Anthropic API key detected. Using mock responses for now.");
    // Returns mock client with helpful error messages
  }

  const anthropic = new Anthropic.Anthropic({ apiKey });
  // Implements generateText and generateJSON using Anthropic SDK
}
```

### Environment Variable Priority

```typescript
const AI_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.DEDALUS_API_KEY;
```

The system checks for:
1. `ANTHROPIC_API_KEY` first (preferred)
2. `DEDALUS_API_KEY` as fallback
3. Throws error if neither is set

## 🧪 Testing the AI Chat

### Prerequisites
Ensure both servers are running:
```bash
# Terminal 1: Convex
npx convex dev

# Terminal 2: Next.js
npm run dev
```

### Test Steps

1. **Set Anthropic API Key** (if not already set):
   ```bash
   npx convex env set ANTHROPIC_API_KEY "sk-ant-your-key"
   ```

2. **Navigate to the app:**
   - Open: http://localhost:3001
   - Go to your project with uploaded video

3. **Test chat command:**
   - Type in chat: "zoom into the large ape as it enters frame"
   - Press Enter or Send button

4. **Monitor browser console:**
   - Open DevTools → Console tab
   - You should see:
     ```
     [dedalus:client] Initializing AI SDK...
     [dedalus:client] AI SDK initialized ✅
     [dedalus:chat] Generating response for: zoom into the large ape as it enters frame...
     [dedalus:client] Calling Anthropic claude-sonnet-4-20250514...
     [dedalus:chat] Response generated: { model: "claude-sonnet-4-...", provider: "anthropic", tokens: ... }
     ```

5. **Expected behavior:**
   - AI should respond with acknowledgment of the request
   - Chat message should appear in the chat history
   - If edit functionality is implemented, it should create an edit plan

## 🐛 Troubleshooting

### Error: "AI API key not configured"

**Solution:**
```bash
npx convex env set ANTHROPIC_API_KEY "sk-ant-your-api-key"
```

### Error: "generateText is not a function"

**Cause:** Using old code before the fix.

**Solution:**
1. Hard refresh browser: **Cmd + Shift + R** (Mac) or **Ctrl + Shift + R** (Windows)
2. Clear browser cache:
   ```javascript
   localStorage.clear();
   location.reload();
   ```
3. Verify latest code is deployed:
   ```bash
   git pull origin master
   npx convex dev  # Redeploy Convex functions
   ```

### Error: "Anthropic API error (401)"

**Cause:** Invalid API key.

**Solution:**
1. Verify your API key from https://console.anthropic.com/
2. Re-set the environment variable:
   ```bash
   npx convex env remove ANTHROPIC_API_KEY
   npx convex env set ANTHROPIC_API_KEY "sk-ant-correct-key"
   ```

### Mock Response Shown Instead of Real Response

**Cause:** System detected Dedalus key (`dsk_...`) but no Anthropic key is set.

**Solution:** Set Anthropic API key as shown above.

## 📝 Files Modified

### 1. `.env.example`
Added documentation for both API key options:
```bash
# Option 1: Dedalus AI (multi-model routing - NOT YET SUPPORTED IN NODE.JS)
# DEDALUS_API_KEY=dsk_your-dedalus-api-key

# Option 2: Anthropic Claude (RECOMMENDED - fallback when Dedalus unavailable)
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
```

### 2. `lib/dedalus/client.ts`
- Implemented `createDedalusClient()` function with API key detection
- Added mock client for non-Anthropic keys
- Implemented Anthropic SDK integration with `generateText()` and `generateJSON()`
- Updated `getAIClient()` to prefer `ANTHROPIC_API_KEY`

### 3. `convex/ai.ts`
- Changed `DEDALUS_API_KEY` to `AI_API_KEY`
- Updated error messages to mention both API key options
- Changed comments from "Dedalus SDK" to "AI SDK"

## 🔄 What Happens Next

### If Using Anthropic API Key:
1. ✅ Chat functionality should work immediately
2. ✅ All AI operations (chat, edit plans, code generation) use Claude Sonnet 4.5
3. ✅ Token usage and costs are tracked
4. ⚠️ Note: Uses Anthropic directly (no multi-model routing until Dedalus SDK is available)

### If Waiting for Dedalus SDK:
1. ❌ Chat will show mock responses with helpful error message
2. ❌ Edit functionality won't work
3. ⏳ Wait for Dedalus Labs to release Node.js SDK
4. ⏳ Then remove fallback logic and use Dedalus SDK directly

## 📚 Key Learnings

1. **Always check documentation first:** Should have verified Dedalus SDK language support before implementing
2. **Graceful degradation:** Implemented fallback with helpful error messages instead of crashing
3. **Environment variable flexibility:** System now supports multiple API key sources
4. **API key prefix detection:** Simple pattern matching (`startsWith()`) provides robust detection

## 🎓 Implementation Details

### Anthropic SDK Usage

```typescript
const anthropic = new Anthropic.Anthropic({ apiKey });

const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  temperature: 0.7,
  system: systemPrompt,
  messages: [{ role: "user", content: prompt }],
});

const text = message.content[0].type === "text" ? message.content[0].text : "";

return {
  text,
  model: message.model,
  provider: "anthropic",
  usage: {
    input: message.usage.input_tokens,
    output: message.usage.output_tokens,
    total: message.usage.input_tokens + message.usage.output_tokens,
  },
};
```

### Model Routing (When Using Anthropic Directly)

Since we're bypassing Dedalus multi-model routing, we use Claude Sonnet 4.5 for all tasks:

- **Chat responses:** Claude Sonnet 4.5 (temp: 0.7)
- **Edit plans:** Claude Sonnet 4.5 (temp: 0.3)
- **Code generation:** Claude Sonnet 4.5 (temp: 0.3)

This is more expensive than multi-model routing but provides consistent high-quality results.

## 🔗 References

- Anthropic API docs: https://docs.anthropic.com/claude/reference/
- Dedalus SDK docs: Retrieved via Context7 (Python only)
- Implementation files:
  - `lib/dedalus/client.ts`
  - `convex/ai.ts`
  - `.env.example`

---

**Ready for testing!** 🚀

Please set your Anthropic API key and test the chat functionality:

```bash
npx convex env set ANTHROPIC_API_KEY "sk-ant-your-key"
```

Then navigate to your project and type: "zoom into the large ape as it enters frame"
