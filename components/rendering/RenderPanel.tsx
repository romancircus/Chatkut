"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  PlayIcon,
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  DownloadIcon,
  DollarSignIcon,
  ClockIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RenderPanelProps {
  compositionId: Id<"compositions">;
  projectId: Id<"projects">;
}

/**
 * Render Panel Component
 *
 * Allows users to start renders, view progress, estimate costs,
 * and download completed renders.
 */
export function RenderPanel({ compositionId, projectId }: RenderPanelProps) {
  const [showEstimate, setShowEstimate] = useState(false);
  const [codec, setCodec] = useState<"h264" | "h265">("h264");
  const [quality, setQuality] = useState(80);

  const composition = useQuery(api.compositions.get, { compositionId });
  const renderJobs = useQuery(api.rendering.listRenderJobs, { projectId, limit: 5 });
  const startRender = useAction(api.rendering.startRender);
  const estimateCost = useAction(api.rendering.estimateRenderCost);

  const handleStartRender = async () => {
    try {
      await startRender({ compositionId, codec, quality });
    } catch (error) {
      console.error("Failed to start render:", error);
    }
  };

  const handleEstimate = async () => {
    try {
      const estimate = await estimateCost({ compositionId, codec });
      console.log("Estimated cost:", estimate);
      setShowEstimate(true);
    } catch (error) {
      console.error("Failed to estimate cost:", error);
    }
  };

  if (!composition) {
    return (
      <div className="p-4 text-center">
        <LoaderIcon className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
      </div>
    );
  }

  const latestRender = renderJobs?.[0];

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-l border-neutral-800">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold mb-1">Render</h2>
        <p className="text-sm text-neutral-500">
          Export your composition to video
        </p>
      </div>

      {/* Settings */}
      <div className="p-4 space-y-4 border-b border-neutral-800">
        {/* Codec Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Codec</label>
          <div className="flex space-x-2">
            {["h264", "h265"].map((c) => (
              <button
                key={c}
                onClick={() => setCodec(c as any)}
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  codec === c
                    ? "bg-primary-500 text-white"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                )}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Slider */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Quality: {quality}%
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Composition Info */}
        <div className="text-sm space-y-1 text-neutral-500">
          <p>
            {composition.ir.metadata.width}x{composition.ir.metadata.height} @{" "}
            {composition.ir.metadata.fps}fps
          </p>
          <p>
            Duration:{" "}
            {(
              composition.ir.metadata.durationInFrames /
              composition.ir.metadata.fps
            ).toFixed(1)}
            s
          </p>
        </div>

        {/* Estimate Button */}
        <button
          onClick={handleEstimate}
          className="w-full btn-ghost flex items-center justify-center space-x-2"
        >
          <DollarSignIcon className="w-4 h-4" />
          <span>Estimate Cost</span>
        </button>

        {/* Start Render Button */}
        <button
          onClick={handleStartRender}
          className="w-full btn-primary flex items-center justify-center space-x-2"
          disabled={!composition}
        >
          <PlayIcon className="w-4 h-4" />
          <span>Start Render</span>
        </button>
      </div>

      {/* Recent Renders */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-neutral-400 mb-3">
            Recent Renders
          </h3>

          {!renderJobs || renderJobs.length === 0 ? (
            <div className="text-center py-8 text-neutral-600">
              <p className="text-sm">No renders yet</p>
              <p className="text-xs mt-1">
                Start a render to see it here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {renderJobs.map((job) => (
                <RenderJobCard key={job._id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Render Job Card
 */
function RenderJobCard({ job }: { job: any }) {
  const getStatusIcon = () => {
    switch (job.status) {
      case "pending":
      case "rendering":
        return <LoaderIcon className="w-4 h-4 animate-spin text-amber-400" />;
      case "completed":
        return <CheckCircleIcon className="w-4 h-4 text-success-DEFAULT" />;
      case "error":
      case "cancelled":
        return <XCircleIcon className="w-4 h-4 text-error-DEFAULT" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case "pending":
      case "rendering":
        return "text-amber-400";
      case "completed":
        return "text-success-DEFAULT";
      case "error":
      case "cancelled":
        return "text-error-DEFAULT";
      default:
        return "text-neutral-500";
    }
  };

  return (
    <div className="card p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={cn("text-sm font-medium", getStatusColor())}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        </div>
        <span className="text-xs text-neutral-600">
          {formatTimestamp(job.createdAt)}
        </span>
      </div>

      {/* Progress Bar */}
      {(job.status === "pending" || job.status === "rendering") && (
        <div className="mb-2">
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${job.progress * 100}%` }}
            />
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            {Math.round(job.progress * 100)}% complete
          </p>
        </div>
      )}

      {/* Cost */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1 text-neutral-500">
          <DollarSignIcon className="w-3 h-3" />
          <span>
            {job.actualCost > 0
              ? `$${job.actualCost.toFixed(4)}`
              : `~$${job.estimatedCost.toFixed(4)}`}
          </span>
        </div>

        {job.status === "completed" && job.outputUrl && (
          <a
            href={job.outputUrl}
            download
            className="flex items-center space-x-1 text-primary-500 hover:text-primary-400"
          >
            <DownloadIcon className="w-3 h-3" />
            <span>Download</span>
          </a>
        )}
      </div>

      {/* Error */}
      {job.error && (
        <p className="text-xs text-error-DEFAULT mt-2">{job.error}</p>
      )}
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
