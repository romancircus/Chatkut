/**
 * Helper functions for Composition IR manipulation
 */

import type {
  CompositionIR,
  CompositionElement,
  CompositionMetadata,
  Patch,
} from "@/types/composition-ir";
import { nanoid } from "nanoid";

/**
 * Create an empty composition
 */
export function createEmptyComposition(
  metadata: CompositionMetadata = {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300, // 10 seconds
  }
): CompositionIR {
  return {
    id: nanoid(),
    version: 0,
    metadata,
    elements: [],
    patches: [],
  };
}

/**
 * Add an element to the composition
 */
export function addElement(
  ir: CompositionIR,
  element: Omit<CompositionElement, "id">
): CompositionIR {
  const newElement: CompositionElement = {
    ...element,
    id: nanoid(),
  };

  return {
    ...ir,
    elements: [...ir.elements, newElement],
    version: ir.version + 1,
  };
}

/**
 * Update an element by ID
 */
export function updateElement(
  ir: CompositionIR,
  elementId: string,
  changes: Partial<CompositionElement>
): CompositionIR {
  return {
    ...ir,
    elements: ir.elements.map((el) =>
      el.id === elementId ? { ...el, ...changes } : el
    ),
    version: ir.version + 1,
  };
}

/**
 * Delete an element by ID
 */
export function deleteElement(ir: CompositionIR, elementId: string): CompositionIR {
  return {
    ...ir,
    elements: ir.elements.filter((el) => el.id !== elementId),
    version: ir.version + 1,
  };
}

/**
 * Move an element to a new index
 */
export function moveElement(
  ir: CompositionIR,
  elementId: string,
  newIndex: number
): CompositionIR {
  const elements = [...ir.elements];
  const currentIndex = elements.findIndex((el) => el.id === elementId);

  if (currentIndex === -1) {
    throw new Error(`Element with ID ${elementId} not found`);
  }

  const [element] = elements.splice(currentIndex, 1);
  elements.splice(newIndex, 0, element);

  return {
    ...ir,
    elements,
    version: ir.version + 1,
  };
}

/**
 * Find an element by ID
 */
export function findElementById(
  elements: CompositionElement[],
  id: string
): CompositionElement | undefined {
  for (const element of elements) {
    if (element.id === id) {
      return element;
    }
    if (element.children) {
      const found = findElementById(element.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Find elements by label (case-insensitive)
 */
export function findElementsByLabel(
  elements: CompositionElement[],
  label: string
): CompositionElement[] {
  const results: CompositionElement[] = [];
  const lowerLabel = label.toLowerCase();

  for (const element of elements) {
    if (element.label?.toLowerCase().includes(lowerLabel)) {
      results.push(element);
    }
    if (element.children) {
      results.push(...findElementsByLabel(element.children, lowerLabel));
    }
  }

  return results;
}

/**
 * Find elements by type
 */
export function findElementsByType(
  elements: CompositionElement[],
  type: string
): CompositionElement[] {
  const results: CompositionElement[] = [];

  for (const element of elements) {
    if (element.type === type) {
      results.push(element);
    }
    if (element.children) {
      results.push(...findElementsByType(element.children, type));
    }
  }

  return results;
}

/**
 * Add a patch to the composition
 */
export function addPatch(ir: CompositionIR, patch: Patch): CompositionIR {
  return {
    ...ir,
    patches: [...ir.patches, patch],
  };
}

/**
 * Revert the last patch (undo)
 */
export function revertLastPatch(ir: CompositionIR): CompositionIR | null {
  if (ir.patches.length === 0) {
    return null;
  }

  const lastPatch = ir.patches[ir.patches.length - 1];

  // Revert based on operation
  let revertedIR: CompositionIR;
  switch (lastPatch.operation) {
    case "add":
      // Remove the added element
      revertedIR = deleteElement(ir, lastPatch.selector.type === "byId" ? lastPatch.selector.id : "");
      break;

    case "update":
      // Restore previous state
      if (!lastPatch.previousState) {
        throw new Error("Cannot undo update: no previous state stored");
      }
      revertedIR = updateElement(
        ir,
        lastPatch.selector.type === "byId" ? lastPatch.selector.id : "",
        lastPatch.previousState
      );
      break;

    case "delete":
      // Re-add the deleted element
      if (!lastPatch.previousState) {
        throw new Error("Cannot undo delete: no previous state stored");
      }
      revertedIR = addElement(ir, lastPatch.previousState);
      break;

    case "move":
      // Move back to original position
      if (!lastPatch.previousState?.index) {
        throw new Error("Cannot undo move: no previous index stored");
      }
      revertedIR = moveElement(
        ir,
        lastPatch.selector.type === "byId" ? lastPatch.selector.id : "",
        lastPatch.previousState.index
      );
      break;

    default:
      throw new Error(`Unknown patch operation: ${lastPatch.operation}`);
  }

  // Remove the last patch
  return {
    ...revertedIR,
    patches: ir.patches.slice(0, -1),
  };
}

/**
 * Convert frames to timecode string (e.g., "0:05.5")
 */
export function framesToTimecode(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, "0")}`;
}

/**
 * Convert timecode to frames
 */
export function timecodeToFrames(timecode: string, fps: number): number {
  const [minutes, seconds] = timecode.split(":").map(Number);
  const totalSeconds = minutes * 60 + seconds;
  return Math.floor(totalSeconds * fps);
}

/**
 * Calculate total duration of composition
 */
export function calculateTotalDuration(ir: CompositionIR): number {
  let maxFrame = 0;

  for (const element of ir.elements) {
    const endFrame = element.from + element.durationInFrames;
    if (endFrame > maxFrame) {
      maxFrame = endFrame;
    }
  }

  return maxFrame;
}

/**
 * Clone a composition element deeply
 */
export function cloneElement(element: CompositionElement): CompositionElement {
  return JSON.parse(JSON.stringify(element));
}

/**
 * Validate composition IR
 */
export function validateComposition(ir: CompositionIR): string[] {
  const errors: string[] = [];

  // Check metadata
  if (ir.metadata.width <= 0) {
    errors.push("Width must be positive");
  }
  if (ir.metadata.height <= 0) {
    errors.push("Height must be positive");
  }
  if (ir.metadata.fps <= 0) {
    errors.push("FPS must be positive");
  }
  if (ir.metadata.durationInFrames <= 0) {
    errors.push("Duration must be positive");
  }

  // Check elements
  for (const element of ir.elements) {
    if (!element.id) {
      errors.push("Element missing ID");
    }
    if (element.from < 0) {
      errors.push(`Element ${element.id}: 'from' cannot be negative`);
    }
    if (element.durationInFrames <= 0) {
      errors.push(`Element ${element.id}: duration must be positive`);
    }
  }

  return errors;
}
