/**
 * Composition History & Undo/Redo
 *
 * Manages version history for compositions to enable undo/redo functionality.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { CompositionIR } from "@/types/composition-ir";

/**
 * Save a history snapshot
 */
export const saveSnapshot = mutation({
  args: {
    compositionId: v.id("compositions"),
    ir: v.any(), // CompositionIR
    description: v.string(),
  },
  handler: async (ctx, { compositionId, ir, description }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    // Get current history count
    const historyCount = await ctx.db
      .query("compositionHistory")
      .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
      .collect()
      .then((items) => items.length);

    // Limit history to last 50 snapshots
    if (historyCount >= 50) {
      const oldest = await ctx.db
        .query("compositionHistory")
        .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
        .order("asc")
        .first();

      if (oldest) {
        await ctx.db.delete(oldest._id);
      }
    }

    // Save snapshot
    const snapshotId = await ctx.db.insert("compositionHistory", {
      compositionId,
      ir,
      description,
      version: composition.version,
      timestamp: Date.now(),
    });

    return snapshotId;
  },
});

/**
 * Get history for a composition
 */
export const getHistory = query({
  args: {
    compositionId: v.id("compositions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { compositionId, limit = 20 }) => {
    return await ctx.db
      .query("compositionHistory")
      .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Restore a snapshot (undo/redo)
 */
export const restoreSnapshot = mutation({
  args: {
    compositionId: v.id("compositions"),
    snapshotId: v.id("compositionHistory"),
  },
  handler: async (ctx, { compositionId, snapshotId }) => {
    const snapshot = await ctx.db.get(snapshotId);
    if (!snapshot) {
      throw new Error("Snapshot not found");
    }

    if (snapshot.compositionId !== compositionId) {
      throw new Error("Snapshot does not belong to this composition");
    }

    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    // Update composition with snapshot IR
    await ctx.db.patch(compositionId, {
      ir: snapshot.ir,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    return {
      restored: true,
      version: composition.version + 1,
    };
  },
});

/**
 * Get the most recent snapshot
 */
export const getLatestSnapshot = query({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }) => {
    return await ctx.db
      .query("compositionHistory")
      .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
      .order("desc")
      .first();
  },
});

/**
 * Undo last change
 */
export const undo = mutation({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    // Get previous snapshot
    const previousSnapshot = await ctx.db
      .query("compositionHistory")
      .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
      .order("desc")
      .take(2) // Get last 2 to skip current state
      .then((items) => items[1]); // Get second-to-last

    if (!previousSnapshot) {
      return {
        success: false,
        message: "No previous state to restore",
      };
    }

    // Restore snapshot
    await ctx.db.patch(compositionId, {
      ir: previousSnapshot.ir,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: `Undid: ${previousSnapshot.description}`,
      version: composition.version + 1,
    };
  },
});

/**
 * Clear history for a composition
 */
export const clearHistory = mutation({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }) => {
    const snapshots = await ctx.db
      .query("compositionHistory")
      .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
      .collect();

    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
    }

    return {
      deleted: snapshots.length,
    };
  },
});

/**
 * Get undo/redo stack info
 */
export const getUndoRedoState = query({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }) => {
    const history = await ctx.db
      .query("compositionHistory")
      .withIndex("by_composition", (q) => q.eq("compositionId", compositionId))
      .order("desc")
      .collect();

    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      return {
        canUndo: false,
        canRedo: false,
        historyCount: 0,
      };
    }

    // Current version matches latest snapshot
    const currentVersion = composition.version;
    const latestSnapshot = history[0];
    const isAtLatest = !latestSnapshot || currentVersion === latestSnapshot.version;

    return {
      canUndo: history.length > 0,
      canRedo: !isAtLatest, // Can redo if not at latest
      historyCount: history.length,
      currentVersion,
    };
  },
});
