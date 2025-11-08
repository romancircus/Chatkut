# ChatKut Development - Standing Orders

**Last Updated:** January 7, 2025

These are mandatory practices for all future development work on ChatKut.

---

## 1. Always Check TypeScript Before Committing

### Mandatory Pre-Deployment Check

**BEFORE** any git commit or Convex deployment:

```bash
npx tsc --noEmit
```

**If errors exist:**
1. Fix ALL errors immediately
2. Re-run type check
3. Only proceed when `tsc` shows 0 errors

**Common Fixes:**
- Add `: any` to callback parameters in `.map()`, `.filter()`, `.find()`
- Add `: Promise<any>` to Convex action handlers
- Add type annotations to variables in Convex actions
- Verify query parameter names match function definitions

---

## 2. Always Consult MCP Documentation

### BEFORE Writing Code

**For Next.js features:**
```typescript
// 1. Use nextjs_docs MCP
mcp__next-devtools__nextjs_docs({ action: "search", query: "your topic" })

// 2. Read full documentation
mcp__next-devtools__nextjs_docs({ action: "get", path: "/docs/..." })
```

**For Convex features:**
```typescript
// Check Convex MCP for schema, queries, mutations
mcp__convex__tables({ deploymentSelector: "..." })
mcp__convex__functionSpec({ deploymentSelector: "..." })
```

**For External Libraries:**
```typescript
// 1. Resolve library ID
mcp__context7__resolve-library-id({ libraryName: "remotion" })

// 2. Get documentation
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/remotion/remotion",
  topic: "your topic"
})
```

### Priority Order for Documentation

1. **MCP Tools First** - Always check MCP documentation before guessing
2. **Official Docs Second** - If MCP doesn't have it, check official docs
3. **Implementation Last** - Only implement after verifying approach

---

## 3. TypeScript Error Prevention Patterns

### Pattern 1: Callback Parameters

**❌ WRONG:**
```typescript
projects.map((project) => ...)
items.filter((item) => ...)
```

**✅ CORRECT:**
```typescript
projects.map((project: any) => ...)
// or better with proper type:
projects.map((project: Doc<"projects">) => ...)
```

### Pattern 2: Convex Action Handlers

**❌ WRONG:**
```typescript
export const myAction = action({
  handler: async (ctx, args) => {
    const result = await ctx.runQuery(...);
    return result;
  }
});
```

**✅ CORRECT:**
```typescript
export const myAction = action({
  handler: async (ctx, args): Promise<any> => {
    const result: any = await ctx.runQuery(...);
    return result;
  }
});
```

### Pattern 3: Variable Type Annotations

**❌ WRONG:**
```typescript
const userId = "temp_user_1" as any;
const composition = await ctx.runQuery(...);
const durationInSeconds = metadata.durationInFrames / metadata.fps;
```

**✅ CORRECT:**
```typescript
const userId: any = "temp_user_1";
const composition: any = await ctx.runQuery(...);
const durationInSeconds: number = metadata.durationInFrames / metadata.fps;
```

### Pattern 4: Query Parameter Names

**❌ WRONG:**
```typescript
// Function expects compositionId
const renderJobs = useQuery(api.rendering.listRenderJobs, {
  projectId,  // ❌ WRONG parameter name
  limit: 5
});
```

**✅ CORRECT:**
```typescript
// Check function signature first!
const renderJobs = useQuery(api.rendering.listRenderJobs, {
  compositionId,  // ✅ CORRECT parameter name
  limit: 5
});
```

---

## 4. Convex Development Rules

### Rule 1: Always Check Function Signatures

Before calling ANY Convex function:

```bash
# Check what parameters it expects
grep -A10 "export const functionName" convex/file.ts
```

### Rule 2: Schema Index Names

**CRITICAL:** Only use indexes that exist in schema

```typescript
// ❌ WRONG - "by_project" doesn't exist
.withIndex("by_project", (q) => ...)

// ✅ CORRECT - Check schema first
.withIndex("by_composition", (q) => ...)
```

**How to verify:**
```bash
grep "index(" convex/schema.ts
```

### Rule 3: Return Types for Actions

**All Convex actions MUST have explicit return types:**

```typescript
export const myAction = action({
  args: { ... },
  handler: async (ctx, args): Promise<ReturnType> => {
    // Implementation
  }
});
```

### Rule 4: Null Checks

**Always handle undefined/null from queries:**

```typescript
const composition = await ctx.runQuery(...);
if (!composition) {
  throw new Error("Not found");
}
// Now safe to use composition
```

---

## 5. Testing Before Handoff

### Mandatory Testing Sequence

**BEFORE saying "done" to user:**

1. **Type Check**
   ```bash
   npx tsc --noEmit
   ```

2. **Build Check**
   ```bash
   npm run build
   ```

3. **Convex Deploy (if backend changes)**
   ```bash
   npx convex deploy
   ```

4. **Manual Test** (start servers and test)
   ```bash
   # Terminal 1
   npx convex dev

   # Terminal 2
   npm run dev

   # Open browser: http://localhost:3001
   # Test the specific workflow you changed
   ```

5. **Playwright Test** (if tests exist)
   ```bash
   npm test
   ```

### Core Flows to Always Test

1. **Project Creation**
   - Create new project
   - Verify navigation to dashboard
   - Check for console errors

2. **Basic UI**
   - All panels load
   - No visual glitches
   - Buttons work

---

## 6. Documentation Standards

### When Creating/Modifying Features

**ALWAYS create/update:**

1. **Code Comments**
   ```typescript
   /**
    * Description of what this does
    *
    * @param paramName - What this parameter is for
    * @returns What this returns
    */
   ```

2. **README Updates**
   - If adding new npm scripts
   - If changing environment variables
   - If adding new dependencies

3. **Error Documentation**
   - If you fix an error, document the fix
   - Add to `TYPESCRIPT_FIXES.md` or similar
   - Include pattern to prevent recurrence

---

## 7. Common Mistake Prevention

### Mistake 1: Writing Tests Without Running Them

**❌ WRONG Approach:**
- Write Playwright tests
- Commit without running
- Tests fail when user tries

**✅ CORRECT Approach:**
- Write Playwright tests
- Run: `npx playwright test`
- Fix failures
- Commit only when passing

### Mistake 2: Assuming Code Works

**❌ WRONG Approach:**
- Fix TypeScript errors
- Assume everything works
- Don't test manually

**✅ CORRECT Approach:**
- Fix TypeScript errors
- Start servers
- Test the actual workflow
- Verify in browser

### Mistake 3: Ignoring Convex Deployment

**❌ WRONG Approach:**
- Fix Convex backend code
- Don't redeploy
- Frontend fails because backend not updated

**✅ CORRECT Approach:**
- Fix Convex backend code
- Run: `npx convex deploy`
- Restart `npx convex dev`
- Verify functions available

---

## 8. MCP Usage Requirements

### MANDATORY MCP Checks

**For Next.js Code:**
- Before using App Router features → Check nextjs_docs
- Before using Server Components → Check nextjs_docs
- Before using Metadata → Check nextjs_docs

**For Convex Code:**
- Before creating queries → Check convex MCP
- Before creating mutations → Check convex MCP
- Before using indexes → Check schema via MCP

**For External Libraries:**
- Before using Remotion features → Check context7
- Before using HLS.js → Check context7
- Before using TUS client → Check context7

### MCP Call Pattern

```typescript
// 1. Search for topic
const docs = await mcp_tool({ action: "search", query: "topic" });

// 2. Read specific docs
const fullDocs = await mcp_tool({ action: "get", path: "/docs/..." });

// 3. Implement based on docs (not memory)
```

---

## 9. Error Handling Standards

### All Async Operations Need Error Handling

**❌ WRONG:**
```typescript
const result = await fetchData();
```

**✅ CORRECT:**
```typescript
try {
  const result = await fetchData();
} catch (error) {
  console.error("Failed to fetch:", error);
  // Handle error appropriately
}
```

### Convex Actions Need Error Messages

**❌ WRONG:**
```typescript
if (!composition) {
  throw new Error("Error");
}
```

**✅ CORRECT:**
```typescript
if (!composition) {
  throw new Error(`Composition ${compositionId} not found`);
}
```

---

## 10. Code Review Checklist

### Before Considering Code "Done"

- [ ] TypeScript: `npx tsc --noEmit` shows 0 errors
- [ ] Build: `npm run build` succeeds
- [ ] Lint: `npm run lint` passes
- [ ] MCP: Consulted relevant MCP documentation
- [ ] Convex: Deployed if backend changed
- [ ] Manual Test: Tested in browser
- [ ] Console: No errors in browser console
- [ ] Documentation: Updated relevant docs
- [ ] Tests: Playwright tests pass (if exist)
- [ ] Git: Clean working directory

### ONLY THEN say "done" to user

---

## 11. Dependency Management

### Before Adding Dependencies

1. **Check if already exists**
   ```bash
   grep "package-name" package.json
   ```

2. **Consult MCP for alternatives**
   ```typescript
   // Check if simpler solution exists
   mcp__context7__resolve-library-id({ libraryName: "package-name" })
   ```

3. **Check bundle size**
   - Prefer smaller packages
   - Check https://bundlephobia.com

4. **Verify TypeScript support**
   - Check for `@types/package-name`
   - Or built-in TypeScript

---

## 12. Performance Considerations

### Always Consider

1. **Bundle Size**
   - Import only what you need
   - Use dynamic imports for heavy components

2. **Query Optimization**
   - Limit query results (e.g., `limit: 20`)
   - Use pagination for large datasets

3. **Memoization**
   - Use `useMemo` for expensive calculations
   - Use `useCallback` for event handlers

---

## 13. Security Practices

### Never Commit

- API keys
- Secrets
- Private keys
- `.env.local` file

### Always Use

- Environment variables for secrets
- `.env.example` for documentation
- Type-safe environment variable access

---

## 14. Git Practices

### Commit Messages

**Format:**
```
<type>: <description>

[optional body]
```

**Types:**
- `fix:` Bug fixes
- `feat:` New features
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

**Examples:**
```
fix: resolve TypeScript errors in rendering panel

Added explicit type annotations to all callback parameters
and Convex action handlers to fix TS7006 and TS7022 errors.
```

---

## 15. Communication Standards

### When Reporting "Done"

Include:
1. What was fixed/implemented
2. How it was tested
3. Any remaining known issues
4. Next steps (if any)

### When Asking for Help

Include:
1. What you tried
2. Error messages (full text)
3. Relevant code snippets
4. MCP docs consulted

---

## Quick Reference

### Pre-Commit Checklist
```bash
npx tsc --noEmit        # Must show 0 errors
npm run build           # Must succeed
npm run lint            # Must pass
git status              # Check what's changed
```

### Development Server Check
```bash
npx convex dev          # Terminal 1
npm run dev             # Terminal 2
# Open http://localhost:3001 and test
```

### Common Commands
```bash
# Type check
npx tsc --noEmit

# Find function definition
grep -A5 "export const functionName" convex/**/*.ts

# Check schema indexes
grep "index(" convex/schema.ts

# Run tests
npm test
npx playwright test --ui
```

---

## Enforcement

**These are STANDING ORDERS, not suggestions.**

Every development session should:
1. Start with MCP documentation review
2. Include type checking throughout
3. End with manual testing
4. Result in zero TypeScript errors

**No exceptions.**

---

Last updated: January 7, 2025
