"use client";

import { Player } from "@remotion/player";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { LoaderIcon, AlertCircleIcon } from "lucide-react";
import { useMemo } from "react";

interface RemotionPreviewProps {
  compositionId: Id<"compositions">;
  className?: string;
}

/**
 * Remotion Player Integration
 *
 * Renders a live preview of the composition using @remotion/player.
 * Dynamically generates the Remotion component from the composition IR.
 */
export function RemotionPreview({
  compositionId,
  className,
}: RemotionPreviewProps) {
  const composition = useQuery(api.compositions.get, { compositionId });

  // Generate Remotion component from IR
  const RemotionComponent = useMemo(() => {
    if (!composition?.ir) return null;

    try {
      return generateRemotionComponent(composition.ir);
    } catch (error) {
      console.error("Failed to generate Remotion component:", error);
      return null;
    }
  }, [composition?.ir]);

  if (!composition) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-900 rounded-lg">
        <LoaderIcon className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!RemotionComponent) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-neutral-900 rounded-lg text-neutral-500">
        <AlertCircleIcon className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">Preview unavailable</p>
        <p className="text-sm mt-1">
          Unable to generate preview from composition
        </p>
      </div>
    );
  }

  const { metadata } = composition.ir;

  return (
    <div className={className}>
      <Player
        component={RemotionComponent}
        durationInFrames={metadata.durationInFrames}
        fps={metadata.fps}
        compositionWidth={metadata.width}
        compositionHeight={metadata.height}
        controls
        style={{
          width: "100%",
          aspectRatio: `${metadata.width}/${metadata.height}`,
        }}
        inputProps={{
          composition: composition.ir,
        }}
      />
    </div>
  );
}

/**
 * Generate a Remotion component from Composition IR
 *
 * This creates a React component that Remotion can render.
 * In production, this would use the AI-generated code from convex/ai.ts
 */
function generateRemotionComponent(ir: any) {
  const { metadata, elements } = ir;

  return function DynamicComposition() {
    const { useCurrentFrame, interpolate, Sequence, AbsoluteFill } =
      require("remotion");

    const frame = useCurrentFrame();

    return (
      <AbsoluteFill
        style={{
          backgroundColor: metadata.backgroundColor || "#000000",
        }}
      >
        {elements.map((element: any) => {
          // Calculate if element is visible at current frame
          const isVisible =
            frame >= element.from &&
            frame < element.from + element.durationInFrames;

          if (!isVisible) return null;

          return (
            <Sequence
              key={element.id}
              from={element.from}
              durationInFrames={element.durationInFrames}
            >
              <ElementRenderer element={element} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    );
  };
}

/**
 * Render individual elements based on type
 */
function ElementRenderer({ element }: { element: any }) {
  const { useCurrentFrame, interpolate, OffthreadVideo, Audio, Img, AbsoluteFill } =
    require("remotion");

  const frame = useCurrentFrame();
  const { properties, animations, type } = element;

  // Calculate animated values - support multiple animations
  const animatedStyle: any = {};
  const transforms: string[] = [];

  if (animations && Array.isArray(animations)) {
    for (const animation of animations) {
      const value = interpolateKeyframes(
        frame,
        animation.keyframes,
        animation.easing
      );

      switch (animation.property) {
        case "opacity":
          animatedStyle.opacity = value;
          break;
        case "scale":
          transforms.push(`scale(${value})`);
          break;
        case "scaleX":
          transforms.push(`scaleX(${value})`);
          break;
        case "scaleY":
          transforms.push(`scaleY(${value})`);
          break;
        case "rotation":
          transforms.push(`rotate(${value}deg)`);
          break;
        case "rotateX":
          transforms.push(`rotateX(${value}deg)`);
          break;
        case "rotateY":
          transforms.push(`rotateY(${value}deg)`);
          break;
        case "translateX":
          transforms.push(`translateX(${value}px)`);
          break;
        case "translateY":
          transforms.push(`translateY(${value}px)`);
          break;
        case "skewX":
          transforms.push(`skewX(${value}deg)`);
          break;
        case "skewY":
          transforms.push(`skewY(${value}deg)`);
          break;
        case "x":
          // Legacy support for x/y properties
          animatedStyle.left = value;
          break;
        case "y":
          animatedStyle.top = value;
          break;
      }
    }

    // Combine all transforms
    if (transforms.length > 0) {
      animatedStyle.transform = transforms.join(" ");
    }
  }

  const baseStyle = {
    position: "absolute" as const,
    top: properties.y || 0,
    left: properties.x || 0,
    width: properties.width || "auto",
    height: properties.height || "auto",
    ...animatedStyle,
  };

  // Render based on element type
  switch (type) {
    case "video":
      return (
        <OffthreadVideo
          src={properties.src}
          style={baseStyle}
          volume={properties.volume ?? 1}
          playbackRate={properties.playbackRate ?? 1}
          startFrom={properties.startFrom ?? 0}
          endAt={properties.endAt}
          data-element-id={element.id}
        />
      );

    case "audio":
      return (
        <Audio
          src={properties.src}
          volume={properties.volume ?? 1}
          playbackRate={properties.playbackRate ?? 1}
          startFrom={properties.startFrom ?? 0}
          endAt={properties.endAt}
          data-element-id={element.id}
        />
      );

    case "image":
      return (
        <Img
          src={properties.src}
          style={baseStyle}
          data-element-id={element.id}
        />
      );

    case "text":
      return (
        <div
          style={{
            ...baseStyle,
            color: properties.color || "#ffffff",
            fontSize: properties.fontSize || 48,
            fontFamily: properties.fontFamily || "sans-serif",
            fontWeight: properties.fontWeight || "normal",
            textAlign: properties.textAlign || "left",
          }}
          data-element-id={element.id}
        >
          {properties.text}
        </div>
      );

    case "shape":
      return (
        <div
          style={{
            ...baseStyle,
            backgroundColor: properties.fill || "#ffffff",
            borderRadius: properties.borderRadius || 0,
          }}
          data-element-id={element.id}
        />
      );

    default:
      return null;
  }
}

/**
 * Interpolate between keyframes
 */
function interpolateKeyframes(
  frame: number,
  keyframes: Array<{ frame: number; value: number }>,
  easing?: string
): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].value;

  // Find surrounding keyframes
  let startKeyframe = keyframes[0];
  let endKeyframe = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (frame >= keyframes[i].frame && frame <= keyframes[i + 1].frame) {
      startKeyframe = keyframes[i];
      endKeyframe = keyframes[i + 1];
      break;
    }
  }

  // If before first keyframe
  if (frame < startKeyframe.frame) {
    return startKeyframe.value;
  }

  // If after last keyframe
  if (frame > endKeyframe.frame) {
    return endKeyframe.value;
  }

  const { interpolate } = require("remotion");

  // Interpolate between keyframes
  return interpolate(
    frame,
    [startKeyframe.frame, endKeyframe.frame],
    [startKeyframe.value, endKeyframe.value],
    {
      easing: easing === "ease-in" ? "easeIn" : easing === "ease-out" ? "easeOut" : undefined,
    }
  );
}
