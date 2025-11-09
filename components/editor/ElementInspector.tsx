"use client";

import { useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  FileVideoIcon,
  ImageIcon,
  MusicIcon,
  TypeIcon,
  Volume2Icon,
  MoveIcon,
  ScaleIcon,
  ClockIcon,
} from "lucide-react";
import type { CompositionElement } from "@/types/composition-ir";

interface ElementInspectorProps {
  compositionId: Id<"compositions">;
  elementId: string | null;
}

export function ElementInspector({ compositionId, elementId }: ElementInspectorProps) {
  const composition = useQuery(api.compositions.get, { compositionId });
  const updateElement = useMutation(api.compositions.updateElement).withOptimisticUpdate(
    (localStore, args) => {
      const currentComposition = localStore.getQuery(api.compositions.get, { compositionId });
      if (!currentComposition || !currentComposition.ir) return;

      const updatedElements = currentComposition.ir.elements.map((el: CompositionElement) => {
        if (el.id !== args.elementId) return el;

        // Apply changes optimistically
        const updatedElement = { ...el, ...args.changes };
        if (args.changes.properties) {
          updatedElement.properties = {
            ...el.properties,
            ...args.changes.properties,
          };
        }
        return updatedElement;
      });

      localStore.setQuery(
        api.compositions.get,
        { compositionId },
        {
          ...currentComposition,
          ir: {
            ...currentComposition.ir,
            elements: updatedElements,
          },
        }
      );
    }
  );

  const element = composition?.ir?.elements?.find((el: CompositionElement) => el.id === elementId);
  const fps = composition?.ir?.metadata?.fps || 30;

  // Debounce timers for different property types
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const debouncedUpdate = useCallback(
    (property: string, value: any, debounceMs: number = 300) => {
      // Clear existing timer for this property
      if (debounceTimers.current[property]) {
        clearTimeout(debounceTimers.current[property]);
      }

      // Set new timer
      debounceTimers.current[property] = setTimeout(async () => {
        const changes: any = {};
        if (property === "from" || property === "durationInFrames" || property === "label") {
          changes[property] = value;
        } else {
          changes.properties = { [property]: value };
        }

        try {
          await updateElement({ compositionId, elementId: element!.id, changes });
          console.log("[ElementInspector] Updated property:", property, value);
        } catch (error) {
          console.error("[ElementInspector] Error updating:", error);
        }
      }, debounceMs);
    },
    [compositionId, elementId, updateElement, element]
  );

  if (!element) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 p-4">
        <div className="text-center">
          <p className="font-medium">No element selected</p>
          <p className="text-sm mt-1">Click an element in the timeline to edit its properties</p>
        </div>
      </div>
    );
  }

  const handlePropertyChange = (property: string, value: any) => {
    // Different debounce times based on property type
    if (property === "label" || property === "text") {
      // Text inputs: longer debounce
      debouncedUpdate(property, value, 500);
    } else if (property === "from" || property === "durationInFrames") {
      // Timing: medium debounce
      debouncedUpdate(property, value, 300);
    } else {
      // Sliders, buttons: shorter debounce
      debouncedUpdate(property, value, 150);
    }
  };

  const getValue = (property: string) => {
    if (property === "from" || property === "durationInFrames" || property === "label") {
      return element[property];
    }
    return element.properties?.[property];
  };

  const framesToSeconds = (frames: number) => {
    return (frames / fps).toFixed(2);
  };

  const secondsToFrames = (seconds: number) => {
    return Math.round(seconds * fps);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-800 rounded-lg">
      {/* Header */}
      <div className="border-b border-neutral-800 p-4">
        <div className="flex items-center space-x-2">
          {getElementIcon(element.type)}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-200">Element Properties</h3>
            <p className="text-xs text-neutral-500">{element.type}</p>
          </div>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
        {/* Label */}
        <PropertyGroup label="Label" icon={<TypeIcon className="w-4 h-4" />}>
          <input
            type="text"
            value={getValue("label") || ""}
            onChange={(e) => handlePropertyChange("label", e.target.value)}
            placeholder="Element label"
            className="input-base w-full"
          />
        </PropertyGroup>

        {/* Timing */}
        <PropertyGroup label="Timing" icon={<ClockIcon className="w-4 h-4" />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Start Time (seconds)</label>
              <input
                type="number"
                step="0.1"
                value={framesToSeconds(getValue("from") || 0)}
                onChange={(e) => handlePropertyChange("from", secondsToFrames(parseFloat(e.target.value) || 0))}
                className="input-base w-full"
              />
              <p className="text-xs text-neutral-600 mt-1">
                Frame: {getValue("from") || 0}
              </p>
            </div>

            <div>
              <label className="text-xs text-neutral-500 mb-1 block">Duration (seconds)</label>
              <input
                type="number"
                step="0.1"
                value={framesToSeconds(getValue("durationInFrames") || 0)}
                onChange={(e) => handlePropertyChange("durationInFrames", secondsToFrames(parseFloat(e.target.value) || 0))}
                className="input-base w-full"
              />
              <p className="text-xs text-neutral-600 mt-1">
                Frames: {getValue("durationInFrames") || 0}
              </p>
            </div>
          </div>
        </PropertyGroup>

        {/* Video/Audio specific properties */}
        {(element.type === "video" || element.type === "audio") && (
          <>
            <PropertyGroup label="Volume" icon={<Volume2Icon className="w-4 h-4" />}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={getValue("volume") || 1}
                onChange={(e) => handlePropertyChange("volume", parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-neutral-500 mt-1 text-center">
                {Math.round((getValue("volume") || 1) * 100)}%
              </p>
            </PropertyGroup>

            <PropertyGroup label="Playback Rate" icon={<ScaleIcon className="w-4 h-4" />}>
              <input
                type="range"
                min="0.25"
                max="2"
                step="0.25"
                value={getValue("playbackRate") || 1}
                onChange={(e) => handlePropertyChange("playbackRate", parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-neutral-500 mt-1 text-center">
                {getValue("playbackRate") || 1}x
              </p>
            </PropertyGroup>
          </>
        )}

        {/* Text specific properties */}
        {element.type === "text" && (
          <>
            <PropertyGroup label="Text Content" icon={<TypeIcon className="w-4 h-4" />}>
              <textarea
                value={getValue("text") || ""}
                onChange={(e) => handlePropertyChange("text", e.target.value)}
                placeholder="Enter text"
                className="input-base w-full min-h-[80px]"
              />
            </PropertyGroup>

            <PropertyGroup label="Font Size" icon={<ScaleIcon className="w-4 h-4" />}>
              <input
                type="number"
                value={getValue("fontSize") || 48}
                onChange={(e) => handlePropertyChange("fontSize", parseInt(e.target.value) || 48)}
                className="input-base w-full"
              />
            </PropertyGroup>

            <PropertyGroup label="Color" icon={<TypeIcon className="w-4 h-4" />}>
              <input
                type="color"
                value={getValue("color") || "#ffffff"}
                onChange={(e) => handlePropertyChange("color", e.target.value)}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </PropertyGroup>

            <PropertyGroup label="Text Align" icon={<MoveIcon className="w-4 h-4" />}>
              <div className="flex space-x-2">
                {["left", "center", "right"].map((align) => (
                  <button
                    key={align}
                    onClick={() => handlePropertyChange("textAlign", align)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                      getValue("textAlign") === align
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    )}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </PropertyGroup>
          </>
        )}

        {/* Image specific properties */}
        {element.type === "image" && (
          <>
            <PropertyGroup label="Opacity" icon={<ScaleIcon className="w-4 h-4" />}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={getValue("opacity") || 1}
                onChange={(e) => handlePropertyChange("opacity", parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-neutral-500 mt-1 text-center">
                {Math.round((getValue("opacity") || 1) * 100)}%
              </p>
            </PropertyGroup>

            <PropertyGroup label="Fit" icon={<MoveIcon className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-2">
                {["cover", "contain", "fill", "none"].map((fit) => (
                  <button
                    key={fit}
                    onClick={() => handlePropertyChange("fit", fit)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                      getValue("fit") === fit
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    )}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </PropertyGroup>
          </>
        )}

        {/* Source URL (read-only) */}
        {element.properties?.src && (
          <PropertyGroup label="Source" icon={<FileVideoIcon className="w-4 h-4" />}>
            <input
              type="text"
              value={element.properties.src}
              readOnly
              className="input-base w-full text-neutral-500 text-xs"
            />
          </PropertyGroup>
        )}
      </div>
    </div>
  );
}

function PropertyGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center space-x-2 mb-2">
        <div className="text-neutral-400">{icon}</div>
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          {label}
        </h4>
      </div>
      {children}
    </div>
  );
}

function getElementIcon(type: string) {
  switch (type) {
    case "video":
      return <FileVideoIcon className="w-5 h-5 text-primary-500" />;
    case "audio":
      return <MusicIcon className="w-5 h-5 text-amber-500" />;
    case "image":
      return <ImageIcon className="w-5 h-5 text-success-DEFAULT" />;
    case "text":
      return <TypeIcon className="w-5 h-5 text-blue-500" />;
    default:
      return <FileVideoIcon className="w-5 h-5 text-neutral-500" />;
  }
}
