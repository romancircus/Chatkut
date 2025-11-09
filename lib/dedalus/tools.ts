/**
 * Composition Editing Tools for Claude
 *
 * These tool definitions enable Claude to directly manipulate video compositions
 * using the Anthropic Tool Use API.
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use
 */

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definitions for composition editing
 * Each tool maps to a Convex mutation that modifies the composition IR
 */
export const COMPOSITION_TOOLS: Anthropic.Tool[] = [
  {
    name: "add_video_element",
    description: `Add a video clip from uploaded assets to the timeline. Use this when the user wants to add, place, or insert a video.

Examples:
- "Add the bigfoot video"
- "Put the intro clip at the beginning"
- "Insert the main footage after 5 seconds"

The video will be added to the timeline with HLS playback for preview and MP4 download URL for rendering.`,
    input_schema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "ID of the uploaded video asset. Must match an asset._id from the available assets list provided in the system context."
        },
        from: {
          type: "number",
          description: "Start frame (frame number where video begins). Defaults to 0 if not specified. Calculate using: seconds * fps (e.g., 5 seconds at 30fps = 150 frames)."
        },
        durationInFrames: {
          type: "number",
          description: "Duration in frames. If not specified, uses the video's natural duration. For trimming, set this lower than the video duration."
        },
        label: {
          type: "string",
          description: "Human-readable label for this element (e.g., 'Intro clip', 'Main footage', 'Bigfoot video'). Helps identify the element in future operations."
        }
      },
      required: ["assetId"]
    }
  },
  {
    name: "add_text_element",
    description: `Add text overlay to the composition. Use for titles, captions, subtitles, or any on-screen text.

Examples:
- "Add text saying 'Big Foot spotted!'"
- "Put a title at the top saying 'Welcome'"
- "Add subtitles at the bottom"

Position reference (for 1920x1080 composition):
- Top: y=100
- Center: x=960, y=540
- Bottom: y=980`,
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text content to display"
        },
        from: {
          type: "number",
          description: "Start frame when text appears. Calculate using: seconds * fps"
        },
        durationInFrames: {
          type: "number",
          description: "How long text appears on screen (in frames)"
        },
        x: {
          type: "number",
          description: "Horizontal position in pixels. For 1920px width: 0=left edge, 960=center, 1920=right edge. Defaults to 960 (center)."
        },
        y: {
          type: "number",
          description: "Vertical position in pixels. For 1080px height: 0=top edge, 540=center, 1080=bottom edge. Defaults to 540 (center)."
        },
        fontSize: {
          type: "number",
          description: "Font size in pixels. Typical values: 24 (small), 48 (medium), 72 (large), 96 (very large). Defaults to 48."
        },
        color: {
          type: "string",
          description: "Text color as hex code (e.g., '#ffffff' for white, '#000000' for black, '#ff0000' for red). Defaults to '#ffffff' (white)."
        },
        fontWeight: {
          type: "string",
          description: "Font weight: 'normal', 'bold', or numeric values 100-900. Defaults to 'normal'."
        },
        backgroundColor: {
          type: "string",
          description: "Optional background color behind text (hex code). Useful for readability."
        },
        label: {
          type: "string",
          description: "Human-readable label for this text element (e.g., 'Title', 'Subtitle', 'Big Foot caption')."
        }
      },
      required: ["text", "from", "durationInFrames"]
    }
  },
  {
    name: "add_animation",
    description: `Animate an element's properties over time. Use for zoom, fade, slide, rotate, and other motion effects.

Examples:
- "Zoom into the gorilla" → scale animation from 1.0 to 2.5
- "Fade in the text" → opacity animation from 0 to 1
- "Slide the video from left" → translateX animation
- "Rotate the logo 360 degrees" → rotation animation

Animation properties:
- opacity: 0 (invisible) to 1 (fully visible) for fades
- scale: 1.0 (normal size), 0.5 (half), 2.0 (double) for zoom
- scaleX/scaleY: Independent horizontal/vertical scaling
- x/y: Move element position
- rotation: Degrees (0-360) for spinning
- translateX/translateY: Slide in pixels

Keyframes are relative to element's start frame.`,
    input_schema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "ID of the element to animate. Use the element ID from the composition context (shown as 'ID: elem_xxx' in the elements list)."
        },
        property: {
          type: "string",
          enum: ["opacity", "scale", "scaleX", "scaleY", "x", "y", "rotation", "rotateX", "rotateY", "translateX", "translateY", "skewX", "skewY"],
          description: "Property to animate. 'scale' for zoom, 'opacity' for fade, 'rotation' for spin, 'x'/'y' for position, 'translateX'/'translateY' for sliding."
        },
        keyframes: {
          type: "array",
          description: "Array of keyframes defining the animation timeline. Each keyframe specifies a frame number (relative to element start) and the property value at that frame. Minimum 2 keyframes required.",
          items: {
            type: "object",
            properties: {
              frame: {
                type: "number",
                description: "Frame number relative to element's start frame. 0 = element start, 30 = 1 second later at 30fps, 90 = 3 seconds later."
              },
              value: {
                type: "number",
                description: "Property value at this frame. For opacity: 0-1. For scale: 0.5-3.0 typically. For rotation: 0-360 degrees. For positions: pixels."
              }
            },
            required: ["frame", "value"]
          },
          minItems: 2
        },
        easing: {
          type: "string",
          enum: ["linear", "ease-in", "ease-out", "ease-in-out"],
          description: "Animation easing function. 'linear' = constant speed, 'ease-in' = starts slow, 'ease-out' = ends slow, 'ease-in-out' = smooth start and end. Defaults to 'linear'."
        }
      },
      required: ["elementId", "property", "keyframes"]
    }
  },
  {
    name: "update_element_properties",
    description: `Update properties of an existing element (volume, position, color, size, etc.). Use this to modify elements without adding animations.

Examples:
- "Make the video louder" → increase volume
- "Move the text to the bottom" → change y position
- "Change text color to red" → update color property
- "Make the video half size" → change width/height

Common properties by element type:
- Video: volume (0-1), playbackRate (0.5-2.0)
- Text: color, fontSize, fontWeight, x, y
- All: opacity (0-1)`,
    input_schema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "ID of element to update (from composition context)"
        },
        properties: {
          type: "object",
          description: "Properties to update. Can include: volume (0-1 for video/audio), x, y (position in pixels), color (hex code for text), fontSize (pixels for text), opacity (0-1 for all elements), width, height (pixels).",
          additionalProperties: true
        }
      },
      required: ["elementId", "properties"]
    }
  },
  {
    name: "delete_element",
    description: `Remove an element from the composition. Use when user wants to delete, remove, or get rid of an element.

Examples:
- "Delete the intro video"
- "Remove that text"
- "Get rid of the background music"

This permanently removes the element from the timeline.`,
    input_schema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "ID of element to delete (from composition context)"
        }
      },
      required: ["elementId"]
    }
  },
  {
    name: "move_element",
    description: `Move an element to a different position on the timeline or change its duration. Use this for repositioning, trimming, or extending elements.

Examples:
- "Move the intro video to start at 5 seconds"
- "Make the text appear 2 seconds later"
- "Trim the video to 10 seconds long"
- "Extend the text to last the whole video"

This modifies the element's timing on the timeline without changing its content or properties.`,
    input_schema: {
      type: "object",
      properties: {
        elementId: {
          type: "string",
          description: "ID of element to move (from composition context)"
        },
        from: {
          type: "number",
          description: "New start frame. Calculate using: seconds * fps (e.g., 5 seconds at 30fps = 150 frames). Only provide if repositioning the element."
        },
        durationInFrames: {
          type: "number",
          description: "New duration in frames. Only provide if changing how long the element appears on screen (trimming or extending)."
        }
      },
      required: ["elementId"]
    }
  }
];

/**
 * Tool execution result type
 */
export type ToolExecutionResult = {
  success: boolean;
  elementId?: string;
  error?: string;
  message?: string;
};
