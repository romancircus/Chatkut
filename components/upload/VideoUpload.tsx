"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import * as tus from "tus-js-client";
import { UploadIcon, FileVideoIcon, LoaderIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";

interface VideoUploadProps {
  projectId: Id<"projects">;
  onUploadComplete?: (assetId: Id<"assets">) => void;
}

interface UploadProgress {
  filename: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
}

export function VideoUpload({ projectId, onUploadComplete }: VideoUploadProps) {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());

  const requestUploadUrl = useAction(api.media.requestStreamUploadUrl);
  const updateStreamId = useMutation(api.media.updateAssetStreamId);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const uploadId = `${file.name}-${Date.now()}`;

      // Initialize upload progress
      setUploads((prev) => new Map(prev).set(uploadId, {
        filename: file.name,
        progress: 0,
        status: "uploading",
      }));

      try {
        // Request TUS endpoint from Convex
        console.log("[VideoUpload] Requesting TUS endpoint for:", file.name);
        const { uploadUrl, assetId } = await requestUploadUrl({
          projectId,
          filename: file.name,
          fileSize: file.size,
        });

        console.log("[VideoUpload] Got TUS upload URL:", uploadUrl);

        // Get Cloudflare API token from environment
        const CLOUDFLARE_STREAM_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN;

        if (!CLOUDFLARE_STREAM_TOKEN) {
          throw new Error("Missing NEXT_PUBLIC_CLOUDFLARE_STREAM_TOKEN");
        }

        // Start TUS upload with correct configuration based on Cloudflare docs
        const upload = new tus.Upload(file, {
          endpoint: uploadUrl, // Use the uploadUrl from Cloudflare
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_STREAM_TOKEN}`, // Required for Cloudflare
          },
          chunkSize: 50 * 1024 * 1024, // 50 MB chunks (Cloudflare requires min 5 MB)
          retryDelays: [0, 3000, 5000, 10000, 20000], // Retry delays from Cloudflare docs
          metadata: {
            name: file.name, // Use 'name' not 'filename'
            filetype: file.type,
          },
          uploadSize: file.size, // Explicitly set upload size
          onError: (error) => {
            console.error("[VideoUpload] Upload failed:", error);
            setUploads((prev) => {
              const newMap = new Map(prev);
              newMap.set(uploadId, {
                filename: file.name,
                progress: 0,
                status: "error",
                error: error.message,
              });
              return newMap;
            });
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
            console.log(`[VideoUpload] Progress: ${progress}% (${bytesUploaded}/${bytesTotal})`);
            setUploads((prev) => {
              const newMap = new Map(prev);
              const current = newMap.get(uploadId);
              if (current) {
                newMap.set(uploadId, {
                  ...current,
                  progress,
                });
              }
              return newMap;
            });
          },
          onSuccess: () => {
            console.log("[VideoUpload] Upload finished successfully!");
            setUploads((prev) => {
              const newMap = new Map(prev);
              newMap.set(uploadId, {
                filename: file.name,
                progress: 100,
                status: "processing",
              });
              return newMap;
            });

            // Cloudflare Stream will send webhook when ready
            // For now, mark as complete after a delay
            setTimeout(() => {
              setUploads((prev) => {
                const newMap = new Map(prev);
                newMap.set(uploadId, {
                  filename: file.name,
                  progress: 100,
                  status: "complete",
                });
                return newMap;
              });
              onUploadComplete?.(assetId);
            }, 2000);
          },
          onAfterResponse: (req, res) => {
            // Capture stream-media-id from response headers (Cloudflare-specific)
            return new Promise((resolve) => {
              const streamMediaId = res.getHeader("stream-media-id");
              if (streamMediaId) {
                console.log("[VideoUpload] Got stream-media-id:", streamMediaId);
                // Update the asset with the stream ID
                updateStreamId({ assetId, streamId: streamMediaId });
              }
              resolve();
            });
          },
        });

        // Start the upload
        console.log("[VideoUpload] Starting TUS upload...");
        upload.start();
      } catch (error) {
        console.error("[VideoUpload] Failed to request upload URL:", error);
        setUploads((prev) => {
          const newMap = new Map(prev);
          newMap.set(uploadId, {
            filename: file.name,
            progress: 0,
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed",
          });
          return newMap;
        });
      }
    }
  }, [projectId, requestUploadUrl, updateStreamId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"],
    },
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    multiple: true,
  });

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary-500 bg-primary-500/10"
            : "border-neutral-700 hover:border-neutral-600"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-4">
          <UploadIcon className="w-12 h-12 text-neutral-500" />
          <div>
            <p className="text-lg font-medium">
              {isDragActive ? "Drop videos here" : "Upload videos"}
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-neutral-600 mt-2">
              Supports MP4, MOV, AVI, MKV, WebM • Max 5GB
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress List */}
      {uploads.size > 0 && (
        <div className="space-y-2">
          {Array.from(uploads.entries()).map(([id, upload]) => (
            <UploadProgressItem key={id} upload={upload} />
          ))}
        </div>
      )}
    </div>
  );
}

function UploadProgressItem({ upload }: { upload: UploadProgress }) {
  const { filename, progress, status, error } = upload;

  return (
    <div className="card p-4">
      <div className="flex items-center space-x-3">
        <FileVideoIcon className="w-8 h-8 text-primary-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{filename}</p>
          <div className="flex items-center space-x-2 mt-1">
            {status === "uploading" && (
              <>
                <div className="flex-1 bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm text-neutral-500">{progress}%</span>
              </>
            )}
            {status === "processing" && (
              <div className="flex items-center space-x-2 text-amber-400">
                <LoaderIcon className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
            {status === "complete" && (
              <div className="flex items-center space-x-2 text-success-DEFAULT">
                <CheckCircleIcon className="w-4 h-4" />
                <span className="text-sm">Upload complete</span>
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center space-x-2 text-error-DEFAULT">
                <XCircleIcon className="w-4 h-4" />
                <span className="text-sm">{error || "Upload failed"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
