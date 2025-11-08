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
    // TODO: Add authentication when ready
    // For now, show all projects
    return await ctx.db
      .query("projects")
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
    console.log("[Convex] Creating project:", name);

    // TODO: Add authentication when ready
    // For now, use a temporary user ID
    const userId = "temp_user_1" as any;
    const now = Date.now();

    console.log("[Convex] Inserting into database...");
    const projectId = await ctx.db.insert("projects", {
      userId,
      name,
      description,
      createdAt: now,
      updatedAt: now,
    });

    console.log("[Convex] Project created with ID:", projectId);
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
