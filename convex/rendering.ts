/**
 * Rendering Management
 *
 * Handles video rendering jobs using Remotion Lambda.
 * Tracks render progress, costs, and output files.
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

/**
 * Start a new render job
 */
export const startRender = action({
  args: {
    compositionId: v.id("compositions"),
    codec: v.optional(v.string()),
    quality: v.optional(v.number()),
  },
  handler: async (ctx, { compositionId, codec, quality }): Promise<any> => {
    // TODO: Add authentication when ready
    // For now, use temporary user ID
    const userId: any = "temp_user_1";

    // Get composition
    const composition: any = await ctx.runQuery(api.compositions.get, { compositionId });

    if (!composition) {
      throw new Error("Composition not found");
    }

    // In production, this would call Remotion Lambda
    // For now, create a mock render job
    const renderId: string = `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save render job
    const renderJobId: any = await ctx.runMutation(api.rendering.createRenderJob, {
      compositionId,
      userId,
      renderId,
      status: "pending",
      estimatedCost: 0.15, // Mock cost
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Start render (would call Remotion Lambda here)
    // In production: call Remotion Lambda API

    return {
      renderJobId,
      renderId,
      status: "pending",
    };
  },
});

/**
 * Get render job status
 */
export const getRenderStatus = query({
  args: {
    renderJobId: v.id("renderJobs"),
  },
  handler: async (ctx, { renderJobId }) => {
    const renderJob = await ctx.db.get(renderJobId);
    if (!renderJob) {
      throw new Error("Render job not found");
    }

    return renderJob;
  },
});

/**
 * Update render job progress
 */
export const updateRenderProgress = mutation({
  args: {
    renderJobId: v.id("renderJobs"),
    progress: v.number(),
    status: v.optional(v.string()),
    outputUrl: v.optional(v.string()),
    actualCost: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { renderJobId, ...updates } = args;

    const renderJob = await ctx.db.get(renderJobId);
    if (!renderJob) {
      throw new Error("Render job not found");
    }

    await ctx.db.patch(renderJobId, {
      ...updates,
      updatedAt: Date.now(),
      completedAt:
        updates.status === "completed" || updates.status === "error"
          ? Date.now()
          : undefined,
    } as any);
  },
});

/**
 * List render jobs for a composition
 */
export const listRenderJobs = query({
  args: {
    compositionId: v.id("compositions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { compositionId, limit = 20 }) => {
    return await ctx.db
      .query("renderJobs")
      .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
      .order("desc")
      .take(limit);
  },
});

/**
 * List all render jobs for user
 */
export const listUserRenderJobs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50 }) => {
    // TODO: Re-enable authentication after testing
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   return [];
    // }
    // const userId = identity.subject as any;
    const userId = "temp_user_1" as any; // Temporary for testing

    return await ctx.db
      .query("renderJobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Cancel a render job
 */
export const cancelRender = action({
  args: {
    renderJobId: v.id("renderJobs"),
  },
  handler: async (ctx, { renderJobId }) => {
    const renderJob = await ctx.runQuery(api.rendering.getRenderStatus, {
      renderJobId,
    });

    if (!renderJob) {
      throw new Error("Render job not found");
    }

    if (renderJob.status === "complete" || renderJob.status === "error") {
      throw new Error("Cannot cancel completed or failed render");
    }

    // Cancel on Remotion Lambda
    // await cancelRemotionRender(renderJob.renderId);

    // Update status
    await ctx.runMutation(api.rendering.updateRenderProgress, {
      renderJobId,
      progress: 0,
      status: "error",
      error: "Cancelled by user",
    });

    return {
      cancelled: true,
    };
  },
});

/**
 * Delete a render job
 */
export const deleteRenderJob = mutation({
  args: {
    renderJobId: v.id("renderJobs"),
  },
  handler: async (ctx, { renderJobId }) => {
    const renderJob = await ctx.db.get(renderJobId);
    if (!renderJob) {
      throw new Error("Render job not found");
    }

    // TODO: Delete output file from storage

    await ctx.db.delete(renderJobId);
  },
});

/**
 * Estimate render cost
 */
export const estimateRenderCost = action({
  args: {
    compositionId: v.id("compositions"),
    codec: v.optional(v.string()),
  },
  handler: async (ctx, { compositionId, codec }): Promise<any> => {
    const composition: any = await ctx.runQuery(api.compositions.get, { compositionId });

    if (!composition) {
      throw new Error("Composition not found");
    }

    const metadata: any = composition.ir.metadata;

    // Mock estimation - in production, use Remotion Lambda estimatePrice()
    const durationInSeconds: number = metadata.durationInFrames / metadata.fps;
    const baseCost: number = 0.05; // $0.05 per 30 seconds
    const estimatedCost: number = (durationInSeconds / 30) * baseCost;

    return {
      estimatedCost: Math.max(0.01, estimatedCost),
      estimatedTime: Math.ceil(durationInSeconds / 5), // ~5x realtime
      durationInSeconds,
      disclaimer:
        "Estimate based on standard quality H.264 encoding. Actual cost may vary.",
    };
  },
});

// Import API for use in actions
import { api } from "./_generated/api";

// Helper mutation to create render job
export const createRenderJob = mutation({
  args: {
    compositionId: v.id("compositions"),
    userId: v.id("users"),
    renderId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("rendering"),
      v.literal("complete"),
      v.literal("error")
    ),
    estimatedCost: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("renderJobs", args);
  },
});

// Helper mutation to update render job
export const updateRenderJob = mutation({
  args: {
    renderJobId: v.id("renderJobs"),
    updates: v.any(),
  },
  handler: async (ctx, { renderJobId, updates }) => {
    await ctx.db.patch(renderJobId, updates);
  },
});
