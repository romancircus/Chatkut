# ChatKut Development Workflow

## Lessons from Cloudflare Stream Implementation

This document codifies the lessons learned from implementing Cloudflare Stream uploads and establishes best practices for all future development.

---

## 🎯 The Core Problem We Solved

### What Went Wrong

We spent **3+ hours** debugging Cloudflare Stream video uploads through iterative trial-and-error:

1. ❌ Tried Direct Upload API (wrong approach)
2. ❌ Used `uploadUrl` instead of `endpoint` in TUS client
3. ❌ Missing Authorization headers
4. ❌ Wrong metadata field names
5. ❌ Didn't capture `stream-media-id` from response headers
6. ❌ Each fix revealed another issue

### What We Should Have Done

**15 minutes** to read official Cloudflare Stream documentation via Context7:
1. ✅ Understand TUS upload flow completely
2. ✅ See exact TUS client configuration
3. ✅ Know all required headers and metadata
4. ✅ Implement correctly the first time

### The Lesson

> **Documentation-first development prevents 90% of implementation bugs.**

---

## 🚨 New Standing Orders (Added to CLAUDE.md)

### 1. Documentation-First Development (MANDATORY)

Before writing any integration code:

```typescript
// Step 1: Resolve library ID
const libs = await mcp__context7__resolve-library-id({
  libraryName: "cloudflare stream"
});

// Step 2: Get documentation
const docs = await mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/llmstxt/developers_cloudflare_com-stream-llms-full.txt",
  topic: "TUS upload API authentication headers",
  tokens: 10000
});

// Step 3: Read and understand COMPLETELY
// Step 4: Implement based on official examples
```

### 2. Avoid Iterative Debugging

**DON'T:**
- Make small change → test → error → repeat

**DO:**
- Read docs → understand full flow → implement complete solution

### 3. Reference Core Documentation

Created `DOCUMENTATION_LIBRARY.md` with:
- All Context7 library IDs for ChatKut's tech stack
- Topic keywords for each service
- Example queries for common use cases

### 4. Environment Variable Architecture

**Critical Distinction:**
- **Convex Backend (Cloud):** Use `npx convex env set`
- **Next.js Frontend:** Use `.env.local` with `NEXT_PUBLIC_` prefix

### 5. Comprehensive Logging

Always add detailed logs:
```typescript
console.log("[module:function] Description:", { data });
```

### 6. Specific Error Messages

Include service name, status code, and original error:
```typescript
throw new Error(`Cloudflare Stream API error (${status}): ${text}`);
```

### 7. Implementation Documentation

After complex features, create markdown docs:
- Architecture explanation
- Configuration requirements
- Troubleshooting section
- Testing checklist

### 8. Testing Before Complete

Never say "should work" - verify it works:
- Happy path
- Error cases
- Edge cases
- Realistic data

---

## 📚 Core Documentation Libraries

### Critical (Must Reference)

| Technology | Library ID | Code Snippets | Use For |
|------------|-----------|---------------|---------|
| Cloudflare Stream | `/llmstxt/developers_cloudflare_com-stream-llms-full.txt` | 4,128 | Video uploads, TUS, HLS |
| Cloudflare R2 | `/llmstxt/developers_cloudflare_r2_llms-full_txt` | 4,729 | Object storage |
| Convex | Search "convex" | Varies | Real-time backend |
| Remotion | Search "remotion" | Varies | Video rendering |
| Next.js | Built-in MCP: `nextjs_docs` | N/A | App Router, SSR |

### Important (Reference When Needed)

- TUS Protocol
- React
- TypeScript
- Dedalus AI
- Tailwind CSS
- Playwright

---

## 🔄 Recommended Development Workflow

### Phase 1: Planning (Documentation-First)

```markdown
## Feature: [Name]

### 1. Identify Dependencies
- External services: [list]
- Libraries: [list]

### 2. Fetch Documentation
- [Service 1]: [Library ID], Topics: [list]
- [Service 2]: [Library ID], Topics: [list]

### 3. Analyze Documentation
- API endpoints: [list]
- Required config: [list]
- Environment variables: [list]
- Example code: [paste relevant examples]

### 4. Implementation Plan
Based on docs:
1. [Step 1 with doc reference]
2. [Step 2 with doc reference]
3. [Step 3 with doc reference]
```

### Phase 2: Implementation

1. **Set up environment variables**
   - Add to `.env.example` with comments
   - Document setup in README
   - Test both Convex and Next.js environments

2. **Implement with logging**
   - Add logs at each step
   - Include context in log messages
   - Log both success and failure cases

3. **Error handling**
   - Specific error messages
   - Include service name and status
   - Capture and log original errors

### Phase 3: Documentation

1. **Create implementation doc**
   - Architecture explanation
   - Configuration requirements
   - Code examples
   - Troubleshooting guide

2. **Update README if needed**
   - Add new setup steps
   - Document new environment variables
   - Update feature list

### Phase 4: Testing

1. **Happy path**
   - Expected use case works

2. **Error cases**
   - Missing env vars
   - Network errors
   - Invalid input

3. **Edge cases**
   - Large files
   - Multiple items
   - Concurrent operations

---

## 📖 Documentation Templates

### Implementation Document Template

```markdown
# [Feature Name] Implementation

## Overview
[Brief description of feature]

## Architecture
[Diagram or explanation of how it works]

## Documentation Consulted
- [Service 1]: [topics researched]
- [Service 2]: [topics researched]

## Implementation Details

### Backend (Convex)
[Code and explanation]

### Frontend (React)
[Code and explanation]

## Environment Variables

### Convex (Cloud)
```bash
npx convex env set KEY value
```

### Next.js (.env.local)
```bash
KEY=value
NEXT_PUBLIC_KEY=value
```

## Testing

### Happy Path
[Steps to test]

### Error Cases
[Steps to test errors]

## Troubleshooting

### Error: [Description]
**Fix:** [Solution]

## References
- [Official docs link]
- [Related ChatKut docs]
```

---

## 🎓 Key Learnings Summary

### 1. Context7 is Your First Stop

**Before writing any integration code:**
- Resolve library ID
- Fetch documentation
- Read completely
- Base implementation on official examples

**Time Saved:** Hours of debugging

### 2. Understand WHERE Code Runs

- **Convex Backend:** Runs in cloud, needs `npx convex env set`
- **Next.js Server:** Runs locally, uses `.env.local`
- **Browser:** Needs `NEXT_PUBLIC_` prefix

**Critical for:** Environment variables, API calls, authentication

### 3. Complete Flow Understanding

Don't just implement one API call - understand:
- What happens before
- What happens after
- How responses are used
- What errors can occur

**Example:** Cloudflare Stream TUS upload
- Create upload session (POST)
- Upload chunks (PATCH)
- Capture stream-media-id header
- Update asset record
- Wait for webhook

### 4. Official Code Examples Are Gold

If docs include working code, use it as the starting point.

**Don't:**
- Guess configuration structure
- Assume parameter names
- Invent API endpoints

**Do:**
- Copy official examples
- Adapt to your use case
- Keep configuration patterns

### 5. Logging is Development Insurance

Detailed logs help you:
- Trace execution flow
- Identify failure points
- Debug environment issues
- Understand timing problems

**Pattern:**
```typescript
console.log("[Module:function] Action:", { context });
```

### 6. Environment Variables Have Two Homes

**Mistake:** Setting Convex env vars in `.env.local`
**Reality:** Convex ignores `.env.local` because it runs in the cloud

**Solution:** Always verify WHERE code executes before setting env vars

### 7. Error Messages Should Tell a Story

**Bad:**
```typescript
throw new Error("Failed");
```

**Good:**
```typescript
throw new Error(`Cloudflare Stream API error (${response.status}): ${await response.text()}`);
```

**Includes:**
- Service name
- HTTP status
- Original error message

### 8. Documentation After Implementation

Complex features need docs:
- Future you will thank you
- Other developers will thank you
- Troubleshooting becomes easier

**Created for ChatKut:**
- `CLOUDFLARE_STREAM_IMPLEMENTATION.md`
- `CONVEX_ENV_VARS.md`
- `DOCUMENTATION_LIBRARY.md`
- `DEVELOPMENT_WORKFLOW.md`

---

## 🚀 Quick Reference

### Starting a New Feature

1. **Identify services/libraries involved**
2. **Fetch documentation via Context7**
3. **Read and understand complete flow**
4. **Plan implementation based on docs**
5. **Implement with logging**
6. **Test thoroughly**
7. **Document if complex**

### Debugging an Issue

1. **Check console logs** (both browser and server)
2. **Verify environment variables** (correct location?)
3. **Compare with official docs** (what's different?)
4. **Test with minimal example** (isolate the problem)
5. **Document the fix** (help future developers)

### Before Committing Code

- [ ] Feature works as expected
- [ ] Environment variables documented
- [ ] Logs added for debugging
- [ ] Error messages are specific
- [ ] Tests pass
- [ ] Documentation updated if needed

---

## 📊 Impact Measurement

### Before These Standards

- **Cloudflare Stream Upload:** 3+ hours of iterative debugging
- **Multiple rounds of:** Change → Test → Error → Repeat
- **Created:** Temporary fixes, incomplete solutions

### After These Standards

- **Expected:** 15-30 minutes to implement correctly
- **Single round of:** Docs → Plan → Implement → Test → Complete
- **Creates:** Robust, well-documented, maintainable solutions

**ROI:** 10x improvement in implementation speed and quality

---

## 🎯 Success Metrics

### For Each Feature

- [ ] Documentation consulted before implementation
- [ ] No more than 1 round of iteration needed
- [ ] Environment variables properly documented
- [ ] Comprehensive logging added
- [ ] Implementation documented if complex
- [ ] Tests pass on first try
- [ ] No "it should work" statements - verified working

### For the Project

- Growing library of implementation docs
- Consistent code patterns
- Fewer "why doesn't this work" moments
- Faster onboarding for new developers
- Maintainable, well-understood codebase

---

## 📝 Next Steps

### Recommended Documentation to Create

1. **REMOTION_IMPLEMENTATION.md**
   - Player integration patterns
   - Lambda rendering setup
   - Cost tracking implementation

2. **DEDALUS_INTEGRATION.md**
   - Model routing strategy
   - Cost optimization techniques
   - MCP tool usage patterns

3. **CONVEX_PATTERNS.md**
   - Query vs Mutation vs Action patterns
   - Real-time subscription patterns
   - Schema design principles

4. **TESTING_STRATEGY.md**
   - Unit test patterns
   - Integration test patterns
   - E2E test patterns
   - Mocking strategies

---

## 🎓 Training for New Developers

### Required Reading

1. This document (`DEVELOPMENT_WORKFLOW.md`)
2. `CLAUDE.md` (Standing Orders section)
3. `DOCUMENTATION_LIBRARY.md`
4. Any feature-specific implementation docs

### First Task

Implement a simple feature using the workflow:
1. Read docs via Context7
2. Plan based on documentation
3. Implement with logging
4. Test thoroughly
5. Document the implementation

**Goal:** Learn the workflow before tackling complex features

---

## 🏆 The Golden Rules

1. **Read docs first, code second**
2. **Understand the flow, not just the API**
3. **Environment variables have two homes**
4. **Logs are your safety net**
5. **Error messages should tell a story**
6. **Test before declaring complete**
7. **Document complex implementations**
8. **Learn from every mistake**

---

**Remember:** The Cloudflare Stream implementation taught us that documentation-first development prevents hours of debugging. Apply these lessons to every feature going forward.
