# ChatKut Documentation Library

## Essential Documentation to Reference via Context7

This document catalogs all core documentation that should be consulted before implementing features in ChatKut.

---

## 🔴 Critical (Must Read Before Implementation)

### Cloudflare Stream
**Library ID:** `/llmstxt/developers_cloudflare_com-stream-llms-full.txt`
**Code Snippets:** 4,128
**Trust Score:** 8

**Topics to Search:**
- TUS upload protocol
- Direct creator uploads
- Video webhooks and processing
- HLS streaming
- Signed URLs and security
- Watermarks and captions

**Example Query:**
```typescript
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/llmstxt/developers_cloudflare_com-stream-llms-full.txt",
  topic: "TUS upload API webhooks video processing",
  tokens: 10000
})
```

---

### Cloudflare R2
**Library ID:** `/llmstxt/developers_cloudflare_r2_llms-full_txt`
**Code Snippets:** 4,729
**Trust Score:** 8

**Topics to Search:**
- Presigned URLs
- Public buckets
- S3-compatible API
- CORS configuration
- Object metadata

**Use For:**
- Image uploads
- Rendered video storage
- Asset management

---

### Convex
**Search:** "convex" (multiple options available)

**Recommended:**
- Convex real-time database
- Convex serverless functions
- Convex authentication
- Convex file storage

**Topics to Search:**
- Queries vs Mutations vs Actions
- Real-time subscriptions
- Indexes and performance
- Environment variables
- Schema validation
- Authentication integration

**Critical Note:** Convex runs in the cloud, NOT locally!

---

### Remotion
**Search:** "remotion"

**Topics to Search:**
- Player API
- Lambda rendering
- Dynamic compositions
- Audio/video sync
- Performance optimization
- Bundle size optimization

**Use For:**
- Video composition rendering
- Preview player integration
- Cloud rendering setup
- Cost estimation

---

## 🟡 Important (Reference When Needed)

### Next.js (Built-in MCP)
**MCP Tool:** `nextjs_docs`

**Topics:**
- App Router
- Server Components
- Route Handlers
- Environment variables
- Image optimization
- Font optimization

**How to Use:**
```typescript
mcp__next-devtools__nextjs_docs({
  action: "search",
  query: "server actions",
  routerType: "app"
})
```

---

### TUS Protocol
**Search:** "tus"

**Topics to Search:**
- Resumable uploads
- Client configuration
- Error handling
- Progress tracking
- Chunking strategies

**Use For:**
- Large file uploads
- Upload resumption
- Progress indicators

---

### React (General)
**Search:** "react"

**Topics:**
- Hooks (useState, useEffect, useCallback)
- Context API
- Performance optimization
- Concurrent features

---

### TypeScript
**Search:** "typescript"

**Topics:**
- Type inference
- Generics
- Utility types
- Module resolution

---

## 🟢 Optional (As Needed)

### Dedalus AI
**Search:** "dedalus"

**Topics:**
- Multi-model routing
- MCP integration
- Cost optimization
- Token usage tracking

---

### Tailwind CSS
**Search:** "tailwind css"

**Topics:**
- Design system
- Custom configuration
- Dark mode
- Responsive design

---

### Playwright
**Search:** "playwright"

**Topics:**
- E2E testing
- Browser automation
- Test fixtures
- Page object model

---

## How to Ingest Documentation

### Step 1: Resolve Library ID

```typescript
const result = await mcp__context7__resolve-library-id({
  libraryName: "cloudflare stream"
});

// Returns library ID like:
// /llmstxt/developers_cloudflare_com-stream-llms-full.txt
```

### Step 2: Get Documentation

```typescript
const docs = await mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/llmstxt/developers_cloudflare_com-stream-llms-full.txt",
  topic: "specific feature or API you're implementing",
  tokens: 10000 // Adjust based on complexity
});
```

### Step 3: Analyze Before Implementing

1. Read the documentation thoroughly
2. Study code examples provided
3. Identify required configuration
4. Note environment variables needed
5. Understand error handling patterns
6. Check for rate limits or quotas

---

## Pre-Implementation Checklist

Before writing code for any feature:

- [ ] Identified which external services/libraries are involved
- [ ] Resolved Context7 library IDs for all services
- [ ] Fetched documentation with relevant topic keywords
- [ ] Read and understood the complete workflow
- [ ] Identified all required configuration parameters
- [ ] Noted environment variables needed
- [ ] Reviewed official code examples
- [ ] Understood expected response formats
- [ ] Identified potential error cases
- [ ] Planned logging strategy

---

## Documentation Patterns We Learned

### Pattern 1: Configuration Objects

Official docs show EXACT configuration structure:

```typescript
// ✅ From docs
const upload = new tus.Upload(file, {
  endpoint: tusEndpoint,
  headers: { Authorization: `Bearer ${token}` },
  chunkSize: 50 * 1024 * 1024,
  metadata: { name: filename },
  uploadSize: file.size,
});

// ❌ Guessed configuration (led to hours of debugging)
const upload = new tus.Upload(file, {
  uploadUrl: someUrl,
  metadata: { filename: filename },
});
```

### Pattern 2: Required vs Optional

Docs explicitly state what's required:

- Required: Authorization header, chunk size ≥ 5 MB
- Optional: allowedOrigins, requireSignedURLs

### Pattern 3: Response Headers

Docs document special response headers:

- `stream-media-id`: Video ID (Cloudflare-specific)
- `Location`: Upload URL for PATCH requests
- `Upload-Offset`: Current upload progress

### Pattern 4: Environment Setup

Docs explain where configuration comes from:

- Account ID from dashboard
- API tokens from API section
- Endpoint URLs are documented (not discovered)

---

## Integration-Specific Documentation

### Cloudflare Stream + Next.js

**Must Read:**
1. Cloudflare Stream TUS uploads
2. Next.js environment variables
3. CORS configuration for browser uploads

**Key Insight:** Frontend needs `NEXT_PUBLIC_` prefix for browser-accessible tokens

---

### Convex + Next.js

**Must Read:**
1. Convex environment variables (CLI-based)
2. Convex queries vs mutations vs actions
3. Next.js server vs client components

**Key Insight:** Convex backend runs in cloud, not locally!

---

### Remotion + Next.js

**Must Read:**
1. Remotion Player integration
2. Remotion Lambda setup
3. Next.js bundle optimization

**Key Insight:** Remotion bundles need special webpack config

---

## Lessons Learned

### Cloudflare Stream Implementation

**What We Did Wrong:**
- Assumed Direct Upload API was for TUS (it's not)
- Used `uploadUrl` instead of `endpoint` in TUS config
- Forgot Authorization headers
- Used wrong metadata field names
- Didn't capture `stream-media-id` header

**How Docs Would Have Prevented This:**
- Official code examples showed exact TUS configuration
- Documentation explicitly listed required headers
- Examples demonstrated header parsing for stream-media-id
- Metadata schema was documented

**Time Wasted:** ~3 hours of iterative debugging
**Time with Docs First:** ~15 minutes to implement correctly

---

## Documentation Workflow (Template)

```markdown
# Feature: [Feature Name]

## Documentation Consulted

1. [Library Name] - [Library ID]
   - Topics: [list of relevant topics]
   - Key learnings: [bullet points]

2. [Library Name] - [Library ID]
   - Topics: [list of relevant topics]
   - Key learnings: [bullet points]

## Implementation Plan

Based on documentation:
1. [Step 1 with reference to docs]
2. [Step 2 with reference to docs]
3. [Step 3 with reference to docs]

## Configuration Required

- Environment variables: [list]
- API endpoints: [list]
- Required headers: [list]
- Optional parameters: [list]

## Testing Strategy

- [ ] Happy path test case
- [ ] Error case: [specific error]
- [ ] Edge case: [specific edge case]

## References

- [Link to official docs]
- [Link to code examples]
- [Link to related ChatKut implementation docs]
```

---

## Recommended Documentation Additions

### To Add to Repo:

1. **REMOTION_IMPLEMENTATION.md**
   - Player integration
   - Lambda setup
   - Cost tracking
   - Bundle optimization

2. **DEDALUS_INTEGRATION.md**
   - Model routing strategy
   - Cost optimization
   - MCP tool usage
   - Error handling

3. **CONVEX_PATTERNS.md**
   - Query patterns
   - Mutation patterns
   - Action patterns
   - Real-time subscriptions
   - Schema design

4. **TESTING_STRATEGY.md**
   - Unit test patterns
   - Integration test patterns
   - E2E test patterns
   - Mock strategies

---

## Context7 Best Practices

### 1. Use Specific Topics

**Good:**
```typescript
topic: "TUS upload resumable authentication headers"
```

**Bad:**
```typescript
topic: "upload"
```

### 2. Request Adequate Tokens

- Simple API: 2,000-5,000 tokens
- Complex integration: 10,000-15,000 tokens
- Comprehensive guide: 20,000+ tokens

### 3. Multiple Queries for Complex Features

Don't try to get everything in one query:

```typescript
// Query 1: Setup and configuration
topic: "TUS upload setup configuration headers"

// Query 2: Error handling
topic: "TUS upload error handling retry logic"

// Query 3: Progress tracking
topic: "TUS upload progress callbacks streaming"
```

### 4. Trust Code Examples Over Text

If docs include working code examples, use them as the starting point.

---

## Summary

**Golden Rule:** When implementing ANY feature that involves external services or libraries, ALWAYS fetch and read the official documentation via Context7 FIRST. This prevents hours of iterative debugging and ensures implementations follow best practices from the start.
