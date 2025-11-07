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
  handler: async (ctx, { compositionId, codec, quality }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject as any;

    // Get composition
    const composition = await ctx.runQuery(
      async (ctx) => await ctx.db.get(compositionId)
    );

    if (!composition) {
      throw new Error("Composition not found");
    }

    // In production, this would call Remotion Lambda
    // For now, create a mock render job
    const renderId = `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save render job
    const renderJobId = await ctx.runMutation(
      async (ctx) =>
        await ctx.db.insert("renderJobs", {
          compositionId,
          userId,
          projectId: composition.projectId,
          renderId,
          status: "pending",
          progress: 0,
          codec: codec || "h264",
          quality: quality || 80,
          estimatedCost: 0.15, // Mock cost
          actualCost: 0,
          createdAt: Date.now(),
        })
    );

    // Start render (would call Remotion Lambda here)
    // const { renderId, estimatedCost } = await startRemotionRender({
    //   compositionId: composition._id,
    //   serveUrl: "...",
    //   codec,
    //   quality,
    // });

    // Simulate rendering progress
    setTimeout(async () => {
      await ctx.runMutation(
        async (ctx) =>
          await ctx.db.patch(renderJobId, {
            status: "rendering",
            progress: 0.3,
          })
      );
    }, 2000);

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
 * List render jobs for a project
 */
export const listRenderJobs = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 20 }) => {
    return await ctx.db
      .query("renderJobs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject as any;

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
    const renderJob = await ctx.runQuery(
      async (ctx) => await ctx.db.get(renderJobId)
    );

    if (!renderJob) {
      throw new Error("Render job not found");
    }

    if (renderJob.status === "completed" || renderJob.status === "error") {
      throw new Error("Cannot cancel completed or failed render");
    }

    // Cancel on Remotion Lambda
    // await cancelRemotionRender(renderJob.renderId);

    // Update status
    await ctx.runMutation(
      async (ctx) =>
        await ctx.db.patch(renderJobId, {
          status: "cancelled",
          completedAt: Date.now(),
        } as any)
    );

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
  handler: async (ctx, { compositionId, codec }) => {
    const composition = await ctx.runQuery(
      async (ctx) => await ctx.db.get(compositionId)
    );

    if (!composition) {
      throw new Error("Composition not found");
    }

    const { metadata } = composition.ir;

    // Mock estimation - in production, use Remotion Lambda estimatePrice()
    const durationInSeconds = metadata.durationInFrames / metadata.fps;
    const baseCost = 0.05; // $0.05 per 30 seconds
    const estimatedCost = (durationInSeconds / 30) * baseCost;

    return {
      estimatedCost: Math.max(0.01, estimatedCost),
      estimatedTime: Math.ceil(durationInSeconds / 5), // ~5x realtime
      durationInSeconds,
      disclaimer:
        "Estimate based on standard quality H.264 encoding. Actual cost may vary.",
    };
  },
});
