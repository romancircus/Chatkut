/**
 * Cloudflare Stream and R2 integration
 *
 * This module handles all media uploads and storage via Cloudflare.
 * NO media files transit through Convex - only metadata is stored here.
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_STREAM_TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN!;
const CLOUDFLARE_R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY!;
const CLOUDFLARE_R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_KEY!;
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || "chatkut-media";

/**
 * Request a TUS upload URL for video/audio from Cloudflare Stream
 */
export const requestStreamUploadUrl = action({
  args: {
    projectId: v.id("projects"),
    filename: v.string(),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, filename, fileSize }) => {
    // Call Cloudflare Stream API to get TUS upload URL
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_STREAM_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds: 21600, // 6 hours max
          requireSignedURLs: false, // Set to true for private videos
          allowedOrigins: ["http://localhost:3000"], // Add production domain later
          meta: {
            filename,
            projectId,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare Stream API error: ${error}`);
    }

    const data = await response.json();
    const result = data.result;

    // Create asset record in Convex (metadata only)
    const assetId = await ctx.runMutation(api.media.createAsset, {
      projectId,
      streamId: result.uid,
      filename,
      fileSize,
      type: "video",
      status: "uploading",
      uploadUrl: result.uploadURL,
    });

    return {
      assetId,
      uploadUrl: result.uploadURL, // TUS endpoint for browser upload
      streamId: result.uid,
    };
  },
});

/**
 * Handle Cloudflare Stream webhook when video is ready
 */
export const handleStreamWebhook = action({
  args: {
    uid: v.string(),
    status: v.string(),
    meta: v.optional(v.any()),
    playback: v.optional(v.any()),
    duration: v.optional(v.number()),
    thumbnail: v.optional(v.string()),
  },
  handler: async (ctx, { uid, status, playback, duration, thumbnail }) => {
    if (status === "ready") {
      // Update asset with playback URL and duration
      await ctx.runMutation(api.media.updateAssetByStreamId, {
        streamId: uid,
        status: "ready",
        playbackUrl: playback?.hls, // HLS manifest URL
        duration,
        thumbnailUrl: thumbnail,
      });
    } else if (status === "error") {
      await ctx.runMutation(api.media.updateAssetByStreamId, {
        streamId: uid,
        status: "error",
        errorMessage: "Stream processing failed",
      });
    }
  },
});

/**
 * Request a presigned URL for R2 upload (images, rendered MP4s)
 */
export const requestR2UploadUrl = action({
  args: {
    projectId: v.id("projects"),
    filename: v.string(),
    fileSize: v.optional(v.number()),
    mimeType: v.string(),
    type: v.union(v.literal("image"), v.literal("rendered")),
  },
  handler: async (ctx, { projectId, filename, fileSize, mimeType, type }) => {
    // Generate unique R2 key
    const timestamp = Date.now();
    const r2Key = `${projectId}/${timestamp}-${filename}`;

    // For R2, we'll use AWS SDK (Cloudflare R2 is S3-compatible)
    // For now, return the R2 URL structure
    // In production, generate presigned URL using AWS SDK

    const uploadUrl = `https://${CLOUDFLARE_R2_BUCKET_NAME}.r2.cloudflarestorage.com/${r2Key}`;

    // Create asset record
    const assetId = await ctx.runMutation(api.media.createAsset, {
      projectId,
      r2Key,
      filename,
      fileSize,
      mimeType,
      type,
      status: "uploading",
      uploadUrl,
    });

    return {
      assetId,
      uploadUrl,
      r2Key,
    };
  },
});

/**
 * Mark R2 upload as complete and set playback URL
 */
export const completeR2Upload = mutation({
  args: {
    assetId: v.id("assets"),
    r2Key: v.string(),
  },
  handler: async (ctx, { assetId, r2Key }) => {
    // Generate public R2 URL
    const playbackUrl = `https://${CLOUDFLARE_R2_BUCKET_NAME}.r2.dev/${r2Key}`;

    await ctx.db.patch(assetId, {
      status: "ready",
      playbackUrl,
      updatedAt: Date.now(),
    });

    return { playbackUrl };
  },
});

/**
 * Create asset record (called by actions)
 */
export const createAsset = mutation({
  args: {
    projectId: v.id("projects"),
    streamId: v.optional(v.string()),
    r2Key: v.optional(v.string()),
    filename: v.string(),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    type: v.union(
      v.literal("video"),
      v.literal("audio"),
      v.literal("image"),
      v.literal("rendered")
    ),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("error")
    ),
    uploadUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { projectId, streamId, r2Key, filename, fileSize, mimeType, type, status, uploadUrl }
  ) => {
    const now = Date.now();

    const assetId = await ctx.db.insert("assets", {
      projectId,
      streamId,
      r2Key,
      filename,
      fileSize,
      mimeType,
      type,
      status,
      uploadUrl,
      createdAt: now,
      updatedAt: now,
    });

    return assetId;
  },
});

/**
 * Update asset by Stream ID (for webhooks)
 */
export const updateAssetByStreamId = mutation({
  args: {
    streamId: v.string(),
    status: v.optional(
      v.union(
        v.literal("uploading"),
        v.literal("processing"),
        v.literal("ready"),
        v.literal("error")
      )
    ),
    playbackUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { streamId, status, playbackUrl, duration, thumbnailUrl, errorMessage }
  ) => {
    const asset = await ctx.db
      .query("assets")
      .withIndex("by_stream_id", (q) => q.eq("streamId", streamId))
      .first();

    if (!asset) {
      throw new Error(`Asset with streamId ${streamId} not found`);
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (status) updates.status = status;
    if (playbackUrl) updates.playbackUrl = playbackUrl;
    if (duration) updates.duration = duration;
    if (thumbnailUrl) updates.thumbnailUrl = thumbnailUrl;
    if (errorMessage) updates.errorMessage = errorMessage;

    await ctx.db.patch(asset._id, updates);

    return asset._id;
  },
});

/**
 * Get assets for a project
 */
export const listAssets = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("assets")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

/**
 * Get asset by ID
 */
export const getAsset = query({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, { assetId }) => {
    return await ctx.db.get(assetId);
  },
});

/**
 * Delete asset (and remove from Cloudflare)
 */
export const deleteAsset = action({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, { assetId }) => {
    const asset = await ctx.runQuery(api.media.getAsset, { assetId });

    if (!asset) {
      throw new Error("Asset not found");
    }

    // Delete from Cloudflare Stream if it's a video
    if (asset.streamId) {
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${asset.streamId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_STREAM_TOKEN}`,
          },
        }
      );
    }

    // TODO: Delete from R2 if it's an image/rendered video
    // Would need AWS SDK or Cloudflare R2 API

    // Delete metadata from Convex
    await ctx.runMutation(api.media.deleteAssetRecord, { assetId });

    return { success: true };
  },
});

/**
 * Delete asset record from database
 */
export const deleteAssetRecord = mutation({
  args: {
    assetId: v.id("assets"),
  },
  handler: async (ctx, { assetId }) => {
    await ctx.db.delete(assetId);
  },
});
