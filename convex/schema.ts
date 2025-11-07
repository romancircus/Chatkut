import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table (managed by Convex Auth)
  users: defineTable({
    name: v.optional(v.string()),
    email: v.string(),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Projects table
  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_updated", ["updatedAt"]),

  // Compositions table (stores IR, code, and patches)
  compositions: defineTable({
    projectId: v.id("projects"),
    // Composition IR (stored as JSON)
    ir: v.object({
      id: v.string(),
      version: v.number(),
      metadata: v.object({
        width: v.number(),
        height: v.number(),
        fps: v.number(),
        durationInFrames: v.number(),
      }),
      elements: v.array(v.any()), // CompositionElement[]
      patches: v.array(v.any()), // Patch[]
    }),
    // Generated Remotion code
    code: v.string(),
    // Current version number
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_updated", ["updatedAt"]),

  // Assets table (metadata only, files stored in Cloudflare)
  assets: defineTable({
    projectId: v.id("projects"),
    // Cloudflare Stream ID (for videos)
    streamId: v.optional(v.string()),
    // Cloudflare R2 key (for images/MP4s)
    r2Key: v.optional(v.string()),
    // Asset type
    type: v.union(
      v.literal("video"),
      v.literal("audio"),
      v.literal("image"),
      v.literal("rendered")
    ),
    // Original filename
    filename: v.string(),
    // File size in bytes
    fileSize: v.optional(v.number()),
    // MIME type
    mimeType: v.optional(v.string()),
    // Status
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    // Playback URL (HLS for video, direct URL for images)
    playbackUrl: v.optional(v.string()),
    // Duration in seconds (for video/audio)
    duration: v.optional(v.number()),
    // Thumbnail URL
    thumbnailUrl: v.optional(v.string()),
    // Upload URL (TUS endpoint, temporary)
    uploadUrl: v.optional(v.string()),
    // Error message if status === "error"
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_stream_id", ["streamId"])
    .index("by_status", ["status"]),

  // Chat messages table
  chatMessages: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    // Role: user or assistant
    role: v.union(v.literal("user"), v.literal("assistant")),
    // Message content
    content: v.string(),
    // Optional: edit plan generated (for assistant messages)
    editPlan: v.optional(v.any()),
    // Optional: edit receipt (for assistant messages)
    receipt: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_timestamp", ["timestamp"]),

  // Render jobs table
  renderJobs: defineTable({
    compositionId: v.id("compositions"),
    userId: v.id("users"),
    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("rendering"),
      v.literal("complete"),
      v.literal("error")
    ),
    // Estimated cost (before render)
    estimatedCost: v.optional(v.number()),
    // Actual cost (after render)
    actualCost: v.optional(v.number()),
    // Estimated time (seconds)
    estimatedTime: v.optional(v.number()),
    // Actual render time (seconds)
    renderTime: v.optional(v.number()),
    // Remotion Lambda render ID
    renderId: v.optional(v.string()),
    // Output URL (Cloudflare R2)
    outputUrl: v.optional(v.string()),
    // Error message if status === "error"
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_composition", ["compositionId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // MCP usage table (for billing and rate limiting)
  mcpUsage: defineTable({
    userId: v.id("users"),
    toolName: v.string(),
    // Tool parameters (sanitized)
    parameters: v.optional(v.any()),
    // Cost (if applicable)
    cost: v.optional(v.number()),
    // Success or error
    status: v.union(v.literal("success"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user_and_timestamp", ["userId", "timestamp"]),

  // Subscriptions table
  subscriptions: defineTable({
    userId: v.id("users"),
    // Tier: free, pro, team
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
    // Valid until timestamp
    validUntil: v.number(),
    // Stripe subscription ID
    stripeSubscriptionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Organizations table (for license compliance)
  organizations: defineTable({
    name: v.string(),
    // Owner user ID
    ownerId: v.id("users"),
    // Member count (for Remotion license compliance)
    memberCount: v.number(),
    // Has Remotion company license
    hasCompanyLicense: v.boolean(),
    // License valid until
    licenseValidUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Organization members table
  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"]),
});
