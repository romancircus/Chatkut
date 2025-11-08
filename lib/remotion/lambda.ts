/**
 * Remotion Lambda Integration
 *
 * Handles cloud rendering of compositions using Remotion Lambda.
 * Provides cost estimation, render job management, and progress tracking.
 */

import {
  getRenderProgress,
  renderMediaOnLambda,
  estimatePrice,
} from "@remotion/lambda/client";
import type { RenderProgress, AwsRegion } from "@remotion/lambda/client";

// Configuration
const REMOTION_CONFIG = {
  region: (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion,
  functionName: process.env.REMOTION_FUNCTION_NAME || "remotion-render-lambda",
  bucketName: process.env.REMOTION_S3_BUCKET || "chatkut-renders",
};

/**
 * Render options
 */
export interface RenderOptions {
  /** Composition ID */
  compositionId: string;
  /** Remotion component code */
  serveUrl: string;
  /** Output codec */
  codec?: "h264" | "h265" | "vp8" | "vp9" | "prores";
  /** Video quality (0-100) */
  quality?: number;
  /** Audio codec */
  audioCodec?: "aac" | "mp3" | "opus";
  /** Concurrency (1-200) */
  concurrency?: number;
  /** Max render time in seconds */
  maxRetries?: number;
}

/**
 * Start a cloud render job
 */
export async function startRender(
  options: RenderOptions & {
    durationInFrames: number;
    fps?: number;
    width?: number;
    height?: number;
  }
): Promise<{
  renderId: string;
  bucketName: string;
  estimatedCost: number;
}> {
  try {
    console.log("[remotion:render] Starting render:", {
      compositionId: options.compositionId,
      codec: options.codec || "h264",
    });

    // Get accurate cost estimate BEFORE rendering
    const costEstimate = await estimateRenderCost(
      options.durationInFrames,
      options.fps || 30,
      {
        width: options.width,
        height: options.height,
      }
    );

    console.log("[remotion:render] Estimated cost:", costEstimate);

    const { renderId, bucketName } = await renderMediaOnLambda({
      region: REMOTION_CONFIG.region,
      functionName: REMOTION_CONFIG.functionName,
      composition: options.compositionId,
      serveUrl: options.serveUrl,
      codec: options.codec || "h264",
      imageFormat: "jpeg",
      maxRetries: options.maxRetries || 1,
      privacy: "public",
      outName: {
        key: `renders/${options.compositionId}-${Date.now()}`,
        bucketName: REMOTION_CONFIG.bucketName,
      },
    });

    console.log("[remotion:render] Render started:", {
      renderId,
      estimatedCost: costEstimate.estimatedCost,
    });

    return {
      renderId,
      bucketName,
      estimatedCost: costEstimate.estimatedCost,
    };
  } catch (error) {
    console.error("[remotion:render] Failed to start render:", error);
    throw new Error(
      `Render failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get render progress
 */
export async function getRenderStatus(renderId: string): Promise<{
  progress: number;
  status: "rendering" | "done" | "error";
  outputUrl?: string;
  error?: string;
  costs: {
    accruedSoFar: number;
    displayCost: string;
  };
}> {
  try {
    const progress = await getRenderProgress({
      renderId,
      bucketName: REMOTION_CONFIG.bucketName,
      functionName: REMOTION_CONFIG.functionName,
      region: REMOTION_CONFIG.region,
    });

    // Map progress to our format
    if (progress.done) {
      return {
        progress: 1,
        status: "done",
        outputUrl: progress.outputFile || undefined,
        costs: {
          accruedSoFar: progress.costs.accruedSoFar,
          displayCost: progress.costs.displayCost,
        },
      };
    }

    if (progress.fatalErrorEncountered) {
      return {
        progress: progress.overallProgress,
        status: "error",
        error: progress.errors[0]?.message || "Unknown error",
        costs: {
          accruedSoFar: progress.costs.accruedSoFar,
          displayCost: progress.costs.displayCost,
        },
      };
    }

    return {
      progress: progress.overallProgress,
      status: "rendering",
      costs: {
        accruedSoFar: progress.costs.accruedSoFar,
        displayCost: progress.costs.displayCost,
      },
    };
  } catch (error) {
    console.error("Failed to get render status:", error);
    throw new Error(
      `Status check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Estimate rendering cost using Remotion's official estimatePrice API
 *
 * @see https://remotion.dev/docs/lambda/estimateprice
 */
export async function estimateRenderCost(
  durationInFrames: number,
  fps: number = 30,
  options?: {
    width?: number;
    height?: number;
    memorySizeInMb?: number;
    diskSizeInMb?: number;
  }
): Promise<{
  estimatedCost: number;
  estimatedTime: number;
  disclaimer: string;
}> {
  try {
    console.log("[remotion:estimate] Estimating cost for:", {
      durationInFrames,
      fps,
      region: REMOTION_CONFIG.region,
    });

    // Use official Remotion Lambda estimatePrice API
    const estimate = await estimatePrice({
      region: REMOTION_CONFIG.region,
      durationInFrames,
      fps,
      width: options?.width || 1920,
      height: options?.height || 1080,
      memorySizeInMb: options?.memorySizeInMb || 2048,
      diskSizeInMb: options?.diskSizeInMb || 2048,
      lambdaEfficiencyLevel: 0.8, // Typical efficiency for Remotion renders
    });

    console.log("[remotion:estimate] Official estimate:", {
      cost: `$${estimate.estimatedCost.toFixed(4)}`,
      duration: `${estimate.estimatedDuration}ms`,
    });

    return {
      estimatedCost: estimate.estimatedCost,
      estimatedTime: Math.ceil(estimate.estimatedDuration / 1000), // Convert ms to seconds
      disclaimer: "Estimate based on AWS Lambda pricing and typical Remotion efficiency. Actual cost may vary based on composition complexity.",
    };
  } catch (error) {
    console.error("[remotion:estimate] Failed to estimate cost:", error);

    // Fallback to rough estimation if API fails
    const durationInSeconds = durationInFrames / fps;
    const baseCost = 0.05; // Rough fallback: $0.05 per 30 seconds
    const estimatedCost = (durationInSeconds / 30) * baseCost;
    const estimatedTime = Math.ceil(durationInSeconds / 5); // ~5x realtime

    console.warn("[remotion:estimate] Using fallback estimation");

    return {
      estimatedCost: Math.max(0.01, estimatedCost),
      estimatedTime,
      disclaimer: "Estimate unavailable - using fallback calculation. Actual cost may vary significantly.",
    };
  }
}

/**
 * Cancel a render job
 */
export async function cancelRender(renderId: string): Promise<void> {
  // Remotion doesn't provide a cancel API directly
  // In production, you would track render jobs and clean them up
  console.warn("Render cancellation not implemented");
}

/**
 * Get render history for a project
 */
export interface RenderJob {
  renderId: string;
  compositionId: string;
  status: "pending" | "rendering" | "done" | "error";
  progress: number;
  outputUrl?: string;
  cost: number;
  createdAt: number;
  completedAt?: number;
}

// In production, this would query from a database
export async function getRenderHistory(
  projectId: string
): Promise<RenderJob[]> {
  // Placeholder - would fetch from Convex in real implementation
  return [];
}

/**
 * Helper to poll render status until complete
 */
export async function pollRenderUntilComplete(
  renderId: string,
  onProgress?: (progress: number) => void,
  maxWaitTime: number = 300000 // 5 minutes
): Promise<{
  outputUrl: string;
  cost: number;
}> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < maxWaitTime) {
    const status = await getRenderStatus(renderId);

    if (onProgress) {
      onProgress(status.progress);
    }

    if (status.status === "done" && status.outputUrl) {
      return {
        outputUrl: status.outputUrl,
        cost: status.costs.accruedSoFar,
      };
    }

    if (status.status === "error") {
      throw new Error(`Render failed: ${status.error}`);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Render timeout - exceeded maximum wait time");
}
