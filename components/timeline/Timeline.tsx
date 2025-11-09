"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  TrashIcon,
  CopyIcon,
  MoveVerticalIcon,
  GripVerticalIcon,
  FileVideoIcon,
  ImageIcon,
  MusicIcon,
  TypeIcon,
} from "lucide-react";
import type { CompositionElement } from "@/types/composition-ir";

interface TimelineProps {
  compositionId: Id<"compositions">;
  onElementSelect?: (elementId: string) => void;
  selectedElementId?: string | null;
}

export function Timeline({ compositionId, onElementSelect, selectedElementId }: TimelineProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const composition = useQuery(api.compositions.get, { compositionId });
  const addElement = useMutation(api.compositions.addElement).withOptimisticUpdate(
    (localStore, args) => {
      // Optimistically show new element in timeline immediately
      const currentComposition = localStore.getQuery(api.compositions.get, {
        compositionId: args.compositionId
      });
      if (!currentComposition?.ir) return;

      // We don't have the new element data yet, so we can't add it optimistically
      // Just show a loading state if needed
    }
  );

  const deleteElement = useMutation(api.compositions.deleteElement).withOptimisticUpdate(
    (localStore, args) => {
      // Optimistically remove element from timeline immediately
      const currentComposition = localStore.getQuery(api.compositions.get, {
        compositionId: args.compositionId
      });
      if (!currentComposition?.ir) return;

      localStore.setQuery(
        api.compositions.get,
        { compositionId: args.compositionId },
        {
          ...currentComposition,
          ir: {
            ...currentComposition.ir,
            elements: currentComposition.ir.elements.filter(
              (el: any) => el.id !== args.elementId
            ),
          },
        }
      );
    }
  );

  const reorderElements = useMutation(api.compositions.reorderElements).withOptimisticUpdate(
    (localStore, args) => {
      // Optimistically reorder elements immediately
      const currentComposition = localStore.getQuery(api.compositions.get, {
        compositionId: args.compositionId
      });
      if (!currentComposition?.ir) return;

      const elementMap = new Map(
        currentComposition.ir.elements.map((el: any) => [el.id, el])
      );
      const reorderedElements = args.elementIds
        .map((id) => elementMap.get(id))
        .filter(Boolean);

      localStore.setQuery(
        api.compositions.get,
        { compositionId: args.compositionId },
        {
          ...currentComposition,
          ir: {
            ...currentComposition.ir,
            elements: reorderedElements,
          },
        }
      );
    }
  );

  const elements: CompositionElement[] = composition?.ir?.elements || [];
  const fps = composition?.ir?.metadata?.fps || 30;

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    setDragOverIndex(null);

    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      const { assetId } = JSON.parse(data);
      console.log("[Timeline] Asset dropped:", assetId);

      await addElement({ compositionId, assetId });
      console.log("[Timeline] Element added to composition");
    } catch (error) {
      console.error("[Timeline] Error handling drop:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
    setDragOverIndex(null);
  };

  const handleDeleteElement = async (elementId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this element from the timeline?")) {
      await deleteElement({ compositionId, elementId });
    }
  };

  const handleDuplicateElement = async (element: CompositionElement, e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement duplicate
    console.log("[Timeline] Duplicate element:", element.id);
  };

  const framesToSeconds = (frames: number) => {
    const seconds = frames / fps;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-800 rounded-lg">
      {/* Timeline Header */}
      <div className="border-b border-neutral-800 p-3">
        <h3 className="text-sm font-semibold text-neutral-300">Timeline</h3>
        <p className="text-xs text-neutral-500 mt-1">
          {elements.length} element{elements.length !== 1 ? "s" : ""} • {fps} FPS
        </p>
      </div>

      {/* Timeline Content */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin p-3 relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {elements.length === 0 ? (
          <div
            className={cn(
              "flex items-center justify-center h-full border-2 border-dashed rounded-lg transition-colors",
              isDraggingOver ? "border-primary-500 bg-primary-500/10" : "border-neutral-700"
            )}
          >
            <div className="text-center">
              <p className="text-neutral-500 font-medium">Drop assets here</p>
              <p className="text-xs text-neutral-600 mt-1">
                or click the + button on any asset
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {elements.map((element, index) => (
              <TimelineElement
                key={element.id}
                element={element}
                index={index}
                fps={fps}
                isSelected={selectedElementId === element.id}
                onSelect={() => onElementSelect?.(element.id)}
                onDelete={(e) => handleDeleteElement(element.id, e)}
                onDuplicate={(e) => handleDuplicateElement(element, e)}
                framesToSeconds={framesToSeconds}
              />
            ))}
          </div>
        )}

        {/* Drop indicator overlay */}
        {isDraggingOver && elements.length > 0 && (
          <div className="absolute inset-0 border-2 border-primary-500 bg-primary-500/5 rounded-lg pointer-events-none" />
        )}
      </div>
    </div>
  );
}

interface TimelineElementProps {
  element: CompositionElement;
  index: number;
  fps: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  framesToSeconds: (frames: number) => string;
}

function TimelineElement({
  element,
  index,
  fps,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  framesToSeconds,
}: TimelineElementProps) {
  const getIcon = () => {
    switch (element.type) {
      case "video":
        return <FileVideoIcon className="w-4 h-4 text-primary-500" />;
      case "audio":
        return <MusicIcon className="w-4 h-4 text-amber-500" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-success-DEFAULT" />;
      case "text":
        return <TypeIcon className="w-4 h-4 text-blue-500" />;
      default:
        return <FileVideoIcon className="w-4 h-4 text-neutral-500" />;
    }
  };

  const startTime = framesToSeconds(element.from);
  const endTime = framesToSeconds(element.from + element.durationInFrames);
  const duration = framesToSeconds(element.durationInFrames);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group relative flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "bg-primary-500/20 border-primary-500 ring-2 ring-primary-500/50"
          : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800"
      )}
    >
      {/* Drag Handle */}
      <div className="cursor-grab active:cursor-grabbing opacity-50 group-hover:opacity-100">
        <GripVerticalIcon className="w-4 h-4 text-neutral-500" />
      </div>

      {/* Icon */}
      <div>{getIcon()}</div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {element.label || `${element.type} ${index + 1}`}
        </p>
        <p className="text-xs text-neutral-500">
          {startTime} → {endTime} ({duration})
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDuplicate}
          className="p-1 rounded hover:bg-neutral-700 transition-colors"
          title="Duplicate"
        >
          <CopyIcon className="w-3.5 h-3.5 text-neutral-400" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-900/50 transition-colors"
          title="Delete"
        >
          <TrashIcon className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </div>
  );
}
