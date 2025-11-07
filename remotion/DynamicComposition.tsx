/**
 * Dynamic Remotion Composition
 *
 * This component renders a video composition from the Composition IR.
 * It's the bridge between our IR format and Remotion components.
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  Video,
  Audio,
  Img,
} from "remotion";
import type { CompositionIR, CompositionElement } from "@/types/composition-ir";

export interface DynamicCompositionProps {
  compositionIR: CompositionIR | null;
}

/**
 * Main composition component
 */
export const DynamicComposition: React.FC<DynamicCompositionProps> = ({
  compositionIR,
}) => {
  if (!compositionIR) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
          fontSize: 48,
        }}
      >
        No composition loaded
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {compositionIR.elements.map((element) => (
        <RenderElement key={element.id} element={element} />
      ))}
    </AbsoluteFill>
  );
};

/**
 * Render a single element based on its type
 */
const RenderElement: React.FC<{ element: CompositionElement }> = ({
  element,
}) => {
  const frame = useCurrentFrame();

  // Calculate animation values
  const animatedStyle = calculateAnimatedStyle(element, frame);

  return (
    <Sequence
      from={element.from}
      durationInFrames={element.durationInFrames}
      layout="none"
    >
      <div
        data-element-id={element.id}
        style={{
          position: "absolute",
          ...animatedStyle,
        }}
      >
        {renderElementContent(element)}
      </div>
    </Sequence>
  );
};

/**
 * Render element content based on type
 */
function renderElementContent(element: CompositionElement): React.ReactNode {
  switch (element.type) {
    case "video":
      return (
        <Video
          src={element.properties.src}
          style={{
            width: element.properties.width || "100%",
            height: element.properties.height || "auto",
          }}
          volume={element.properties.volume ?? 1}
        />
      );

    case "audio":
      return (
        <Audio
          src={element.properties.src}
          volume={element.properties.volume ?? 1}
        />
      );

    case "image":
      return (
        <Img
          src={element.properties.src}
          style={{
            width: element.properties.width || "100%",
            height: element.properties.height || "auto",
          }}
        />
      );

    case "text":
      return (
        <div
          style={{
            color: element.properties.color || "#fff",
            fontSize: element.properties.fontSize || 48,
            fontFamily: element.properties.fontFamily || "Arial",
            fontWeight: element.properties.fontWeight || "normal",
            textAlign: element.properties.textAlign || "left",
          }}
        >
          {element.properties.text}
        </div>
      );

    case "shape":
      if (element.properties.shape === "rectangle") {
        return (
          <div
            style={{
              width: element.properties.width || 100,
              height: element.properties.height || 100,
              backgroundColor: element.properties.fill || "#fff",
              borderRadius: element.properties.borderRadius || 0,
            }}
          />
        );
      }
      return null;

    default:
      return null;
  }
}

/**
 * Calculate animated styles from keyframes
 */
function calculateAnimatedStyle(
  element: CompositionElement,
  frame: number
): React.CSSProperties {
  const style: React.CSSProperties = {
    left: element.properties.x || 0,
    top: element.properties.y || 0,
    opacity: element.properties.opacity ?? 1,
  };

  // Apply animations
  if (element.animations) {
    for (const animation of element.animations) {
      const value = interpolateAnimation(animation.keyframes, frame, animation.easing);

      switch (animation.property) {
        case "opacity":
          style.opacity = value;
          break;
        case "scale":
          style.transform = `scale(${value})`;
          break;
        case "x":
          style.left = value;
          break;
        case "y":
          style.top = value;
          break;
        case "rotation":
          style.transform = `${style.transform || ""} rotate(${value}deg)`;
          break;
      }
    }
  }

  return style;
}

/**
 * Interpolate value from keyframes
 */
function interpolateAnimation(
  keyframes: Array<{ frame: number; value: number }>,
  currentFrame: number,
  easing?: string
): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].value;

  // Find surrounding keyframes
  let startKf = keyframes[0];
  let endKf = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (
      currentFrame >= keyframes[i].frame &&
      currentFrame <= keyframes[i + 1].frame
    ) {
      startKf = keyframes[i];
      endKf = keyframes[i + 1];
      break;
    }
  }

  // Interpolate
  return interpolate(
    currentFrame,
    [startKf.frame, endKf.frame],
    [startKf.value, endKf.value],
    {
      easing: easing as any,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
}
