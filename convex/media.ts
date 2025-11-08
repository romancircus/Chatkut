/**
 * Cloudflare Stream and R2 integration
 *
 * This module handles all media uploads and storage via Cloudflare.
 * NO media files transit through Convex - only metadata is stored here.
 */

import { v } from "convex/values";
import { action, httpAction, mutation, query, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Webhook } from "svix";

// Environment variables (set via `npx convex env set`)
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const CLOUDFLARE_R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT;
const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || "chatkut-media";
const CLOUDFLARE_WEBHOOK_SECRET = process.env.CLOUDFLARE_WEBHOOK_SECRET;

// Debug: Log environment variable status
console.log("[media.ts] Environment check:", {
  hasAccountId: !!CLOUDFLARE_ACCOUNT_ID,
  hasStreamToken: !!CLOUDFLARE_STREAM_API_TOKEN,
  hasR2AccessKey: !!CLOUDFLARE_R2_ACCESS_KEY_ID,
  hasR2SecretKey: !!CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  hasR2Endpoint: !!CLOUDFLARE_R2_ENDPOINT,
  hasWebhookSecret: !!CLOUDFLARE_WEBHOOK_SECRET,
  accountIdValue: CLOUDFLARE_ACCOUNT_ID ? `${CLOUDFLARE_ACCOUNT_ID.substring(0, 8)}...` : "undefined",
});

/**
 * Request TUS upload URL for video/audio from Cloudflare Stream
 * Uses Direct Creator Upload API to get a one-time TUS upload URL
 *
 * @see https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
 */
export const requestStreamUploadUrl = action({
  args: {
    projectId: v.id("projects"),
    filename: v.string(),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, filename, fileSize }): Promise<{
    assetId: any;
    uploadUrl: string;
    apiToken: string;
  }> => {
    console.log("[media:requestUpload] Requesting TUS upload for:", { filename, fileSize });

    // Validate environment variables
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      console.error("[media:requestUpload] Missing Cloudflare credentials");
      throw new Error(
        "Cloudflare not configured. Run: npx convex env set CLOUDFLARE_ACCOUNT_ID \"your-id\""
      );
    }

    // Return TUS endpoint for Cloudflare Stream
    // TUS client will POST to this endpoint to create an upload
    const tusEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

    console.log("[media:requestUpload] Returning TUS endpoint:", tusEndpoint);

    // Create asset record in Convex (metadata only)
    // Note: We don't have streamId yet - TUS will provide it after upload starts
    const assetId = await ctx.runMutation(api.media.createAsset, {
      projectId,
      filename,
      fileSize,
      type: "video",
      status: "uploading",
    });

    console.log("[media:requestUpload] Created asset record:", assetId);

    return {
      assetId,
      uploadUrl: tusEndpoint, // TUS endpoint for creating uploads
      apiToken: CLOUDFLARE_STREAM_API_TOKEN, // Frontend needs this for TUS headers
    };
  },
});

/**
 * Handle Cloudflare Stream webhook when video is ready
 * Uses Svix for webhook signature verification (security)
 *
 * Cloudflare Stream sends webhooks for:
 * - status: "ready" - Video processed and ready to play
 * - status: "error" - Video processing failed
 *
 * @see https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
 */
export const handleStreamWebhook = httpAction(async (ctx, request) => {
  console.log("[media:webhook] Received webhook");

  // Validate environment variables
  if (!CLOUDFLARE_WEBHOOK_SECRET) {
    console.error("[media:webhook] CLOUDFLARE_WEBHOOK_SECRET not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  if (!CLOUDFLARE_ACCOUNT_ID) {
    console.error("[media:webhook] CLOUDFLARE_ACCOUNT_ID not set");
    return new Response("Cloudflare account not configured", { status: 500 });
  }

  // Step 1: Verify webhook signature using Svix
  const payloadString = await request.text();
  const svixHeaders = {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  };

  if (!svixHeaders["svix-id"] || !svixHeaders["svix-timestamp"] || !svixHeaders["svix-signature"]) {
    console.error("[media:webhook] Missing required Svix headers");
    return new Response("Missing required headers", { status: 400 });
  }

  let event: any;

  try {
    const wh = new Webhook(CLOUDFLARE_WEBHOOK_SECRET);
    event = wh.verify(payloadString, svixHeaders as Record<string, string>);
    console.log("[media:webhook] Signature verified ✅");
  } catch (error) {
    console.error("[media:webhook] Signature verification failed:", error);
    return new Response("Unauthorized - Invalid signature", { status: 401 });
  }

  // Step 2: Parse event data
  console.log("[media:webhook] Event received:", {
    status: event.status,
    uid: event.uid,
  });

  // Step 3: Handle event based on status
  if (event.status === "ready") {
    // Generate HLS playback URL
    const playbackUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${event.uid}/manifest/video.m3u8`;

    console.log("[media:webhook] Video ready, updating asset:", {
      streamId: event.uid,
      playbackUrl,
      duration: event.duration,
    });

    await ctx.runMutation(internal.media.updateAssetByStreamId, {
      streamId: event.uid,
      status: "ready",
      playbackUrl,
      duration: event.duration || 0,
      thumbnailUrl: event.thumbnail,
    });

    console.log("[media:webhook] Asset marked ready ✅");
  } else if (event.status === "error") {
    console.error("[media:webhook] Video processing failed:", event.uid);

    await ctx.runMutation(internal.media.updateAssetByStreamId, {
      streamId: event.uid,
      status: "error",
      errorMessage: "Stream processing failed",
    });

    console.log("[media:webhook] Asset marked error ❌");
  } else {
    console.log("[media:webhook] Ignoring event with status:", event.status);
  }

  // Step 4: Return 200 OK to acknowledge webhook
  return new Response(null, { status: 200 });
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
  handler: async (ctx, { projectId, filename, fileSize, mimeType, type }): Promise<{
    assetId: any;
    uploadUrl: string;
    r2Key: string;
  }> => {
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
 * Internal mutation - only callable from other Convex functions
 */
export const updateAssetByStreamId = internalMutation({
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
 * Update asset with stream ID (called from frontend after TUS upload URL is created)
 */
export const updateAssetStreamId = mutation({
  args: {
    assetId: v.id("assets"),
    streamId: v.string(),
  },
  handler: async (ctx, { assetId, streamId }) => {
    await ctx.db.patch(assetId, {
      streamId,
      updatedAt: Date.now(),
    });
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
  handler: async (ctx, { assetId }): Promise<{ success: boolean }> => {
    const asset = await ctx.runQuery(api.media.getAsset, { assetId });

    if (!asset) {
      throw new Error("Asset not found");
    }

    // Delete from Cloudflare Stream if it's a video
    if (asset.streamId && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_STREAM_API_TOKEN) {
      console.log("[media:deleteAsset] Deleting from Cloudflare Stream:", asset.streamId);

      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${asset.streamId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          },
        }
      );

      console.log("[media:deleteAsset] Deleted from Cloudflare ✅");
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
