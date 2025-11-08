# Convex Implementation Guide

**Created:** 2025-11-08
**Source:** Context7 `/llmstxt/convex_dev_llms-full_txt`
**Purpose:** Complete reference for Convex backend implementation

---

## Core Concepts

### Queries (Read-Only)

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getAllTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_completed", (q) => q.eq("completed", false))
      .collect();
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user; // Type-safe: Doc<"users"> | undefined
  },
});
```

### Mutations (Read + Write)

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createTask = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      text: args.text,
      completed: false,
    });
    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    completed: v.boolean(),
  },
  handler: async (ctx, { taskId, completed }) => {
    await ctx.db.patch(taskId, { completed });
  },
});
```

### Actions (External API Calls)

```typescript
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const fetchWikipedia = action({
  args: { topic: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${args.topic}`
    );
    const summary = await response.json();

    // Schedule a mutation to save the result
    await ctx.scheduler.runAfter(0, internal.messages.saveSummary, {
      topic: args.topic,
      summary: summary.query.pages[0].extract,
    });
  },
});

// Node.js runtime for specific packages
"use node";

import { action } from "./_generated/server";
import SomeNpmPackage from "some-npm-package";

export const nodeAction = action({
  args: {},
  handler: async (ctx) => {
    // Use Node.js-specific packages
  },
});
```

---

## HTTP Actions

### POST Handler

```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/postMessage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { author, body } = await request.json();

    await ctx.runMutation(internal.messages.sendOne, {
      body: `Sent via HTTP action: ${body}`,
      author,
    });

    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
        "Vary": "origin",
      },
    });
  }),
});

export default http;
```

### File Upload Handler

```typescript
http.route({
  path: "/sendImage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1. Store the file
    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    // 2. Save to database via mutation
    const author = new URL(request.url).searchParams.get("author");
    await ctx.runMutation(api.messages.sendImage, { storageId, author });

    // 3. Return response
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
        "Vary": "origin",
      },
    });
  }),
});
```

---

## Environment Variables

### CRITICAL: Convex Cloud vs Next.js

**Convex Backend (Cloud):**
```bash
# Set via CLI (runs in Convex's cloud)
npx convex env set OPENAI_KEY "your-key"
npx convex env set CLOUDFLARE_ACCOUNT_ID "your-id"

# List all environment variables
npx convex env list

# Get specific variable
npx convex env get OPENAI_KEY
```

**Next.js Frontend/SSR:**
```bash
# .env.local (runs in Next.js)
NEXT_PUBLIC_CONVEX_URL="https://happy-animal-123.convex.cloud"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Browser variables need NEXT_PUBLIC_ prefix
# Server-side variables don't need prefix
```

**Key Rule:**
- `.env.local` is IGNORED by Convex cloud functions
- Use `npx convex env set` for Convex backend variables
- Use `.env.local` for Next.js variables

---

## Authentication

### With Clerk

**Server-Side Mutation:**
```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const sendMessage = mutation({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.insert("messages", { body: args.body, user: user._id });
  },
});
```

**User Sync (Clerk Webhooks):**
```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occurred", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case "user.deleted":
        await ctx.runMutation(internal.users.deleteFromClerk, {
          clerkUserId: event.data.id!,
        });
        break;
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook", error);
    return null;
  }
}

export default http;
```

**Upsert User Mutation:**
```typescript
import { internalMutation, query } from "./_generated/server";
import { UserJSON } from "@clerk/backend";
import { v } from "convex/values";

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> },
  handler: async (ctx, { data }) => {
    const userAttributes = {
      name: `${data.first_name} ${data.last_name}`,
      externalId: data.id,
    };

    const user = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", data.id))
      .unique();

    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});
```

---

## Cron Jobs

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "Clear presence data",
  { seconds: 30 },
  internal.presence.clear
);

crons.hourly(
  "Reset high scores",
  { minuteUTC: 30 },
  internal.scores.reset
);

export default crons;
```

---

## Scheduling Functions

```typescript
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const scheduleAction = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const taskId = await ctx.db.insert("tasks", { text });

    // Schedule action to run immediately
    await ctx.scheduler.runAfter(0, internal.myFunctions.processTask, {
      taskId,
      text,
    });

    // Schedule action to run in 1 hour
    await ctx.scheduler.runAfter(3600000, internal.myFunctions.sendReminder, {
      taskId,
    });
  },
});
```

---

## Client Usage

### React

```typescript
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "./convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function App() {
  return (
    <ConvexProvider client={convex}>
      <TaskList />
    </ConvexProvider>
  );
}

function TaskList() {
  const tasks = useQuery(api.tasks.getAllTasks);
  const createTask = useMutation(api.tasks.createTask);

  return (
    <div>
      {tasks?.map((task) => (
        <div key={task._id}>{task.text}</div>
      ))}
      <button onClick={() => createTask({ text: "New task" })}>
        Add Task
      </button>
    </div>
  );
}
```

### HTTP Client (One-Off Calls)

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

// Query
const messages = await client.query(api.messages.list);

// Mutation
await client.mutation(api.messages.send, { body: "Hello" });
```

### Subscription Client (Real-Time)

```typescript
import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexClient(process.env.CONVEX_URL!);

// Subscribe to query results
const unsubscribe = client.onUpdate(
  api.messages.list,
  {},
  (messages) => console.log(messages)
);

// Execute mutation
client.mutation(api.messages.send, { body: "Hello" });

// Clean up
unsubscribe();
```

---

## Context Services

### QueryCtx

```typescript
interface QueryCtx {
  db: DatabaseReader;            // Read-only database access
  auth: Auth;                    // User authentication
  storage: StorageReader;        // File storage (read-only)
  runQuery: (query, args) => Promise<any>; // Call other queries
}
```

### MutationCtx

```typescript
interface MutationCtx {
  db: DatabaseWriter;            // Read + write database access
  auth: Auth;                    // User authentication
  storage: StorageWriter;        // File storage (read + write)
  scheduler: Scheduler;          // Schedule future functions
}
```

### ActionCtx

```typescript
interface ActionCtx {
  runQuery: (name, args) => Promise<any>;    // Call queries
  runMutation: (name, args) => Promise<any>; // Call mutations
  runAction: (name, args) => Promise<any>;   // Call other actions
  auth: Auth;                                // User authentication
  scheduler: Scheduler;                      // Schedule functions
  storage: StorageActionWriter;              // File storage
  vectorSearch: (...) => Promise<any>;       // Vector search
}
```

---

## Custom Functions (Middleware Pattern)

### API Key Validation

```typescript
import { customMutation } from "convex-helpers/server/customFunctions";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

const apiMutation = customMutation(mutation, {
  args: { apiKey: v.string() },
  input: async (ctx, { apiKey }) => {
    if (apiKey !== process.env.API_KEY) {
      throw new Error("Invalid API key");
    }
    return { ctx: {}, args: {} };
  },
});

export const doSomething = apiMutation({
  args: { someArg: v.number() },
  handler: async (ctx, args) => {
    // API key validated before this runs
  },
});
```

### Session Management

```typescript
const sessionMutation = customMutation(mutation, {
  args: { sessionId: v.id("sessions") },
  input: async (ctx, { sessionId }) => {
    const user = await getUser(ctx);
    if (!user) throw new Error("Authentication required");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    return {
      ctx: { user, session },
      args: {},
    };
  },
});

export const checkout = sessionMutation({
  handler: async (ctx, args) => {
    const { user, session } = ctx;
    // User and session available
  },
});
```

---

## Database Triggers

```typescript
import { Triggers } from "convex-helpers/server/triggers";
import { customMutation } from "convex-helpers/server/customFunctions";
import { mutation as rawMutation } from "./_generated/server";
import { DataModel } from "./_generated/dataModel";

const triggers = new Triggers<DataModel>();

// Register trigger for 'users' table
triggers.register("users", async (ctx, change) => {
  console.log("User changed:", change);

  if (change.operation === "insert") {
    // Send welcome email
  }
});

// Wrap mutations to run triggers
export const mutation = customMutation(
  rawMutation,
  customCtx(triggers.wrapDB)
);
```

---

## File Storage

### Upload

```typescript
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Client-side
const uploadUrl = await convex.mutation(api.files.generateUploadUrl);
const result = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": file.type },
  body: file,
});
const { storageId } = await result.json();
```

### Store & Retrieve

```typescript
// Store file
export const storeFile = mutation({
  args: { storageId: v.id("_storage"), filename: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("files", {
      storageId: args.storageId,
      filename: args.filename,
    });
  },
});

// Get file URL
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

---

## HTTP API

### Calling Functions via HTTP

```bash
# Query
curl -X POST https://your-deployment.convex.cloud/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "path": "messages:list",
    "args": {},
    "format": "json"
  }'

# Mutation
curl -X POST https://your-deployment.convex.cloud/api/mutation \
  -H "Content-Type: application/json" \
  -d '{
    "path": "messages:send",
    "args": { "body": "Hello" },
    "format": "json"
  }'
```

**Response:**
```json
{
  "status": "success",
  "value": {},
  "logLines": []
}
```

---

## Error Handling

### Try-Catch in Mutations

```typescript
export const tryUpdate = mutation({
  handler: async (ctx, { id, body }) => {
    try {
      await ctx.db.patch(id, { body });
    } catch (e) {
      console.error("Failed to update:", e);
      // IMPORTANT: If you don't re-throw, the mutation WILL commit
      throw e; // Re-throw to rollback
    }
  },
});
```

---

## Testing

```typescript
import { convexTest } from "convex-test";
import { test, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

test("create and retrieve task", async () => {
  const t = convexTest(schema);

  const taskId = await t.mutation(api.tasks.createTask, { text: "Test task" });
  const tasks = await t.query(api.tasks.getAllTasks);

  expect(tasks).toHaveLength(1);
  expect(tasks[0]._id).toBe(taskId);
});
```

---

## Best Practices

1. **Use Mutations for Scheduling Actions:**
   ```typescript
   // ❌ DON'T: Call actions directly from client
   client.action(api.actions.expensiveTask);

   // ✅ DO: Call mutation that schedules action
   client.mutation(api.mutations.scheduleExpensiveTask);
   ```

2. **Environment Variables:**
   - Convex cloud: `npx convex env set KEY value`
   - Next.js: `.env.local`
   - Never commit `.env.local` or secrets

3. **Authentication:**
   - Always check `ctx.auth.getUserIdentity()` in mutations
   - Use database triggers for user sync (Clerk/Auth0)

4. **Error Handling:**
   - Always re-throw errors in try-catch to rollback mutations
   - Use specific error messages for debugging

5. **File Uploads:**
   - NEVER upload files through Convex (20MB limit)
   - Use Cloudflare Stream/R2 for media
   - Only store metadata in Convex

---

## Common Patterns

### Pagination

```typescript
export const listMessages = query({
  args: { cursor: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, { cursor, limit }) => {
    const messages = await ctx.db
      .query("messages")
      .order("desc")
      .paginate({ cursor, numItems: limit });

    return messages;
  },
});
```

### Batch Operations

```typescript
export const batchInsert = mutation({
  args: { items: v.array(v.object({ text: v.string() })) },
  handler: async (ctx, { items }) => {
    const ids = await Promise.all(
      items.map((item) => ctx.db.insert("tasks", item))
    );
    return ids;
  },
});
```

---

## References

- [Convex Docs](https://docs.convex.dev)
- [HTTP API](https://docs.convex.dev/http-api)
- [Authentication](https://docs.convex.dev/auth)
- [File Storage](https://docs.convex.dev/file-storage)
- [Convex Helpers](https://github.com/get-convex/convex-helpers)
