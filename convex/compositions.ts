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
