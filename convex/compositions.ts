/**
 * Composition Management
 *
 * Handles creation, updates, and versioning of video compositions.
 */

import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import type { CompositionIR, EditPlan } from "@/types/composition-ir";

/**
 * Create a new composition for a project
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    durationInFrames: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TODO: Re-enable authentication after testing
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new Error("Not authenticated");
    // }

    const now = Date.now();

    // Create initial IR structure
    const ir: CompositionIR = {
      id: `comp_${Date.now()}`,
      version: 1,
      metadata: {
        width: args.width || 1920,
        height: args.height || 1080,
        fps: args.fps || 30,
        durationInFrames: args.durationInFrames || 300, // 10 seconds at 30fps
      },
      elements: [],
      patches: [],
    };

    const compositionId = await ctx.db.insert("compositions", {
      projectId: args.projectId,
      ir,
      code: "",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    return compositionId;
  },
});

/**
 * Get composition by ID
 */
export const get = query({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }) => {
    return await ctx.db.get(compositionId);
  },
});

/**
 * List compositions for a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("compositions")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

/**
 * Update composition IR
 */
export const updateIR = mutation({
  args: {
    compositionId: v.id("compositions"),
    ir: v.any(), // CompositionIR type
  },
  handler: async (ctx, { compositionId, ir }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    await ctx.db.patch(compositionId, {
      ir,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Execute an edit plan
 */
export const executeEditPlan = action({
  args: {
    compositionId: v.id("compositions"),
    editPlan: v.any(), // EditPlan type
    resolvedElementId: v.optional(v.string()), // For disambiguation
  },
  handler: async (ctx, { compositionId, editPlan, resolvedElementId }) => {
    // Get composition
    const composition = await ctx.runQuery(api.compositions.get, {
      compositionId,
    });

    if (!composition) {
      throw new Error("Composition not found");
    }

    // Import executor dynamically (can't import from lib in Convex)
    // For now, we'll implement a simple version here
    const result = await executeEditPlanInConvex(
      composition.ir,
      editPlan,
      resolvedElementId
    );

    if (!result.success) {
      return result;
    }

    // Update composition with new IR
    await ctx.runMutation(api.compositions.updateIR, {
      compositionId,
      ir: result.updatedIR,
    });

    // Trigger Remotion code generation
    await ctx.runAction(api.ai.generateRemotionCode, { compositionId });

    return result;
  },
});

/**
 * Delete a composition
 */
export const deleteComposition = mutation({
  args: {
    compositionId: v.id("compositions"),
  },
  handler: async (ctx, { compositionId }) => {
    await ctx.db.delete(compositionId);
  },
});

// ==================== Helper Functions ====================

/**
 * Execute edit plan (simplified version for Convex)
 * Full version is in lib/composition-engine/executor.ts
 */
async function executeEditPlanInConvex(
  ir: CompositionIR,
  plan: EditPlan,
  resolvedElementId?: string
): Promise<{
  success: boolean;
  updatedIR?: CompositionIR;
  affectedElements: string[];
  receipt: string;
  error?: string;
  needsDisambiguation?: boolean;
  disambiguationOptions?: any[];
}> {
  try {
    switch (plan.operation) {
      case "add":
        return executeAdd(ir, plan);
      case "update":
        return executeUpdate(ir, plan, resolvedElementId);
      case "delete":
        return executeDelete(ir, plan, resolvedElementId);
      case "move":
        return executeMove(ir, plan, resolvedElementId);
      default:
        return {
          success: false,
          affectedElements: [],
          receipt: "",
          error: `Unknown operation: ${(plan as any).operation}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function executeAdd(ir: CompositionIR, plan: EditPlan) {
  const newElement = {
    id: generateElementId(),
    type: plan.changes.type,
    from: plan.changes.from || 0,
    durationInFrames: plan.changes.durationInFrames || 90,
    properties: plan.changes.properties || {},
    label: plan.changes.label,
    animation: plan.changes.animations,
  };

  const updatedIR = {
    ...ir,
    elements: [...ir.elements, newElement],
  };

  const receipt = plan.changes.label
    ? `Added ${plan.changes.type} element "${plan.changes.label}"`
    : `Added ${plan.changes.type} element`;

  return {
    success: true,
    updatedIR,
    affectedElements: [newElement.id],
    receipt,
  };
}

function executeUpdate(
  ir: CompositionIR,
  plan: EditPlan,
  resolvedElementId?: string
) {
  // Simple implementation - find by ID if provided, otherwise use selector
  const targetId =
    resolvedElementId ||
    (plan.selector?.type === "byId" ? plan.selector.id : null);

  if (!targetId) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Update requires element ID",
    };
  }

  const targetElement = ir.elements.find((el) => el.id === targetId);
  if (!targetElement) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Element not found",
    };
  }

  const updatedIR = {
    ...ir,
    elements: ir.elements.map((el) => {
      if (el.id !== targetId) return el;

      return {
        ...el,
        properties: {
          ...el.properties,
          ...plan.changes.properties,
        },
        from:
          plan.changes.from !== undefined ? plan.changes.from : el.from,
        durationInFrames:
          plan.changes.durationInFrames !== undefined
            ? plan.changes.durationInFrames
            : el.durationInFrames,
        label:
          plan.changes.label !== undefined
            ? plan.changes.label
            : el.label,
        animation:
          plan.changes.animations !== undefined
            ? plan.changes.animations
            : el.animations,
      };
    }),
  };

  const receipt = targetElement.label
    ? `Updated "${targetElement.label}"`
    : `Updated ${targetElement.type} element`;

  return {
    success: true,
    updatedIR,
    affectedElements: [targetId],
    receipt,
  };
}

function executeDelete(
  ir: CompositionIR,
  plan: EditPlan,
  resolvedElementId?: string
) {
  const targetId =
    resolvedElementId ||
    (plan.selector?.type === "byId" ? plan.selector.id : null);

  if (!targetId) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Delete requires element ID",
    };
  }

  const targetElement = ir.elements.find((el) => el.id === targetId);
  if (!targetElement) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Element not found",
    };
  }

  const updatedIR = {
    ...ir,
    elements: ir.elements.filter((el) => el.id !== targetId),
  };

  const receipt = targetElement.label
    ? `Deleted "${targetElement.label}"`
    : `Deleted ${targetElement.type} element`;

  return {
    success: true,
    updatedIR,
    affectedElements: [targetId],
    receipt,
  };
}

function executeMove(
  ir: CompositionIR,
  plan: EditPlan,
  resolvedElementId?: string
) {
  const targetId =
    resolvedElementId ||
    (plan.selector?.type === "byId" ? plan.selector.id : null);

  if (!targetId) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Move requires element ID",
    };
  }

  const targetElement = ir.elements.find((el) => el.id === targetId);
  if (!targetElement) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Element not found",
    };
  }

  const updatedIR = {
    ...ir,
    elements: ir.elements.map((el) => {
      if (el.id !== targetId) return el;

      return {
        ...el,
        from:
          plan.changes.from !== undefined ? plan.changes.from : el.from,
        durationInFrames:
          plan.changes.durationInFrames !== undefined
            ? plan.changes.durationInFrames
            : el.durationInFrames,
      };
    }),
  };

  const receipt = targetElement.label
    ? `Moved "${targetElement.label}"`
    : `Moved ${targetElement.type} element`;

  return {
    success: true,
    updatedIR,
    affectedElements: [targetId],
    receipt,
  };
}

function generateElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add element to composition (for manual editing)
 */
export const addElement = mutation({
  args: {
    compositionId: v.id("compositions"),
    assetId: v.id("assets"),
    from: v.optional(v.number()),
    durationInFrames: v.optional(v.number()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { compositionId, assetId, from, durationInFrames, label }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    const asset = await ctx.db.get(assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    // Validate asset is ready
    if (asset.status !== "ready") {
      throw new Error(`Asset is not ready (status: ${asset.status}). Please wait for processing to complete.`);
    }

    // Validate asset has playback URL
    if (!asset.playbackUrl) {
      throw new Error("Asset does not have a playback URL");
    }

    // Validate frame ranges
    const startFrame = from ?? 0;
    if (startFrame < 0) {
      throw new Error("Start frame must be non-negative");
    }

    // Calculate duration if not provided
    const elementDuration = durationInFrames || (asset.duration ? Math.floor(asset.duration * composition.ir.metadata.fps) : 90);

    if (elementDuration <= 0) {
      throw new Error("Duration must be positive");
    }

    const endFrame = startFrame + elementDuration;
    if (endFrame > composition.ir.metadata.durationInFrames) {
      console.warn(`[addElement] Element extends beyond composition (${endFrame} > ${composition.ir.metadata.durationInFrames})`);
    }

    // Create new element
    const newElement = {
      id: generateElementId(),
      type: asset.type,
      from: startFrame,
      durationInFrames: elementDuration,
      properties: {
        src: asset.playbackUrl,
        volume: 1,
      },
      label: label || asset.filename,
    };

    const updatedIR = {
      ...composition.ir,
      elements: [...composition.ir.elements, newElement],
      version: composition.ir.version + 1,
    };

    await ctx.db.patch(compositionId, {
      ir: updatedIR,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    console.log(`[addElement] Added element ${newElement.id} (type: ${asset.type}, from: ${startFrame}, duration: ${elementDuration})`);
    return newElement.id;
  },
});

/**
 * Update element in composition
 */
export const updateElement = mutation({
  args: {
    compositionId: v.id("compositions"),
    elementId: v.string(),
    changes: v.any(),
  },
  handler: async (ctx, { compositionId, elementId, changes }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    // Find the element
    const element = composition.ir.elements.find((el: any) => el.id === elementId);
    if (!element) {
      throw new Error(`Element ${elementId} not found in composition`);
    }

    // Validate frame ranges if updating timing
    if (changes.from !== undefined) {
      if (changes.from < 0) {
        throw new Error("Start frame must be non-negative");
      }
    }

    if (changes.durationInFrames !== undefined) {
      if (changes.durationInFrames <= 0) {
        throw new Error("Duration must be positive");
      }
    }

    // Validate volume if present
    if (changes.properties?.volume !== undefined) {
      const volume = changes.properties.volume;
      if (volume < 0 || volume > 1) {
        throw new Error("Volume must be between 0 and 1");
      }
    }

    // Validate playback rate if present
    if (changes.properties?.playbackRate !== undefined) {
      const rate = changes.properties.playbackRate;
      if (rate <= 0 || rate > 10) {
        throw new Error("Playback rate must be between 0 and 10");
      }
    }

    // Validate opacity if present
    if (changes.properties?.opacity !== undefined) {
      const opacity = changes.properties.opacity;
      if (opacity < 0 || opacity > 1) {
        throw new Error("Opacity must be between 0 and 1");
      }
    }

    const updatedIR = {
      ...composition.ir,
      elements: composition.ir.elements.map((el: any) => {
        if (el.id !== elementId) return el;
        return {
          ...el,
          ...changes,
          properties: {
            ...el.properties,
            ...(changes.properties || {}),
          },
        };
      }),
      version: composition.ir.version + 1,
    };

    await ctx.db.patch(compositionId, {
      ir: updatedIR,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    console.log(`[updateElement] Updated element ${elementId}`, changes);
  },
});

/**
 * Delete element from composition
 */
export const deleteElement = mutation({
  args: {
    compositionId: v.id("compositions"),
    elementId: v.string(),
  },
  handler: async (ctx, { compositionId, elementId }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    // Verify element exists
    const element = composition.ir.elements.find((el: any) => el.id === elementId);
    if (!element) {
      throw new Error(`Element ${elementId} not found in composition`);
    }

    const updatedIR = {
      ...composition.ir,
      elements: composition.ir.elements.filter((el: any) => el.id !== elementId),
      version: composition.ir.version + 1,
    };

    await ctx.db.patch(compositionId, {
      ir: updatedIR,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    console.log(`[deleteElement] Deleted element ${elementId} (type: ${element.type}, label: ${element.label})`);
  },
});

/**
 * Reorder elements in composition
 */
export const reorderElements = mutation({
  args: {
    compositionId: v.id("compositions"),
    elementIds: v.array(v.string()),
  },
  handler: async (ctx, { compositionId, elementIds }) => {
    const composition = await ctx.db.get(compositionId);
    if (!composition) {
      throw new Error("Composition not found");
    }

    // Validate that all provided IDs exist
    const existingIds = new Set(composition.ir.elements.map((el: any) => el.id));
    const missingIds = elementIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      throw new Error(`Elements not found: ${missingIds.join(", ")}`);
    }

    // Validate that all existing elements are included
    if (elementIds.length !== composition.ir.elements.length) {
      throw new Error(`Reorder must include all ${composition.ir.elements.length} elements, got ${elementIds.length}`);
    }

    // Create map of elements by ID
    const elementMap = new Map(composition.ir.elements.map((el: any) => [el.id, el]));

    // Reorder based on provided IDs
    const reorderedElements = elementIds.map((id) => elementMap.get(id)).filter(Boolean);

    const updatedIR = {
      ...composition.ir,
      elements: reorderedElements,
      version: composition.ir.version + 1,
    };

    await ctx.db.patch(compositionId, {
      ir: updatedIR,
      version: composition.version + 1,
      updatedAt: Date.now(),
    });

    console.log(`[reorderElements] Reordered ${elementIds.length} elements`);
  },
});
