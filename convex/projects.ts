import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get a project by ID
 */
export const get = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    return await ctx.db.get(projectId);
  },
});

/**
 * List all projects for the current user
 */
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject as any;

    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Create a new project
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, description }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject as any;
    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      userId,
      name,
      description,
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

/**
 * Update a project
 */
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, name, description }) => {
    const project = await ctx.db.get(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    await ctx.db.patch(projectId, updates);
  },
});

/**
 * Delete a project
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    // TODO: Also delete related compositions, assets, chat messages
    await ctx.db.delete(projectId);
  },
});
