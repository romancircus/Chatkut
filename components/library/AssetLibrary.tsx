"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FileVideoIcon, ImageIcon, MusicIcon, TrashIcon, LoaderIcon, CheckCircleIcon } from "lucide-react";
import { cn, formatFileSize, formatDuration } from "@/lib/utils";
import { HLSPlayer } from "../player/HLSPlayer";

interface AssetLibraryProps {
  projectId: Id<"projects">;
  onAssetSelect?: (assetId: Id<"assets">) => void;
}

export function AssetLibrary({ projectId, onAssetSelect }: AssetLibraryProps) {
  const [selectedAssetId, setSelectedAssetId] = useState<Id<"assets"> | null>(null);
  const [filterType, setFilterType] = useState<"all" | "video" | "audio" | "image">("all");

  const assets = useQuery(api.media.listAssets, { projectId });
  const deleteAsset = useAction(api.media.deleteAsset);

  const filteredAssets = assets?.filter((asset: any) =>
    filterType === "all" ? true : asset.type === filterType
  );

  const handleDelete = async (assetId: Id<"assets">, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this asset?")) {
      await deleteAsset({ assetId });
    }
  };

  const selectedAsset = assets?.find((a: any) => a._id === selectedAssetId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold mb-4">Asset Library</h2>

        {/* Filter Tabs */}
        <div className="flex space-x-2">
          {[
            { value: "all", label: "All" },
            { value: "video", label: "Videos" },
            { value: "audio", label: "Audio" },
            { value: "image", label: "Images" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value as typeof filterType)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                filterType === tab.value
                  ? "bg-primary-500 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {!filteredAssets || filteredAssets.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500">
            <div className="text-center">
              <p className="text-lg font-medium">No assets yet</p>
              <p className="text-sm mt-1">Upload some videos, images, or audio files to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAssets.map((asset: any) => (
              <AssetCard
                key={asset._id}
                asset={asset}
                isSelected={selectedAssetId === asset._id}
                onSelect={() => {
                  setSelectedAssetId(asset._id);
                  onAssetSelect?.(asset._id);
                }}
                onDelete={(e) => handleDelete(asset._id, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview Panel */}
      {selectedAsset && (
        <div className="border-t border-neutral-800 p-4">
          <h3 className="font-semibold mb-2">Preview</h3>
          {selectedAsset.type === "video" && selectedAsset.playbackUrl && (
            <HLSPlayer src={selectedAsset.playbackUrl} className="mb-4" />
          )}
          {selectedAsset.type === "image" && selectedAsset.playbackUrl && (
            <img
              src={selectedAsset.playbackUrl}
              alt={selectedAsset.filename}
              className="w-full rounded-lg mb-4"
            />
          )}
          <div className="space-y-1 text-sm">
            <p><span className="text-neutral-500">Filename:</span> {selectedAsset.filename}</p>
            {selectedAsset.fileSize && (
              <p><span className="text-neutral-500">Size:</span> {formatFileSize(selectedAsset.fileSize)}</p>
            )}
            {selectedAsset.duration && (
              <p><span className="text-neutral-500">Duration:</span> {formatDuration(selectedAsset.duration)}</p>
            )}
            <p><span className="text-neutral-500">Status:</span> <StatusBadge status={selectedAsset.status} /></p>
          </div>
        </div>
      )}
    </div>
  );
}

interface AssetCardProps {
  asset: any;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function AssetCard({ asset, isSelected, onSelect, onDelete }: AssetCardProps) {
  const getIcon = () => {
    switch (asset.type) {
      case "video":
        return <FileVideoIcon className="w-12 h-12 text-primary-500" />;
      case "audio":
        return <MusicIcon className="w-12 h-12 text-amber-500" />;
      case "image":
        return <ImageIcon className="w-12 h-12 text-success-DEFAULT" />;
      default:
        return <FileVideoIcon className="w-12 h-12 text-neutral-500" />;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "card cursor-pointer transition-all hover:scale-105 relative group",
        isSelected && "ring-2 ring-primary-500"
      )}
    >
      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 p-1 bg-neutral-950/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error-DEFAULT"
      >
        <TrashIcon className="w-4 h-4" />
      </button>

      {/* Thumbnail/Icon */}
      <div className="aspect-video bg-neutral-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          getIcon()
        )}
      </div>

      {/* Info */}
      <div>
        <p className="font-medium truncate text-sm">{asset.filename}</p>
        <div className="flex items-center justify-between mt-2">
          <StatusBadge status={asset.status} />
          {asset.duration && (
            <span className="text-xs text-neutral-500">{formatDuration(asset.duration)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    uploading: { color: "text-amber-400", icon: LoaderIcon, label: "Uploading" },
    processing: { color: "text-amber-400", icon: LoaderIcon, label: "Processing" },
    ready: { color: "text-success-DEFAULT", icon: CheckCircleIcon, label: "Ready" },
    error: { color: "text-error-DEFAULT", icon: TrashIcon, label: "Error" },
  };

  const { color, icon: Icon, label } = config[status as keyof typeof config] || config.error;

  return (
    <div className={cn("flex items-center space-x-1 text-xs", color)}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}
