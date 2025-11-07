/**
 * Edit Plan Executor
 *
 * Executes AI-generated edit plans against the Composition IR.
 * Handles add, update, delete, and move operations.
 */

import type {
  CompositionIR,
  CompositionElement,
  EditPlan,
  Animation,
} from "@/types/composition-ir";
import { resolveSelector, getSingleMatch, getAllMatches } from "./selectors";
import { generateElementId } from "./utils";

/**
 * Result of executing an edit plan
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Updated composition IR */
  updatedIR?: CompositionIR;
  /** Elements that were affected */
  affectedElements: string[];
  /** Human-readable receipt message */
  receipt: string;
  /** Error message if failed */
  error?: string;
  /** Whether disambiguation is needed */
  needsDisambiguation?: boolean;
  /** Disambiguation options */
  disambiguationOptions?: Array<{
    elementId: string;
    label: string;
    description: string;
  }>;
}

/**
 * Execute an edit plan
 */
export function executeEditPlan(
  ir: CompositionIR,
  plan: EditPlan
): ExecutionResult {
  try {
    switch (plan.operation) {
      case "add":
        return executeAdd(ir, plan);
      case "update":
        return executeUpdate(ir, plan);
      case "delete":
        return executeDelete(ir, plan);
      case "move":
        return executeMove(ir, plan);
      default:
        return {
          success: false,
          affectedElements: [],
          receipt: "",
          error: `Unknown operation: ${(plan as any).operation}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute ADD operation
 */
function executeAdd(ir: CompositionIR, plan: EditPlan): ExecutionResult {
  const newElement: CompositionElement = {
    id: generateElementId(),
    type: plan.changes.type as any,
    from: plan.changes.from || 0,
    durationInFrames: plan.changes.durationInFrames || 90,
    properties: plan.changes.properties || {},
    label: plan.changes.label,
  };

  // Add animations if specified
  if (plan.changes.animations) {
    newElement.animations = plan.changes.animations as Animation;
  }

  // Clone IR and add element
  const updatedIR = {
    ...ir,
    elements: [...ir.elements, newElement],
  };

  const receipt = plan.changes.label
    ? `Added ${plan.changes.type} element "${plan.changes.label}"`
    : `Added ${plan.changes.type} element`;

  return {
    success: true,
    updatedIR,
    affectedElements: [newElement.id],
    receipt,
  };
}

/**
 * Execute UPDATE operation
 */
function executeUpdate(ir: CompositionIR, plan: EditPlan): ExecutionResult {
  if (!plan.selector) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Update operation requires a selector",
    };
  }

  // Resolve selector
  const selectorResult = resolveSelector(ir, plan.selector);

  // Check for ambiguity
  if (selectorResult.isAmbiguous) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      needsDisambiguation: true,
      disambiguationOptions: selectorResult.disambiguationOptions,
    };
  }

  // Check if element exists
  if (selectorResult.matches.length === 0) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "No element found matching selector",
    };
  }

  const targetElement = selectorResult.matches[0];

  // Clone IR and update element
  const updatedIR = {
    ...ir,
    elements: ir.elements.map((el) => {
      if (el.id !== targetElement.id) return el;

      // Merge changes
      const updated: CompositionElement = { ...el };

      // Update properties
      if (plan.changes.properties) {
        updated.properties = {
          ...updated.properties,
          ...plan.changes.properties,
        };
      }

      // Update timing
      if (plan.changes.from !== undefined) {
        updated.from = plan.changes.from;
      }
      if (plan.changes.durationInFrames !== undefined) {
        updated.durationInFrames = plan.changes.durationInFrames;
      }

      // Update label
      if (plan.changes.label !== undefined) {
        updated.label = plan.changes.label;
      }

      // Update animation
      if (plan.changes.animations !== undefined) {
        updated.animations = plan.changes.animations as Animation;
      }

      return updated;
    }),
  };

  const receipt = targetElement.label
    ? `Updated "${targetElement.label}"`
    : `Updated ${targetElement.type} element`;

  return {
    success: true,
    updatedIR,
    affectedElements: [targetElement.id],
    receipt,
  };
}

/**
 * Execute DELETE operation
 */
function executeDelete(ir: CompositionIR, plan: EditPlan): ExecutionResult {
  if (!plan.selector) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Delete operation requires a selector",
    };
  }

  // Resolve selector
  const selectorResult = resolveSelector(ir, plan.selector);

  // Check for ambiguity
  if (selectorResult.isAmbiguous) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      needsDisambiguation: true,
      disambiguationOptions: selectorResult.disambiguationOptions,
    };
  }

  // Check if element exists
  if (selectorResult.matches.length === 0) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "No element found matching selector",
    };
  }

  const targetElement = selectorResult.matches[0];
  const affectedIds = selectorResult.matches.map((el) => el.id);

  // Clone IR and remove element(s)
  const updatedIR = {
    ...ir,
    elements: ir.elements.filter((el) => !affectedIds.includes(el.id)),
  };

  const receipt =
    affectedIds.length === 1
      ? targetElement.label
        ? `Deleted "${targetElement.label}"`
        : `Deleted ${targetElement.type} element`
      : `Deleted ${affectedIds.length} elements`;

  return {
    success: true,
    updatedIR,
    affectedElements: affectedIds,
    receipt,
  };
}

/**
 * Execute MOVE operation
 */
function executeMove(ir: CompositionIR, plan: EditPlan): ExecutionResult {
  if (!plan.selector) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "Move operation requires a selector",
    };
  }

  // Resolve selector
  const selectorResult = resolveSelector(ir, plan.selector);

  // Check for ambiguity
  if (selectorResult.isAmbiguous) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      needsDisambiguation: true,
      disambiguationOptions: selectorResult.disambiguationOptions,
    };
  }

  // Check if element exists
  if (selectorResult.matches.length === 0) {
    return {
      success: false,
      affectedElements: [],
      receipt: "",
      error: "No element found matching selector",
    };
  }

  const targetElement = selectorResult.matches[0];

  // Move can be:
  // 1. Change timing (from/duration)
  // 2. Change layer order (z-index)
  // 3. Change parent (for nested elements)

  const updatedIR = {
    ...ir,
    elements: ir.elements.map((el) => {
      if (el.id !== targetElement.id) return el;

      const updated: CompositionElement = { ...el };

      // Update timing
      if (plan.changes.from !== undefined) {
        updated.from = plan.changes.from;
      }
      if (plan.changes.durationInFrames !== undefined) {
        updated.durationInFrames = plan.changes.durationInFrames;
      }

      // Update layer order (if specified)
      if (plan.changes.toIndex !== undefined) {
        // This would require re-ordering the elements array
        // For now, just update the element
      }

      return updated;
    }),
  };

  const receipt = targetElement.label
    ? `Moved "${targetElement.label}"`
    : `Moved ${targetElement.type} element`;

  return {
    success: true,
    updatedIR,
    affectedElements: [targetElement.id],
    receipt,
  };
}

/**
 * Validate edit plan before execution
 */
export function validateEditPlan(plan: EditPlan): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check operation
  if (!["add", "update", "delete", "move"].includes(plan.operation)) {
    errors.push(`Invalid operation: ${plan.operation}`);
  }

  // Check selector for non-add operations
  if (plan.operation !== "add" && !plan.selector) {
    errors.push(`${plan.operation} operation requires a selector`);
  }

  // Check changes
  if (!plan.changes || typeof plan.changes !== "object") {
    errors.push("Edit plan must include changes object");
  }

  // Validate add operation
  if (plan.operation === "add") {
    if (!plan.changes.type) {
      errors.push("Add operation requires element type");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
