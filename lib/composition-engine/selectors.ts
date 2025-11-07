/**
 * Selector Resolution System
 *
 * Resolves AI-generated selectors to concrete element IDs in the Composition IR.
 * Handles ambiguous selectors by returning multiple candidates for disambiguation.
 */

import type {
  CompositionIR,
  CompositionElement,
  ElementSelector,
  ByLabelSelector,
  ByIdSelector,
  ByIndexSelector,
  ByTypeSelector,
} from "@/types/composition-ir";

/**
 * Result of selector resolution
 */
export interface SelectorResult {
  /** Array of matched elements */
  matches: CompositionElement[];
  /** Whether the selector is ambiguous (needs user clarification) */
  isAmbiguous: boolean;
  /** Suggested disambiguation options */
  disambiguationOptions?: DisambiguationOption[];
}

export interface DisambiguationOption {
  /** Element ID */
  elementId: string;
  /** Human-readable label for UI */
  label: string;
  /** Additional context */
  description: string;
}

/**
 * Resolve a selector to element(s) in the composition
 */
export function resolveSelector(
  ir: CompositionIR,
  selector: Selector
): SelectorResult {
  switch (selector.type) {
    case "byId":
      return resolveById(ir, selector);
    case "byLabel":
      return resolveByLabel(ir, selector);
    case "byIndex":
      return resolveByIndex(ir, selector);
    case "byType":
      return resolveByType(ir, selector);
    default:
      throw new Error(`Unknown selector type: ${(selector as any).type}`);
  }
}

/**
 * Resolve by element ID (unambiguous)
 */
function resolveById(
  ir: CompositionIR,
  selector: SelectorById
): SelectorResult {
  const element = ir.elements.find((el) => el.id === selector.id);

  if (!element) {
    return {
      matches: [],
      isAmbiguous: false,
    };
  }

  return {
    matches: [element],
    isAmbiguous: false,
  };
}

/**
 * Resolve by user-provided label
 */
function resolveByLabel(
  ir: CompositionIR,
  selector: SelectorByLabel
): SelectorResult {
  const matches = ir.elements.filter((el) => {
    // Check direct label match
    if (el.label?.toLowerCase() === selector.label.toLowerCase()) {
      return true;
    }

    // Check partial match
    if (
      selector.partial &&
      el.label?.toLowerCase().includes(selector.label.toLowerCase())
    ) {
      return true;
    }

    return false;
  });

  if (matches.length === 0) {
    return {
      matches: [],
      isAmbiguous: false,
    };
  }

  if (matches.length === 1) {
    return {
      matches,
      isAmbiguous: false,
    };
  }

  // Multiple matches - need disambiguation
  return {
    matches,
    isAmbiguous: true,
    disambiguationOptions: matches.map((el) => ({
      elementId: el.id,
      label: el.label || `Unnamed ${el.type}`,
      description: `${el.type} at frame ${el.from} (${formatDuration(el.durationInFrames, ir.metadata.fps)})`,
    })),
  };
}

/**
 * Resolve by index (can be ambiguous if multiple parents)
 */
function resolveByIndex(
  ir: CompositionIR,
  selector: SelectorByIndex
): SelectorResult {
  // If parent is specified, resolve within that parent
  if (selector.parent) {
    const parentResult = resolveSelector(ir, selector.parent);
    if (parentResult.matches.length === 0) {
      return {
        matches: [],
        isAmbiguous: false,
      };
    }

    // For now, just use top-level elements
    // TODO: Handle nested elements when we add Groups
  }

  // Top-level elements
  const element = ir.elements[selector.index];

  if (!element) {
    return {
      matches: [],
      isAmbiguous: false,
    };
  }

  return {
    matches: [element],
    isAmbiguous: false,
  };
}

/**
 * Resolve by element type (video, audio, text, image)
 */
function resolveByType(
  ir: CompositionIR,
  selector: SelectorByType
): SelectorResult {
  const matches = ir.elements.filter((el) => el.type === selector.elementType);

  if (matches.length === 0) {
    return {
      matches: [],
      isAmbiguous: false,
    };
  }

  // If index is specified, return that specific match
  if (typeof selector.index === "number") {
    const element = matches[selector.index];
    if (!element) {
      return {
        matches: [],
        isAmbiguous: false,
      };
    }
    return {
      matches: [element],
      isAmbiguous: false,
    };
  }

  // If filter is specified, apply it
  if (selector.filter) {
    const filteredMatches = matches.filter((el) => {
      return evaluateFilter(el, selector.filter!);
    });

    if (filteredMatches.length === 1) {
      return {
        matches: filteredMatches,
        isAmbiguous: false,
      };
    }

    if (filteredMatches.length > 1) {
      return {
        matches: filteredMatches,
        isAmbiguous: true,
        disambiguationOptions: filteredMatches.map((el) => ({
          elementId: el.id,
          label: el.label || `Unnamed ${el.type}`,
          description: `${el.type} at frame ${el.from} (${formatDuration(el.durationInFrames, ir.metadata.fps)})`,
        })),
      };
    }
  }

  // Multiple matches without filter - need disambiguation
  if (matches.length > 1) {
    return {
      matches,
      isAmbiguous: true,
      disambiguationOptions: matches.map((el, idx) => ({
        elementId: el.id,
        label: el.label || `${el.type} #${idx + 1}`,
        description: `${el.type} at frame ${el.from} (${formatDuration(el.durationInFrames, ir.metadata.fps)})`,
      })),
    };
  }

  return {
    matches,
    isAmbiguous: false,
  };
}

/**
 * Evaluate a filter condition
 */
function evaluateFilter(element: Element, filter: any): boolean {
  // Simple property-based filtering
  for (const [key, value] of Object.entries(filter)) {
    const elementValue = (element as any)[key];

    if (elementValue === undefined || elementValue !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Format duration from frames to human-readable string
 */
function formatDuration(frames: number, fps: number): string {
  const seconds = frames / fps;
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Get all elements that match a selector (for batch operations)
 */
export function getAllMatches(
  ir: CompositionIR,
  selector: Selector
): Element[] {
  const result = resolveSelector(ir, selector);
  return result.matches;
}

/**
 * Get single element from selector (throws if ambiguous)
 */
export function getSingleMatch(
  ir: CompositionIR,
  selector: Selector
): Element | null {
  const result = resolveSelector(ir, selector);

  if (result.isAmbiguous) {
    throw new Error(
      `Selector is ambiguous - got ${result.matches.length} matches`
    );
  }

  return result.matches[0] || null;
}

/**
 * Check if selector is unambiguous
 */
export function isUnambiguous(ir: CompositionIR, selector: Selector): boolean {
  const result = resolveSelector(ir, selector);
  return !result.isAmbiguous && result.matches.length === 1;
}
