/**
 * IR to Remotion Code Compiler
 *
 * Converts Composition IR to valid Remotion React code using templates.
 * This is deterministic, fast, and free (unlike LLM-based generation).
 *
 * Why template-based instead of LLM:
 * - LLM: $0.01-0.10 per compilation, 2-5 seconds, non-deterministic
 * - Template: $0.00, <100ms, deterministic
 */

import type {
  CompositionIR,
  CompositionElement,
  Animation,
  Keyframe,
} from "@/types/composition-ir";

/**
 * Compile IR to Remotion code
 */
export function compileIRToRemotionCode(ir: CompositionIR): string {
  const componentName = `Composition_${sanitizeId(ir.id)}`;
  const elements = ir.elements.map((el) => renderElement(el, ir.metadata.fps)).join("\n      ");

  const code = `/**
 * Auto-generated Remotion composition
 * DO NOT EDIT - Generated from Composition IR
 * ID: ${ir.id}
 * Version: ${ir.version}
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  Audio,
  Img,
  interpolate,
  useCurrentFrame,
} from "remotion";

export const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      ${elements}
    </AbsoluteFill>
  );
};

${renderHelpers(ir)}
`;

  return code;
}

/**
 * Render a single element
 */
function renderElement(element: CompositionElement, fps: number): string {
  const animations = element.animations || [];
  const animationProps = animations.length > 0 ? renderAnimations(element, animations) : "";

  return `<Sequence
        from={${element.from}}
        durationInFrames={${element.durationInFrames}}
        data-element-id="${element.id}"
        ${element.label ? `data-label="${escapeString(element.label)}"` : ""}
      >
        ${renderElementContent(element, animationProps)}
      </Sequence>`;
}

/**
 * Render element content based on type
 */
function renderElementContent(element: CompositionElement, animationProps: string): string {
  switch (element.type) {
    case "video":
      return renderVideoElement(element, animationProps);
    case "audio":
      return renderAudioElement(element, animationProps);
    case "text":
      return renderTextElement(element, animationProps);
    case "image":
      return renderImageElement(element, animationProps);
    case "sequence":
      return renderSequenceElement(element, animationProps);
    case "shape":
      return renderShapeElement(element, animationProps);
    default:
      return `{/* Unknown element type: ${element.type} */}`;
  }
}

/**
 * Render video element
 */
function renderVideoElement(element: CompositionElement, animationProps: string): string {
  const { src, volume = 1, playbackRate = 1, startFrom = 0, endAt } = element.properties;

  const style = animationProps ? `style={{ ${animationProps} }}` : "";

  return `<Video
          src="${escapeString(src)}"
          volume={${volume}}
          playbackRate={${playbackRate}}
          startFrom={${startFrom}}
          ${endAt ? `endAt={${endAt}}` : ""}
          ${style}
        />`;
}

/**
 * Render audio element
 */
function renderAudioElement(element: CompositionElement, animationProps: string): string {
  const { src, volume = 1, playbackRate = 1, startFrom = 0, endAt } = element.properties;

  return `<Audio
          src="${escapeString(src)}"
          volume={${volume}}
          playbackRate={${playbackRate}}
          startFrom={${startFrom}}
          ${endAt ? `endAt={${endAt}}` : ""}
        />`;
}

/**
 * Render text element
 */
function renderTextElement(element: CompositionElement, animationProps: string): string {
  const {
    text,
    fontFamily = "Arial",
    fontSize = 48,
    fontWeight = "normal",
    color = "#fff",
    backgroundColor = "transparent",
    textAlign = "center",
    x = 0,
    y = 0,
    width,
    height,
    padding = 20,
    borderRadius = 0,
  } = element.properties;

  const style = `
          position: "absolute",
          left: ${x},
          top: ${y},
          ${width ? `width: ${width},` : ""}
          ${height ? `height: ${height},` : ""}
          fontFamily: "${escapeString(fontFamily)}",
          fontSize: ${fontSize},
          fontWeight: "${fontWeight}",
          color: "${color}",
          backgroundColor: "${backgroundColor}",
          textAlign: "${textAlign}",
          padding: ${padding},
          borderRadius: ${borderRadius},
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ${animationProps ? animationProps + "," : ""}
  `.trim();

  return `<div style={{ ${style} }}>
          {${JSON.stringify(text)}}
        </div>`;
}

/**
 * Render image element
 */
function renderImageElement(element: CompositionElement, animationProps: string): string {
  const { src, x = 0, y = 0, width, height, fit = "contain", opacity = 1 } = element.properties;

  const style = `
          position: "absolute",
          left: ${x},
          top: ${y},
          ${width ? `width: ${width},` : ""}
          ${height ? `height: ${height},` : ""}
          objectFit: "${fit}",
          opacity: ${opacity},
          ${animationProps ? animationProps + "," : ""}
  `.trim();

  return `<Img
          src="${escapeString(src)}"
          style={{ ${style} }}
        />`;
}

/**
 * Render sequence (nested container)
 */
function renderSequenceElement(element: CompositionElement, animationProps: string): string {
  const children = element.children || [];
  const childElements = children.map((child) => renderElement(child, 30)).join("\n        ");

  const style = animationProps ? `style={{ ${animationProps} }}` : "";

  return `<div ${style}>
          ${childElements}
        </div>`;
}

/**
 * Render shape element
 */
function renderShapeElement(element: CompositionElement, animationProps: string): string {
  const {
    shape = "rectangle",
    width = 100,
    height = 100,
    x = 0,
    y = 0,
    fill = "#fff",
    stroke = "transparent",
    strokeWidth = 0,
    borderRadius = 0,
  } = element.properties;

  const style = `
          position: "absolute",
          left: ${x},
          top: ${y},
          width: ${width},
          height: ${height},
          backgroundColor: "${fill}",
          border: "${strokeWidth}px solid ${stroke}",
          ${shape === "circle" ? `borderRadius: "50%",` : `borderRadius: ${borderRadius},`}
          ${animationProps ? animationProps + "," : ""}
  `.trim();

  return `<div style={{ ${style} }} />`;
}

/**
 * Render animations for an element
 */
function renderAnimations(element: CompositionElement, animations: Animation[]): string {
  const frame = "frame"; // Current frame variable
  const animationStyles: string[] = [];

  for (const animation of animations) {
    const { property, keyframes, easing = "linear" } = animation;

    if (keyframes.length < 2) continue;

    // Sort keyframes by frame
    const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

    // Generate interpolate() calls
    const interpolateCode = generateInterpolate(
      frame,
      sortedKeyframes,
      easing,
      element.from
    );

    animationStyles.push(`${property}: ${interpolateCode}`);
  }

  return animationStyles.join(",\n          ");
}

/**
 * Generate interpolate() code for animation
 */
function generateInterpolate(
  frameVar: string,
  keyframes: Keyframe[],
  easing: string,
  elementStartFrame: number
): string {
  const inputRange = keyframes.map((kf) => kf.frame - elementStartFrame);
  const outputRange = keyframes.map((kf) =>
    typeof kf.value === "string" ? `"${kf.value}"` : kf.value
  );

  const easingMap: Record<string, string> = {
    linear: "easeInOut",
    "ease-in": "easeIn",
    "ease-out": "easeOut",
    "ease-in-out": "easeInOut",
    spring: "easeInOut", // Spring not directly supported, use easeInOut
  };

  const easingFunc = easingMap[easing] || "easeInOut";

  return `interpolate(${frameVar}, [${inputRange.join(", ")}], [${outputRange.join(", ")}], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.${easingFunc} })`;
}

/**
 * Render helper components if needed
 */
function renderHelpers(ir: CompositionIR): string {
  // Currently no helpers needed, but this is where we'd add custom components
  return "";
}

/**
 * Sanitize ID for use as component name
 */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Escape string for safe embedding in code
 */
function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Validate compiled code (basic check)
 */
export function validateCompiledCode(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for basic syntax issues
  if (!code.includes("import")) {
    errors.push("Missing imports");
  }

  if (!code.includes("export const")) {
    errors.push("Missing export");
  }

  if (!code.includes("<AbsoluteFill")) {
    errors.push("Missing AbsoluteFill wrapper");
  }

  // Check for unclosed tags (simple heuristic)
  const openTags = (code.match(/<[A-Z][a-zA-Z]*\s/g) || []).length;
  const closeTags = (code.match(/<\/[A-Z][a-zA-Z]*>/g) || []).length;
  const selfClosingTags = (code.match(/\/>/g) || []).length;

  if (openTags !== closeTags + selfClosingTags) {
    errors.push("Possible unclosed tags");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format code with prettier (optional, requires prettier installed)
 */
export async function formatCode(code: string): Promise<string> {
  try {
    // Dynamic import to avoid bundling prettier if not used
    const prettier = await import("prettier");
    return prettier.format(code, {
      parser: "typescript",
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
    });
  } catch (error) {
    // Prettier not installed or error formatting, return original code
    console.warn("Prettier formatting failed:", error);
    return code;
  }
}
